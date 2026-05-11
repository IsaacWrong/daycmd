import { google } from "googleapis";
import { getClient } from "./google";

export type GmailMsg = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
  url: string;
};

function header(
  headers: Array<{ name?: string | null; value?: string | null }>,
  name: string,
): string {
  const h = headers.find(
    (x) => x.name?.toLowerCase() === name.toLowerCase(),
  );
  return h?.value ?? "";
}

export async function getInbox(max = 10): Promise<GmailMsg[]> {
  const auth = await getClient();
  if (!auth) throw new Error("not connected");
  const gmail = google.gmail({ version: "v1", auth });

  const list = await gmail.users.messages.list({
    userId: "me",
    q: "in:inbox -category:promotions -category:social",
    maxResults: max,
  });

  const ids = list.data.messages ?? [];
  const msgs = await Promise.all(
    ids.map((m) =>
      gmail.users.messages.get({
        userId: "me",
        id: m.id!,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      }),
    ),
  );

  return msgs.map((r): GmailMsg => {
    const d = r.data;
    const headers = d.payload?.headers ?? [];
    return {
      id: d.id!,
      threadId: d.threadId!,
      from: header(headers, "From"),
      subject: header(headers, "Subject"),
      snippet: d.snippet ?? "",
      date: header(headers, "Date"),
      unread: (d.labelIds ?? []).includes("UNREAD"),
      url: `https://mail.google.com/mail/u/0/#inbox/${d.threadId}`,
    };
  });
}
