"use client";

import { format, formatDistanceToNowStrict, isToday, isTomorrow } from "date-fns";
import { usePoll } from "@/lib/hooks";
import type { CalEvent } from "@/lib/calendar";
import type { GmailMsg } from "@/lib/gmail";
import type { GhSummary } from "@/lib/github";
import type { ErrorRow } from "@/lib/errors";
import type { CategoryStats } from "@/lib/kb";
import { Branch, Envelope, Note } from "./Glyph";
import { SectionMini } from "./Section";

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
  const start = new Date(e.start);
  const time = e.allDay
    ? "all day"
    : start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <a
      key={`${e.calendar}-${e.id}`}
      href={e.hangoutLink ?? e.url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2.5 py-1 text-[12.5px] hover:opacity-80"
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
    </a>
  );
}

function CalendarSection() {
  const { data } = usePoll<CalResp>("/api/calendar", 60_000);
  const events = data && "events" in data ? data.events : [];
  const upcoming = events.filter((e) => new Date(e.end).getTime() > Date.now());

  const grouped: Record<Bucket, CalEvent[]> = { today: [], tomorrow: [], later: [] };
  for (const e of upcoming) grouped[bucketOf(new Date(e.start))].push(e);

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
            ? `${BUCKET_LABEL[b]} · from ${format(new Date(items[0].start), "EEE MMM d")}`
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
  const { data } = usePoll<GmailResp>("/api/gmail", 60_000);
  const messages = data && "messages" in data ? data.messages : [];
  const unread = messages.filter((m) => m.unread).length;
  return (
    <SectionMini title="Inbox" count={unread} accent="gmail">
      {messages.slice(0, 5).map((m) => (
        <a
          key={m.id}
          href={m.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 py-1 text-[12.5px] hover:opacity-80"
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
        </a>
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

function KnowledgeSection() {
  const { data } = usePoll<{ categories: CategoryStats[] }>("/api/kb", 5 * 60_000);
  const recent = (data?.categories ?? [])
    .filter((c) => c.lastCompileAt || c.lastRawAt)
    .sort(
      (a, b) =>
        (b.lastCompileAt ?? b.lastRawAt ?? 0) -
        (a.lastCompileAt ?? a.lastRawAt ?? 0),
    )
    .slice(0, 5);
  return (
    <SectionMini title="Knowledge" accent="agent">
      {recent.map((c) => {
        const stamp = c.lastCompileAt ?? c.lastRawAt ?? 0;
        return (
          <div
            key={c.name}
            className="flex items-baseline gap-1.5 py-1 text-[12px]"
          >
            <Note s={11} c="var(--c-agent)" />
            <span className="flex-1" style={{ letterSpacing: "-0.005em" }}>
              <span className="text-fg-soft">{c.name} / </span>
              <span className="text-fg">
                {c.wikiCount + c.outputCount} pages
              </span>
            </span>
            <span className="t-mono text-fg-soft" style={{ fontSize: 10 }}>
              {ago(stamp)}
            </span>
          </div>
        );
      })}
      {recent.length === 0 && (
        <p className="text-[12px] text-fg-soft py-1">Nothing compiled yet.</p>
      )}
    </SectionMini>
  );
}

function ErrorsSection() {
  const { data } = usePoll<{ errors: ErrorRow[] }>("/api/errors", 60_000);
  const errs = (data?.errors ?? []).slice(0, 4);
  return (
    <SectionMini title="Errors" count={errs.length} accent="error">
      {errs.map((e) => (
        <div key={e.id} className="py-1" style={{ fontSize: 12, lineHeight: 1.45 }}>
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
      ))}
      {errs.length === 0 && (
        <p className="text-[12px] text-fg-soft py-1">No recent errors.</p>
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
