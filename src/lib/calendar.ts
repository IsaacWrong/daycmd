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

export async function getEvents(hoursAhead = 36): Promise<CalEvent[]> {
  const auth = await getClient();
  if (!auth) throw new Error("not connected");
  const cal = google.calendar({ version: "v3", auth });

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
