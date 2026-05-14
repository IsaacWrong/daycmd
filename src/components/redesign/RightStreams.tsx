"use client";

import { useState } from "react";
import { format, formatDistanceToNowStrict, isToday, isTomorrow } from "date-fns";
import { usePoll } from "@/lib/hooks";
import type { CalEvent } from "@/lib/calendar";
import type { GmailMsg } from "@/lib/gmail";
import type { GhSummary } from "@/lib/github";
import type { ErrorRow } from "@/lib/errors";
import type { CategoryStats } from "@/lib/kb";
import { Branch, Envelope, Note } from "./Glyph";
import { SectionMini } from "./Section";
import { useCalendarOverlay } from "@/components/calendar/CalendarOverlayProvider";
import { useMailOverlay } from "@/components/mail/MailOverlayProvider";
import { parseEventTime } from "@/components/calendar/dates";

type CalResp =
  | { events: CalEvent[]; configured: boolean; connected: boolean }
  | { error: string; configured: boolean; connected: boolean };

type GmailResp =
  | { messages: GmailMsg[]; configured: boolean; connected: boolean }
  | { error: string; configured: boolean; connected: boolean };

type GhResp = GhSummary | { error: string };

function ago(iso: string | number): string {
  const d = typeof iso === "number" ? new Date(iso) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatDistanceToNowStrict(d, { addSuffix: false }).replace(
    /\s+(seconds?|minutes?|hours?|days?|months?|years?)/,
    (m, u: string) => u[0],
  );
}

type Bucket = "today" | "tomorrow" | "later";

function bucketOf(d: Date): Bucket {
  if (isToday(d)) return "today";
  if (isTomorrow(d)) return "tomorrow";
  return "later";
}

const BUCKET_ORDER: Bucket[] = ["today", "tomorrow", "later"];
const BUCKET_LABEL: Record<Bucket, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  later: "Later",
};

function CalendarRow({ e }: { e: CalEvent }) {
  const overlay = useCalendarOverlay();
  const start = new Date(e.start);
  const time = e.allDay
    ? "all day"
    : start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <button
      key={`${e.calendar}-${e.id}`}
      onClick={() => overlay.openEvent(e)}
      className="flex items-center gap-2.5 py-1 text-[12.5px] hover:opacity-80 w-full text-left"
      style={{ background: "transparent", border: "none", padding: "4px 0", cursor: "pointer" }}
    >
      <span
        className="t-mono text-[11px] text-fg-soft"
        style={{ width: 52 }}
      >
        {time}
      </span>
      <span
        className="src-dot src-calendar"
        style={{ width: 6, height: 6, background: e.calendarColor || undefined }}
      />
      <span className="flex-1 truncate" style={{ letterSpacing: "-0.005em" }}>
        {e.summary}
      </span>
    </button>
  );
}

function CalendarSection() {
  const { data } = usePoll<CalResp>("/api/calendar", 60_000);
  const events = data && "events" in data ? data.events : [];
  const upcoming = events.filter((e) => parseEventTime(e.end) > Date.now());

  const grouped: Record<Bucket, CalEvent[]> = { today: [], tomorrow: [], later: [] };
  for (const e of upcoming) grouped[bucketOf(new Date(parseEventTime(e.start)))].push(e);
  for (const b of BUCKET_ORDER) {
    grouped[b].sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.start < b.start ? -1 : a.start > b.start ? 1 : 0;
    });
  }

  // Cap total visible rows at 7, but always show at least 1 row from each
  // non-empty bucket so context isn't lost.
  let remaining = 7;
  const visible: Record<Bucket, CalEvent[]> = { today: [], tomorrow: [], later: [] };
  for (const b of BUCKET_ORDER) {
    const take = Math.min(grouped[b].length, b === "today" ? remaining : Math.max(remaining - 1, 0));
    visible[b] = grouped[b].slice(0, take);
    remaining -= visible[b].length;
    if (remaining <= 0) break;
  }

  const totalCount = grouped.today.length + grouped.tomorrow.length;

  return (
    <SectionMini title="Calendar" count={totalCount} accent="calendar">
      {BUCKET_ORDER.map((b) => {
        const items = visible[b];
        if (items.length === 0) return null;
        const hidden = grouped[b].length - items.length;
        const subLabel =
          b === "later" && items[0]
            ? `${BUCKET_LABEL[b]} · from ${format(new Date(parseEventTime(items[0].start)), "EEE MMM d")}`
            : BUCKET_LABEL[b];
        return (
          <div key={b} className="mb-1.5" style={{ marginTop: b === "today" ? 0 : 10 }}>
            <div
              className="t-mono uppercase mb-1 flex items-center gap-2"
              style={{
                fontSize: 9,
                color: b === "today" ? "var(--c-calendar)" : "var(--fg-soft)",
                letterSpacing: "0.08em",
              }}
            >
              <span>{subLabel}</span>
              {hidden > 0 && <span className="opacity-70">+{hidden}</span>}
              {b !== "today" && (
                <span
                  className="flex-1 self-center"
                  style={{ height: 1, background: "var(--rule)" }}
                />
              )}
            </div>
            {items.map((e) => (
              <CalendarRow key={`${e.calendar}-${e.id}`} e={e} />
            ))}
          </div>
        );
      })}
      {upcoming.length === 0 && (
        <p className="text-[12px] text-fg-soft py-1">No upcoming events.</p>
      )}
    </SectionMini>
  );
}

function InboxSection() {
  const mail = useMailOverlay();
  const { data } = usePoll<GmailResp>("/api/gmail", 60_000);
  const messages = data && "messages" in data ? data.messages : [];
  const unread = messages.filter((m) => m.unread).length;
  return (
    <SectionMini title="Inbox" count={unread} accent="gmail">
      {messages.slice(0, 5).map((m) => (
        <button
          key={m.id}
          onClick={() => mail.openThread(m.threadId)}
          className="flex items-center gap-2 py-1 text-[12.5px] hover:opacity-80 w-full text-left"
          style={{ background: "transparent", border: "none", padding: "4px 0", cursor: "pointer" }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: 99,
              background: m.unread ? "var(--c-gmail)" : "transparent",
              flexShrink: 0,
            }}
          />
          <Envelope c="var(--c-gmail)" s={12} />
          <div className="flex-1 min-w-0">
            <div
              className="truncate"
              style={{
                color: m.unread ? "var(--fg)" : "var(--fg-soft)",
                fontWeight: m.unread ? 500 : 400,
                fontSize: 12,
              }}
            >
              {m.from}
            </div>
            <div
              className="truncate text-fg-soft"
              style={{ fontSize: 11.5, letterSpacing: "-0.005em" }}
            >
              {m.subject}
            </div>
          </div>
        </button>
      ))}
      {messages.length === 0 && (
        <p className="text-[12px] text-fg-soft py-1">Inbox empty.</p>
      )}
    </SectionMini>
  );
}

function GitHubSection() {
  const { data } = usePoll<GhResp>("/api/github", 60_000);
  if (!data || "error" in data) {
    return (
      <SectionMini title="GitHub" accent="github">
        <p className="text-[12px] text-fg-soft py-1">
          {data && "error" in data ? data.error : "Loading…"}
        </p>
      </SectionMini>
    );
  }
  const count = data.reviewRequested.length + data.authored.length;
  return (
    <SectionMini title="GitHub" count={count} accent="github">
      {data.reviewRequested.length > 0 && (
        <>
          <div
            className="t-mono uppercase mb-1"
            style={{
              fontSize: 9,
              color: "var(--c-github)",
              letterSpacing: "0.08em",
            }}
          >
            Review requested
          </div>
          {data.reviewRequested.slice(0, 3).map((pr) => (
            <a
              key={pr.id}
              href={pr.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 py-1 text-[12.5px] hover:opacity-80"
            >
              <Branch s={11} c="var(--c-github)" />
              <span className="t-mono text-fg-soft" style={{ fontSize: 10 }}>
                #{pr.number}
              </span>
              <span
                className="flex-1 truncate"
                style={{ letterSpacing: "-0.005em" }}
              >
                {pr.title}
              </span>
            </a>
          ))}
        </>
      )}
      {data.authored.length > 0 && (
        <>
          <div
            className="t-mono uppercase mt-3 mb-1 text-fg-soft"
            style={{ fontSize: 9, letterSpacing: "0.08em" }}
          >
            Yours
          </div>
          {data.authored.slice(0, 3).map((pr) => (
            <a
              key={pr.id}
              href={pr.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 py-1 text-[12.5px] hover:opacity-80"
            >
              <Branch s={11} c="var(--c-github)" />
              <span className="t-mono text-fg-soft" style={{ fontSize: 10 }}>
                #{pr.number}
              </span>
              <span
                className="flex-1 truncate"
                style={{ letterSpacing: "-0.005em" }}
              >
                {pr.title}
              </span>
            </a>
          ))}
        </>
      )}
      {count === 0 && (
        <p className="text-[12px] text-fg-soft py-1">No open PRs.</p>
      )}
    </SectionMini>
  );
}

function KnowledgeRow({
  c,
  onRun,
  busy,
}: {
  c: CategoryStats;
  onRun: (name: string) => void;
  busy: boolean;
}) {
  const stale = !c.lastCompileAt || Date.now() - c.lastCompileAt > 6 * 3600_000;
  const stamp = c.lastCompileAt ?? c.lastRawAt ?? 0;
  const driftColor =
    c.driftCount > 0
      ? stale
        ? "var(--c-error)"
        : "var(--c-agent)"
      : "var(--fg-soft)";
  return (
    <div className="flex items-center gap-1.5 py-1 text-[12px]">
      <Note s={11} c="var(--c-agent)" />
      <span className="flex-1 truncate" style={{ letterSpacing: "-0.005em" }}>
        <span className="text-fg">{c.name}</span>
        <span className="text-fg-soft"> · {c.wikiCount} wiki</span>
      </span>
      <span
        className="t-mono"
        style={{ fontSize: 10, color: driftColor }}
        title={`${c.driftCount} raw files drifted since last compile`}
      >
        {c.driftCount > 0 ? `+${c.driftCount}` : "·"}
      </span>
      <span className="t-mono text-fg-soft" style={{ fontSize: 10 }} title={stamp ? new Date(stamp).toLocaleString() : "never"}>
        {stamp ? ago(stamp) : "—"}
      </span>
      <button
        type="button"
        onClick={() => onRun(c.name)}
        disabled={busy}
        title={busy ? "running…" : "Compile now"}
        className="t-mono hover:text-fg"
        style={{
          background: "transparent",
          border: 0,
          padding: 0,
          fontSize: 10,
          color: busy ? "var(--fg-soft)" : "var(--c-agent)",
          cursor: busy ? "wait" : "pointer",
        }}
      >
        {busy ? "…" : "run"}
      </button>
    </div>
  );
}

function KnowledgeSection() {
  const { data, refresh } = usePoll<{ categories: CategoryStats[] }>(
    "/api/kb",
    5 * 60_000,
  );
  const automations = usePoll<{
    automations: Array<{ id: number; name: string; kind: string; target_category: string | null; enabled: boolean }>;
  }>("/api/automations", 5 * 60_000).data;
  const [busy, setBusy] = useState<string | null>(null);

  const cats = (data?.categories ?? []).slice().sort((a, b) => {
    // Prioritise drift+stale, then drift, then most-recent activity.
    const aStaleDrift = a.driftCount > 0 && (!a.lastCompileAt || Date.now() - a.lastCompileAt > 6 * 3600_000) ? 1 : 0;
    const bStaleDrift = b.driftCount > 0 && (!b.lastCompileAt || Date.now() - b.lastCompileAt > 6 * 3600_000) ? 1 : 0;
    if (aStaleDrift !== bStaleDrift) return bStaleDrift - aStaleDrift;
    if (a.driftCount !== b.driftCount) return b.driftCount - a.driftCount;
    return (b.lastCompileAt ?? b.lastRawAt ?? 0) - (a.lastCompileAt ?? a.lastRawAt ?? 0);
  });

  async function runCompile(name: string) {
    const target = (automations?.automations ?? []).find(
      (a) => a.kind === "compile" && a.target_category === name && a.enabled,
    );
    if (!target) return;
    setBusy(name);
    try {
      await fetch(`/api/automations/${target.id}/run`, { method: "POST" });
    } finally {
      setBusy(null);
      refresh();
    }
  }

  return (
    <SectionMini title="Knowledge" accent="agent">
      {cats.slice(0, 6).map((c) => (
        <KnowledgeRow
          key={c.name}
          c={c}
          onRun={runCompile}
          busy={busy === c.name}
        />
      ))}
      {cats.length === 0 && (
        <p className="text-[12px] text-fg-soft py-1">No categories yet.</p>
      )}
    </SectionMini>
  );
}

function ErrorsSection() {
  const { data, refresh } = usePoll<{ errors: ErrorRow[] }>("/api/errors", 60_000);
  const [busy, setBusy] = useState<string | null>(null);
  const errs = (data?.errors ?? []).slice(0, 4);

  async function resolve(id: string) {
    setBusy(id);
    try {
      await fetch(`/api/errors/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resolved: true }),
      });
      refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <SectionMini title="Errors" count={errs.length} accent="error">
      {errs.map((e) => (
        <div
          key={e.id}
          className="group py-1 flex items-start gap-2"
          style={{ fontSize: 12, lineHeight: 1.45 }}
        >
          <div className="flex-1 min-w-0">
            <span
              className="t-mono"
              style={{ color: "var(--c-error)", fontSize: 11 }}
            >
              {e.source}
            </span>
            <span
              className="t-mono float-right text-fg-soft"
              style={{ fontSize: 11 }}
            >
              {ago(e.ts)}
            </span>
            <div className="text-fg-soft mt-0.5 truncate" style={{ fontSize: 11.5 }}>
              {e.message}
            </div>
          </div>
          <button
            type="button"
            onClick={() => resolve(e.id)}
            disabled={busy === e.id}
            title="Mark resolved"
            className="t-mono hover:text-fg opacity-60 hover:opacity-100"
            style={{
              background: "transparent",
              border: 0,
              padding: 0,
              fontSize: 14,
              color: busy === e.id ? "var(--fg-soft)" : "var(--c-good)",
              cursor: busy === e.id ? "wait" : "pointer",
              lineHeight: 1,
            }}
          >
            ✓
          </button>
        </div>
      ))}
      {errs.length === 0 && (
        <p className="text-[12px] text-fg-soft py-1">No open errors.</p>
      )}
    </SectionMini>
  );
}

export function RightStreams() {
  return (
    <aside
      className="dimmable scroll"
      style={{
        overflowY: "auto",
        paddingLeft: 18,
        borderLeft: "1px solid var(--rule)",
      }}
    >
      <CalendarSection />
      <InboxSection />
      <GitHubSection />
      <KnowledgeSection />
      <ErrorsSection />
    </aside>
  );
}
