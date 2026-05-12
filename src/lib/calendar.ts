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

  const res = await cal.events.list({
    calendarId: "primary",
    timeMin: now.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 25,
  });

  return (res.data.items ?? []).map((e): CalEvent => {
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
    };
  });
}
