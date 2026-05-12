"use client";

import Link from "next/link";
import { usePoll } from "@/lib/hooks";
import { Arrow } from "./Glyph";
import { Section } from "./Section";

type DailyResp = { path: string; content: string; exists: boolean; mtime: number };

export function DailyNotePreview() {
  const { data } = usePoll<DailyResp>("/api/obsidian/daily", 60_000);
  const lines = (data?.content ?? "").split("\n");
  const words = (data?.content ?? "").trim().split(/\s+/).filter(Boolean).length;
  const path = data?.path?.split("/").slice(-2).join("/") ?? "Daily/—";

  return (
    <Section
      eyebrow="Notes"
      title="Daily"
      accent="obsidian"
      right={
        <span className="t-mono text-[11px] text-fg-soft">
          {path} · {words} words
        </span>
      }
    >
      <div style={{ paddingLeft: 18, borderLeft: "2px solid var(--rule)" }}>
        {lines.slice(0, 14).map((line, i) => {
          if (line.startsWith("## ")) {
            return (
              <div
                key={i}
                className="t-mono text-[11px] text-fg-soft uppercase"
                style={{
                  marginTop: i === 0 ? 0 : 12,
                  marginBottom: 4,
                  letterSpacing: "0.06em",
                }}
              >
                {line.slice(3)}
              </div>
            );
          }
          if (line.startsWith("# ")) {
            return (
              <div key={i} className="text-[14px] font-medium mb-1.5">
                {line.slice(2)}
              </div>
            );
          }
          if (line === "") return <div key={i} className="h-1.5" />;
          return (
            <div
              key={i}
              className="text-fg-soft"
              style={{ fontSize: 13.5, lineHeight: 1.6, letterSpacing: "-0.003em" }}
            >
              {line}
            </div>
          );
        })}
        {!data?.exists && (
          <div className="text-fg-soft text-[13.5px]">No entry yet today.</div>
        )}
        <Link
          href="/settings"
          className="flex items-center gap-1.5 text-[12px] text-fg-soft hover:text-fg"
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px dashed var(--rule)",
            cursor: "pointer",
          }}
        >
          Continue writing <Arrow s={11} />
        </Link>
      </div>
    </Section>
  );
}
