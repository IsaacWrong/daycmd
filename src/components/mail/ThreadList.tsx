"use client";

import { useEffect, useRef } from "react";
import {
  archiveThread,
  trashThread,
  unsubscribeThread,
  useLabelThreads,
  useLabels,
  useSearchThreads,
} from "@/lib/gmail-client";
import type { LabelInfo, ThreadSummary } from "@/lib/gmail";

type Props = {
  labelId?: string | null; // null/undefined = inbox (or use query)
  query?: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function ThreadList({ labelId = null, query = null, selectedId, onSelect }: Props) {
  const labelRes = useLabelThreads(query ? null : labelId);
  const searchRes = useSearchThreads(query);
  const { data, error } = query ? searchRes : labelRes;
  const { data: labelsData } = useLabels();
  const labelMap = new Map<string, LabelInfo>();
  if (labelsData && "labels" in labelsData) {
    for (const l of labelsData.labels) labelMap.set(l.id, l);
  }
  const threads: ThreadSummary[] =
    data && "threads" in data ? data.threads : [];
  const refs = useRef<Record<string, HTMLLIElement | null>>({});

  useEffect(() => {
    if (!selectedId) return;
    refs.current[selectedId]?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  if (error) {
    return (
      <div className="p-4 text-[12px]" style={{ color: "var(--c-error)" }}>
        {error}
      </div>
    );
  }
  if (!data) {
    return <div className="p-4 text-fg-soft text-[12px]">Loading…</div>;
  }
  if (threads.length === 0) {
    return <div className="p-4 text-fg-soft text-[12px]">No threads.</div>;
  }

  async function doAction(e: React.MouseEvent, fn: () => Promise<void>) {
    e.stopPropagation();
    try {
      await fn();
    } catch (err) {
      console.error("[mail]", (err as Error).message);
    }
  }

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {threads.map((t) => {
        const isSelected = t.id === selectedId;
        return (
          <li
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
          >
            <div
              className="mail-row"
              data-selected={isSelected}
              data-unread={t.unread}
              onClick={() => onSelect(t.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSelect(t.id);
              }}
              style={{ position: "relative" }}
            >
              <div className="mail-row-header">
                <span className="mail-row-from">
                  {t.starred && (
                    <span style={{ color: "#e8b94d", marginRight: 4 }}>★</span>
                  )}
                  {t.from}
                </span>
                {t.messageCount > 1 && (
                  <span className="mail-row-count">{t.messageCount}</span>
                )}
                <span className="mail-row-date">{formatDate(t.date)}</span>
              </div>
              <div className="mail-row-subject">{t.subject || "(no subject)"}</div>
              <div className="mail-row-snippet">{t.snippet}</div>
              {t.labelIds.some((id) => labelMap.get(id)?.type === "user") && (
                <div className="mail-row-labels">
                  {t.labelIds
                    .map((id) => labelMap.get(id))
                    .filter((l): l is LabelInfo => !!l && l.type === "user")
                    .slice(0, 4)
                    .map((l) => (
                      <span
                        key={l.id}
                        className="mail-label-chip"
                        style={{
                          background: l.color
                            ? `color-mix(in srgb, ${l.color} 24%, transparent)`
                            : "oklch(from var(--fg) l c h / 0.08)",
                          borderLeft: `2px solid ${l.color ?? "var(--fg-soft)"}`,
                        }}
                      >
                        {l.name}
                      </span>
                    ))}
                </div>
              )}

              <div className="mail-row-actions">
                <button
                  className="mail-row-action"
                  title="Archive"
                  onClick={(e) => doAction(e, () => archiveThread(t.id))}
                >
                  ✓
                </button>
                <button
                  className="mail-row-action"
                  title="Trash"
                  onClick={(e) => doAction(e, () => trashThread(t.id))}
                >
                  🗑
                </button>
                {t.hasUnsubscribe && (
                  <button
                    className="mail-row-action"
                    title="Unsubscribe"
                    onClick={(e) =>
                      doAction(e, async () => {
                        const r = await unsubscribeThread(t.id);
                        if (!r.ok) throw new Error(r.error ?? "unsub failed");
                      })
                    }
                  >
                    ⌀
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function formatDate(s: string): string {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const sameYear = d.getFullYear() === now.getFullYear();
  if (sameYear) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString(undefined, {
    year: "2-digit",
    month: "short",
    day: "numeric",
  });
}
