"use client";

import type { CalEvent, CalendarInfo } from "@/lib/calendar";
import { mutateCache, useResource } from "@/lib/hooks";

export type RangeKey = { from: string; to: string };

export type CalendarRangeResp =
  | { events: CalEvent[]; configured: boolean; connected: boolean }
  | { error: string; configured: boolean; connected: boolean };

export type CalendarsResp =
  | { calendars: CalendarInfo[]; configured: boolean; connected: boolean }
  | { error: string; configured: boolean; connected: boolean };

function rangeKey(from: string, to: string) {
  return `cal:${from}:${to}`;
}

function rangeUrl(from: string, to: string) {
  const q = new URLSearchParams({ from, to });
  return `/api/calendar?${q.toString()}`;
}

export function useCalendarRange({ from, to }: RangeKey) {
  return useResource<CalendarRangeResp>(rangeKey(from, to), rangeUrl(from, to));
}

export function useCalendarList() {
  return useResource<CalendarsResp>("cal:list", "/api/calendar/calendars");
}

type EventDraft = {
  calendarId?: string;
  summary: string;
  start: string;
  end: string;
  allDay?: boolean;
  description?: string;
  location?: string;
  attendees?: string[];
};

function mapEvents(
  resp: CalendarRangeResp | undefined,
  fn: (events: CalEvent[]) => CalEvent[],
): CalendarRangeResp | undefined {
  if (!resp || !("events" in resp)) return resp;
  return { ...resp, events: fn(resp.events) };
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}

async function patchJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}

async function delJSON(url: string): Promise<void> {
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
}

export async function createCalendarEvent(
  range: RangeKey,
  draft: EventDraft,
  meta: { calendar: string; calendarColor: string | null },
): Promise<void> {
  const key = rangeKey(range.from, range.to);
  const url = rangeUrl(range.from, range.to);
  const tempId = `tmp-${crypto.randomUUID()}`;
  const optimistic: CalEvent = {
    id: tempId,
    calendarId: draft.calendarId ?? "primary",
    summary: draft.summary,
    start: draft.start,
    end: draft.end,
    allDay: !!draft.allDay,
    location: draft.location ?? null,
    description: draft.description ?? null,
    url: null,
    hangoutLink: null,
    calendar: meta.calendar,
    calendarColor: meta.calendarColor,
  };
  await mutateCache<CalendarRangeResp>(
    key,
    url,
    (prev) => mapEvents(prev, (evs) => [...evs, optimistic])!,
    async () => {
      await postJSON<{ ok: true; id: string }>("/api/calendar", draft);
    },
  );
}

export async function updateCalendarEvent(
  range: RangeKey,
  event: CalEvent,
  patch: Partial<
    Pick<
      CalEvent,
      "summary" | "start" | "end" | "allDay" | "description" | "location"
    >
  >,
): Promise<void> {
  const key = rangeKey(range.from, range.to);
  const url = rangeUrl(range.from, range.to);
  await mutateCache<CalendarRangeResp>(
    key,
    url,
    (prev) =>
      mapEvents(prev, (evs) =>
        evs.map((e) => (e.id === event.id ? { ...e, ...patch } : e)),
      )!,
    async () => {
      await patchJSON(`/api/calendar/${encodeURIComponent(event.id)}`, {
        calendarId: event.calendarId,
        ...patch,
      });
    },
  );
}

export async function deleteCalendarEvent(
  range: RangeKey,
  event: CalEvent,
): Promise<void> {
  const key = rangeKey(range.from, range.to);
  const url = rangeUrl(range.from, range.to);
  await mutateCache<CalendarRangeResp>(
    key,
    url,
    (prev) => mapEvents(prev, (evs) => evs.filter((e) => e.id !== event.id))!,
    async () => {
      const q = new URLSearchParams({ calendarId: event.calendarId });
      await delJSON(
        `/api/calendar/${encodeURIComponent(event.id)}?${q.toString()}`,
      );
    },
  );
}
