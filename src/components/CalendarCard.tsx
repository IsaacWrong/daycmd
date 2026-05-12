"use client";

import { useState } from "react";
import { usePoll } from "@/lib/hooks";
import type { CalEvent } from "@/lib/calendar";
import { format, isToday, isTomorrow } from "date-fns";

type Resp =
  | { events: CalEvent[]; configured: boolean; connected: boolean }
  | { error: string; configured: boolean; connected: boolean };

function timeLabel(e: CalEvent): string {
  if (e.allDay) return "all day";
  const d = new Date(e.start);
  return format(d, "h:mm a");
}

function dayBucket(e: CalEvent): "today" | "tomorrow" | "later" {
  const d = new Date(e.start);
  if (isToday(d)) return "today";
  if (isTomorrow(d)) return "tomorrow";
  return "later";
}

function toIsoLocal(date: string, time: string): string {
  const [h, m] = time.split(":").map((s) => parseInt(s, 10));
  const [y, mo, d] = date.split("-").map((s) => parseInt(s, 10));
  const dt = new Date(y, mo - 1, d, h, m, 0, 0);
  const off = -dt.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}` +
    `T${pad(dt.getHours())}:${pad(dt.getMinutes())}:00` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

function defaultDateTime(): { date: string; time: string } {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function CalendarCard() {
  const { data, error, refresh } = usePoll<Resp>("/api/calendar", 60_000);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const initial = defaultDateTime();
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [duration, setDuration] = useState(60);
  const [location, setLocation] = useState("");

  const connected = data && "connected" in data && data.connected;

  function resetForm() {
    setTitle("");
    setLocation("");
    const i = defaultDateTime();
    setDate(i.date);
    setTime(i.time);
    setDuration(60);
    setFormError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const startIso = toIsoLocal(date, time);
      const startMs = new Date(startIso).getTime();
      const endIso = new Date(startMs + duration * 60_000).toISOString();
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          summary: title.trim(),
          start: startIso,
          end: endIso,
          ...(location.trim() ? { location: location.trim() } : {}),
        }),
      });
      const j = (await res.json()) as { error?: string; hint?: string; url?: string };
      if (!res.ok) {
        setFormError(j.hint ? `${j.error} — ${j.hint}` : j.error ?? `HTTP ${res.status}`);
        return;
      }
      resetForm();
      setShowForm(false);
      refresh?.();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const buckets = { today: [] as CalEvent[], tomorrow: [] as CalEvent[], later: [] as CalEvent[] };
  if (data && "events" in data) {
    for (const e of data.events) buckets[dayBucket(e)].push(e);
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 min-h-[240px]">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
          Calendar
        </h2>
        {connected && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="text-xs px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700"
            title="Add event to primary calendar"
          >
            {showForm ? "Cancel" : "+ Add"}
          </button>
        )}
      </header>

      {showForm && (
        <form
          onSubmit={submit}
          className="mb-3 p-3 rounded-md border border-zinc-800 bg-zinc-950 space-y-2"
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            autoFocus
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm text-zinc-100"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm text-zinc-100"
            />
            <select
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value, 10))}
              className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm text-zinc-100"
              title="Duration"
            >
              <option value={15}>15m</option>
              <option value={30}>30m</option>
              <option value={45}>45m</option>
              <option value={60}>1h</option>
              <option value={90}>1.5h</option>
              <option value={120}>2h</option>
              <option value={180}>3h</option>
            </select>
          </div>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (optional)"
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600"
          />
          {formError && <p className="text-xs text-red-400">{formError}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="text-xs px-3 py-1 rounded bg-zinc-100 text-zinc-900 font-medium hover:bg-white disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Create"}
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      {!data && !error && <p className="text-sm text-zinc-500">Loading…</p>}

      {data && "error" in data && !data.configured && (
        <p className="text-sm text-zinc-500">Google not configured.</p>
      )}
      {data && "error" in data && data.configured && !data.connected && (
        <a
          href="/api/auth/google"
          className="inline-block text-sm rounded-md bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-zinc-100"
        >
          Connect Google
        </a>
      )}

      {data && "events" in data && (
        <div className="space-y-4">
          {(["today", "tomorrow", "later"] as const).map((bucket) => {
            const items = buckets[bucket];
            if (!items.length) return null;
            return (
              <div key={bucket}>
                <h3 className="text-xs font-semibold text-zinc-300 mb-1 capitalize">
                  {bucket}
                </h3>
                <ul className="space-y-0.5">
                  {items.slice(0, 6).map((e) => (
                    <li
                      key={`${e.calendar}-${e.id}`}
                      className="flex items-baseline gap-2 text-sm"
                    >
                      <span className="text-xs text-zinc-500 w-20 shrink-0">
                        {timeLabel(e)}
                      </span>
                      {e.calendarColor && (
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: e.calendarColor }}
                          title={e.calendar}
                        />
                      )}
                      <a
                        href={e.hangoutLink ?? e.url ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 truncate text-zinc-200 hover:text-zinc-50"
                        title={`${e.summary} · ${e.calendar}`}
                      >
                        {e.summary}
                      </a></li>
                  ))}
                </ul>
              </div>
            );
          })}
          {!buckets.today.length &&
            !buckets.tomorrow.length &&
            !buckets.later.length && (
              <p className="text-sm text-zinc-500">No upcoming events.</p>
            )}
        </div>
      )}
    </section>
  );
}
