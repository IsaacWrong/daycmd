import { google } from "googleapis";
import { getClient } from "./google";

export type CalEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
  url: string | null;
  hangoutLink: string | null;
  calendar: string;
  calendarColor: string | null;
};

async function calClient() {
  const auth = await getClient();
  if (!auth) throw new Error("not connected");
  return google.calendar({ version: "v3", auth });
}

export async function createEvent(input: {
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  attendees?: string[];
}): Promise<{ ok: true; id: string; url: string }> {
  const cal = await calClient();
  const res = await cal.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: { dateTime: input.start },
      end: { dateTime: input.end },
      attendees: input.attendees?.map((email) => ({ email })),
    },
  });
  return {
    ok: true,
    id: res.data.id ?? "",
    url: res.data.htmlLink ?? "",
  };
}

export async function rescheduleEvent(input: {
  eventId: string;
  start: string;
  end: string;
}): Promise<{ ok: true; id: string }> {
  const cal = await calClient();
  const res = await cal.events.patch({
    calendarId: "primary",
    eventId: input.eventId,
    requestBody: {
      start: { dateTime: input.start },
      end: { dateTime: input.end },
    },
  });
  return { ok: true, id: res.data.id ?? "" };
}

export async function cancelEvent(eventId: string): Promise<{ ok: true }> {
  const cal = await calClient();
  await cal.events.delete({ calendarId: "primary", eventId });
  return { ok: true };
}

export async function getEvents(hoursAhead = 36): Promise<CalEvent[]> {
  const cal = await calClient();

  const now = new Date();
  const end = new Date(now.getTime() + hoursAhead * 3600 * 1000);

  // List every calendar user has access to (own + shared + subscribed).
  // calendar.readonly scope is sufficient.
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
          timeMin: now.toISOString(),
          timeMax: end.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 50,
        });
        return (r.data.items ?? []).map((e): CalEvent => {
          const start = e.start?.dateTime ?? e.start?.date ?? "";
          const endT = e.end?.dateTime ?? e.end?.date ?? "";
          return {
            id: e.id ?? "",
            summary: e.summary ?? "(no title)",
            start,
            end: endT,
            allDay: !e.start?.dateTime,
            location: e.location ?? null,
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
  return all.slice(0, 50);
}
