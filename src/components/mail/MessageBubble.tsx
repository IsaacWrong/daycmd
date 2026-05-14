"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ParsedMessage } from "@/lib/gmail";

type Props = {
  message: ParsedMessage;
  expanded: boolean;
  onToggle: () => void;
  fill?: boolean;
  relayoutKey?: number;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSrcDoc(html: string, text: string): string {
  const fgColor = "#1a1a1a";
  const bg = "#fff";
  const css = `
    html, body { margin: 0; padding: 16px; font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: ${fgColor}; background: ${bg}; }
    body { overflow-x: auto; }
    a { color: #1a73e8; }
    img { max-width: 100%; height: auto; }
    blockquote { border-left: 3px solid #ddd; margin: 8px 0; padding: 4px 12px; color: #555; }
    pre { white-space: pre-wrap; word-wrap: break-word; }
  `;
  const body = html ? html : `<pre>${escapeHtml(text)}</pre>`;
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>${css}</style></head><body>${body}</body></html>`;
}

function formatDate(s: string): string {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseFrom(s: string): { name: string; email: string } {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(s);
  if (m) return { name: m[1].replace(/^"|"$/g, "") || m[2], email: m[2] };
  return { name: s, email: s };
}

export function MessageBubble({ message, expanded, onToggle, fill, relayoutKey }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLButtonElement>(null);
  const [height, setHeight] = useState(400);
  const [fillHeight, setFillHeight] = useState(0);

  useEffect(() => {
    if (!expanded) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    function measure() {
      if (cancelled) return;
      const doc = iframe?.contentDocument;
      if (!doc?.body) return;
      const h = Math.min(
        Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight),
        6000,
      );
      if (h > 0) setHeight(h);
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    function onLoad() {
      measure();
      const doc = iframe?.contentDocument;
      if (!doc?.body) return;
      const imgs = Array.from(doc.images);
      imgs.forEach((img) => {
        if (!img.complete) img.addEventListener("load", measure, { once: true });
      });
      try {
        observer = new ResizeObserver(measure);
        observer.observe(doc.body);
        observer.observe(doc.documentElement);
      } catch {}
      // Fallback re-measures for late content (web fonts, async images)
      timers.push(setTimeout(measure, 250));
      timers.push(setTimeout(measure, 1500));
      timers.push(setTimeout(measure, 4000));
    }

    iframe.addEventListener("load", onLoad);
    // In case the iframe already loaded (srcDoc), trigger now
    if (iframe.contentDocument?.readyState === "complete") onLoad();

    return () => {
      cancelled = true;
      iframe.removeEventListener("load", onLoad);
      observer?.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [expanded, message.id]);

  useLayoutEffect(() => {
    if (!fill || !expanded) {
      setFillHeight(0);
      return;
    }
    const bubble = bubbleRef.current;
    const parent = bubble?.parentElement;
    if (!bubble || !parent) return;
    function compute() {
      if (!bubble || !parent) return;
      const headerH = headerRef.current?.offsetHeight ?? 0;
      const parentRect = parent.getBoundingClientRect();
      const bubbleRect = bubble.getBoundingClientRect();
      const bubbleTopRel =
        bubbleRect.top - parentRect.top + parent.scrollTop;
      const parentH = parent.clientHeight;
      const avail = parentH - bubbleTopRel - headerH - 4;
      setFillHeight(Math.max(0, avail));
    }
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [fill, expanded, relayoutKey]);

  const from = parseFrom(message.from);
  const srcDoc = buildSrcDoc(message.bodyHtml, message.bodyText);

  const isMe = message.isMe;

  return (
    <div
      ref={bubbleRef}
      style={{
        borderBottom: "1px solid var(--rule)",
        background: isMe
          ? "color-mix(in srgb, var(--c-gmail) 6%, var(--bg-a))"
          : "var(--bg-a)",
        borderLeft: isMe
          ? "3px solid var(--c-gmail)"
          : "3px solid transparent",
      }}
    >
      <button
        ref={headerRef}
        onClick={onToggle}
        className="flex items-center w-full gap-2"
        style={{
          padding: "10px 14px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span
              className="text-[13px]"
              style={{
                fontWeight: 500,
                color: isMe ? "var(--c-gmail)" : undefined,
              }}
            >
              {isMe ? "You" : from.name}
            </span>
            <span className="text-fg-soft text-[11.5px] truncate">
              &lt;{from.email}&gt;
            </span>
          </div>
          {!expanded && (
            <div className="text-fg-soft text-[12px] truncate mt-0.5">
              {message.bodyText.slice(0, 140) || "(empty)"}
            </div>
          )}
          {expanded && message.to && (
            <div className="text-fg-soft text-[11px] mt-0.5">
              to {message.to}
              {message.cc && <span> · cc {message.cc}</span>}
            </div>
          )}
        </div>
        <span className="text-fg-soft text-[11px]" style={{ flexShrink: 0 }}>
          {formatDate(message.date)}
        </span>
      </button>
      {expanded && (
        <iframe
          ref={iframeRef}
          srcDoc={srcDoc}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          style={{
            display: "block",
            width: "100%",
            height: Math.max(height, fill ? fillHeight : 0),
            border: "none",
            borderTop: "1px solid var(--rule)",
            background: "#fff",
          }}
          title={`Message from ${from.name}`}
        />
      )}
    </div>
  );
}
