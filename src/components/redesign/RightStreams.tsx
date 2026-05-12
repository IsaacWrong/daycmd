"use client";

import { formatDistanceToNowStrict } from "date-fns";
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

function CalendarSection() {
  const { data } = usePoll<CalResp>("/api/calendar", 60_000);
  const events = data && "events" in data ? data.events : [];
  const upcoming = events
    .filter((e) => !e.allDay && new Date(e.end).getTime() > Date.now())
    .slice(0, 5);
  return (
    <SectionMini title="Calendar" count={upcoming.length} accent="calendar">
      {upcoming.map((e) => {
        const start = new Date(e.start);
        const time = start.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        });
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
              style={{ width: 50 }}
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
