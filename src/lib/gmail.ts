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

async function gmailClient() {
  const auth = await getClient();
  if (!auth) throw new Error("not connected");
  return google.gmail({ version: "v1", auth });
}

export type InboxResult = {
  messages: GmailMsg[];
  query: string;
  returned: number;
  estimatedTotal: number;
};

export async function getInbox(
  opts: { max?: number; query?: string } = {},
): Promise<InboxResult> {
  const gmail = await gmailClient();
  const max = Math.max(1, Math.min(50, opts.max ?? 10));
  const q = opts.query ?? "in:inbox -category:promotions -category:social";

  const list = await gmail.users.messages.list({
    userId: "me",
    q,
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

  const messages = msgs.map((r): GmailMsg => {
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

  return {
    messages,
    query: q,
    returned: messages.length,
    estimatedTotal: list.data.resultSizeEstimate ?? messages.length,
  };
}

export async function getMessageDetail(messageId: string): Promise<{
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
}> {
  const gmail = await gmailClient();
  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });
  const d = res.data;
  const headers = d.payload?.headers ?? [];

  function findBody(part: typeof d.payload): string {
    if (!part) return "";
    if (part.body?.data && part.mimeType === "text/plain") {
      return Buffer.from(part.body.data, "base64").toString("utf8");
    }
    for (const p of part.parts ?? []) {
      const got = findBody(p);
      if (got) return got;
    }
    if (part.body?.data) {
      return Buffer.from(part.body.data, "base64").toString("utf8");
    }
    return "";
  }

  return {
    id: d.id!,
    threadId: d.threadId!,
    from: header(headers, "From"),
    to: header(headers, "To"),
    subject: header(headers, "Subject"),
    date: header(headers, "Date"),
    body: findBody(d.payload).slice(0, 20000),
  };
}

async function modifyLabels(
  messageId: string,
  add: string[],
  remove: string[],
): Promise<{ ok: true }> {
  const gmail = await gmailClient();
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: { addLabelIds: add, removeLabelIds: remove },
  });
  return { ok: true };
}

export const archiveMessage = (id: string) => modifyLabels(id, [], ["INBOX"]);
export const markRead = (id: string) => modifyLabels(id, [], ["UNREAD"]);
export const markUnread = (id: string) => modifyLabels(id, ["UNREAD"], []);
export const starMessage = (id: string) => modifyLabels(id, ["STARRED"], []);
export const unstarMessage = (id: string) => modifyLabels(id, [], ["STARRED"]);

export async function trashMessage(messageId: string): Promise<{ ok: true }> {
  const gmail = await gmailClient();
  await gmail.users.messages.trash({ userId: "me", id: messageId });
  return { ok: true };
}

async function getMyAddress(): Promise<string> {
  const gmail = await gmailClient();
  const profile = await gmail.users.getProfile({ userId: "me" });
  return profile.data.emailAddress ?? "me";
}

function encodeRfc822({
  to,
  from,
  subject,
  body,
  inReplyTo,
  references,
}: {
  to: string;
  from: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
  ];
  if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`);
  if (references) lines.push(`References: ${references}`);
  lines.push("", body);
  return Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createDraft(input: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ ok: true; draftId: string; url: string }> {
  const gmail = await gmailClient();
  const from = await getMyAddress();
  const raw = encodeRfc822({
    to: input.to,
    from,
    subject: input.subject,
    body: input.body,
  });
  const res = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw } },
  });
  return {
    ok: true,
    draftId: res.data.id ?? "",
    url: "https://mail.google.com/mail/u/0/#drafts",
  };
}

export async function createReplyDraft(input: {
  threadId: string;
  body: string;
}): Promise<{ ok: true; draftId: string; url: string }> {
  const gmail = await gmailClient();
  const from = await getMyAddress();

  const thread = await gmail.users.threads.get({
    userId: "me",
    id: input.threadId,
    format: "metadata",
    metadataHeaders: ["From", "Subject", "Message-ID", "References"],
  });
  const last = (thread.data.messages ?? []).slice(-1)[0];
  if (!last) throw new Error("thread has no messages");
  const headers = last.payload?.headers ?? [];
  const replyTo = header(headers, "From");
  const origSubject = header(headers, "Subject");
  const messageId = header(headers, "Message-ID");
  const existingRefs = header(headers, "References");
  const subject = origSubject.toLowerCase().startsWith("re:")
    ? origSubject
    : `Re: ${origSubject}`;
  const references = existingRefs
    ? `${existingRefs} ${messageId}`
    : messageId;

  const raw = encodeRfc822({
    to: replyTo,
    from,
    subject,
    body: input.body,
    inReplyTo: messageId,
    references,
  });

  const res = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: { raw, threadId: input.threadId },
    },
  });
  return {
    ok: true,
    draftId: res.data.id ?? "",
    url: `https://mail.google.com/mail/u/0/#drafts?compose=${res.data.message?.id ?? ""}`,
  };
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ ok: true; messageId: string }> {
  const gmail = await gmailClient();
  const from = await getMyAddress();
  const raw = encodeRfc822({
    to: input.to,
    from,
    subject: input.subject,
    body: input.body,
  });
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
  return { ok: true, messageId: res.data.id ?? "" };
}
