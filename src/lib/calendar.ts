import { google } from "googleapis";
import { getClient } from "./google";

export type CalEvent = {
  id: string;
  calendarId: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
  description: string | null;
  url: string | null;
  hangoutLink: string | null;
  calendar: string;
  calendarColor: string | null;
};

export type CalendarInfo = {
  id: string;
  summary: string;
  color: string | null;
  primary: boolean;
  accessRole: string;
  writable: boolean;
};

export type EventInput = {
  summary?: string;
  start?: string;
  end?: string;
  allDay?: boolean;
  description?: string;
  location?: string;
  attendees?: string[];
};

async function calClient() {
  const auth = await getClient();
  if (!auth) throw new Error("not connected");
  return google.calendar({ version: "v3", auth });
}

function buildTimeField(value: string, allDay: boolean) {
  return allDay ? { date: value } : { dateTime: value };
}

export async function listCalendars(): Promise<CalendarInfo[]> {
  const cal = await calClient();
  const res = await cal.calendarList.list({
    minAccessRole: "reader",
    showHidden: false,
  });
  return (res.data.items ?? [])
    .filter((c) => c.selected !== false && !!c.id)
    .map((c) => {
      const role = c.accessRole ?? "reader";
      return {
        id: c.id!,
        summary: c.summary ?? c.summaryOverride ?? c.id!,
        color: c.backgroundColor ?? null,
        primary: !!c.primary,
        accessRole: role,
        writable: role === "owner" || role === "writer",
      };
    });
}

export async function createEvent(input: {
  calendarId?: string;
  summary: string;
  start: string;
  end: string;
  allDay?: boolean;
  description?: string;
  location?: string;
  attendees?: string[];
}): Promise<{ ok: true; id: string; url: string }> {
  const cal = await calClient();
  const allDay = !!input.allDay;
  const res = await cal.events.insert({
    calendarId: input.calendarId ?? "primary",
    requestBody: {
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: buildTimeField(input.start, allDay),
      end: buildTimeField(input.end, allDay),
      attendees: input.attendees?.map((email) => ({ email })),
    },
  });
  return {
    ok: true,
    id: res.data.id ?? "",
    url: res.data.htmlLink ?? "",
  };
}

export async function updateEvent(input: {
  calendarId?: string;
  eventId: string;
  patch: EventInput;
}): Promise<{ ok: true; id: string }> {
  const cal = await calClient();
  const { patch } = input;
  const allDay = !!patch.allDay;
  const requestBody: Record<string, unknown> = {};
  if (patch.summary !== undefined) requestBody.summary = patch.summary;
  if (patch.description !== undefined) requestBody.description = patch.description;
  if (patch.location !== undefined) requestBody.location = patch.location;
  if (patch.start !== undefined) requestBody.start = buildTimeField(patch.start, allDay);
  if (patch.end !== undefined) requestBody.end = buildTimeField(patch.end, allDay);
  if (patch.attendees !== undefined)
    requestBody.attendees = patch.attendees.map((email) => ({ email }));
  const res = await cal.events.patch({
    calendarId: input.calendarId ?? "primary",
    eventId: input.eventId,
    requestBody,
  });
  return { ok: true, id: res.data.id ?? "" };
}

export async function rescheduleEvent(input: {
  calendarId?: string;
  eventId: string;
  start: string;
  end: string;
  allDay?: boolean;
}): Promise<{ ok: true; id: string }> {
  return updateEvent({
    calendarId: input.calendarId,
    eventId: input.eventId,
    patch: { start: input.start, end: input.end, allDay: input.allDay },
  });
}

export async function cancelEvent(
  eventId: string,
  calendarId: string = "primary",
): Promise<{ ok: true }> {
  const cal = await calClient();
  await cal.events.delete({ calendarId, eventId });
  return { ok: true };
}

export async function getEvents(
  rangeOrHours:
    | number
    | { from: string; to: string; max?: number } = 36,
): Promise<CalEvent[]> {
  const cal = await calClient();

  let timeMin: string;
  let timeMax: string;
  let max = 250;
  if (typeof rangeOrHours === "number") {
    const now = new Date();
    timeMin = now.toISOString();
    timeMax = new Date(now.getTime() + rangeOrHours * 3600 * 1000).toISOString();
    max = 50;
  } else {
    timeMin = rangeOrHours.from;
    timeMax = rangeOrHours.to;
    if (rangeOrHours.max) max = rangeOrHours.max;
  }

  const listRes = await cal.calendarList.list({
    minAccessRole: "reader",
    showHidden: false,
  });
  const calendars = (listRes.data.items ?? []).filter(
    (c) => c.selected !== false,
  );

  const perCal = await Promise.all(
    calendars.map(async (c) => {
      const id = c.id;
      if (!id) return [];
      try {
        const r = await cal.events.list({
          calendarId: id,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: "startTime",
          maxResults: max,
        });
        return (r.data.items ?? []).map((e): CalEvent => {
          const start = e.start?.dateTime ?? e.start?.date ?? "";
          const endT = e.end?.dateTime ?? e.end?.date ?? "";
          return {
            id: e.id ?? "",
            calendarId: id,
            summary: e.summary ?? "(no title)",
            start,
            end: endT,
            allDay: !e.start?.dateTime,
            location: e.location ?? null,
            description: e.description ?? null,
            url: e.htmlLink ?? null,
            hangoutLink: e.hangoutLink ?? null,
            calendar: c.summary ?? c.summaryOverride ?? id,
            calendarColor: c.backgroundColor ?? null,
          };
        });
      } catch (err) {
        console.error(
          `[calendar] failed to fetch ${c.summary ?? id}:`,
          (err as Error).message,
        );
        return [];
      }
    }),
  );

  const all = perCal.flat();
  all.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  return typeof rangeOrHours === "number" ? all.slice(0, 50) : all;
}
