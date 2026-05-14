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

export type UnsubscribeResult =
  | { ok: true; method: "one_click_post"; url: string }
  | { ok: true; method: "mailto"; address: string }
  | { ok: false; method: "manual_url"; url: string; reason: "no_one_click" }
  | { ok: false; method: "none"; reason: "no_unsubscribe_header" }
  | { ok: false; method: string; error: string };

function parseUnsubscribeHeader(value: string): { urls: string[]; mailtos: string[] } {
  const urls: string[] = [];
  const mailtos: string[] = [];
  const matches = value.match(/<([^>]+)>/g) ?? [];
  for (const m of matches) {
    const inner = m.slice(1, -1).trim();
    if (inner.toLowerCase().startsWith("mailto:")) mailtos.push(inner.slice(7));
    else if (/^https?:/i.test(inner)) urls.push(inner);
  }
  return { urls, mailtos };
}

export async function unsubscribeMessage(
  messageId: string,
): Promise<UnsubscribeResult> {
  const gmail = await gmailClient();
  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "metadata",
    metadataHeaders: ["List-Unsubscribe", "List-Unsubscribe-Post", "From", "Subject"],
  });
  const headers = res.data.payload?.headers ?? [];
  const luHeader = header(headers, "List-Unsubscribe");
  const lupHeader = header(headers, "List-Unsubscribe-Post");

  if (!luHeader) {
    return { ok: false, method: "none", reason: "no_unsubscribe_header" };
  }

  const { urls, mailtos } = parseUnsubscribeHeader(luHeader);
  const oneClick = /one-click/i.test(lupHeader);

  // Prefer one-click POST when supported
  if (oneClick && urls.length > 0) {
    const url = urls[0];
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      });
      if (r.ok || (r.status >= 200 && r.status < 400)) {
        return { ok: true, method: "one_click_post", url };
      }
      return { ok: false, method: "one_click_post", error: `HTTP ${r.status}` };
    } catch (e) {
      return { ok: false, method: "one_click_post", error: (e as Error).message };
    }
  }

  // Fallback to mailto
  if (mailtos.length > 0) {
    try {
      const from = await getMyAddress();
      const raw = encodeRfc822({
        to: mailtos[0],
        from,
        subject: "unsubscribe",
        body: "Please remove this address from the mailing list.",
      });
      await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw },
      });
      return { ok: true, method: "mailto", address: mailtos[0] };
    } catch (e) {
      return { ok: false, method: "mailto", error: (e as Error).message };
    }
  }

  // Bare URL — needs human click
  if (urls.length > 0) {
    return { ok: false, method: "manual_url", url: urls[0], reason: "no_one_click" };
  }

  return { ok: false, method: "none", reason: "no_unsubscribe_header" };
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

// ─── Thread-level API ─────────────────────────────────────────────

export type ThreadSummary = {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
  starred: boolean;
  messageCount: number;
  hasUnsubscribe: boolean;
  labelIds: string[];
};

export type LabelInfo = {
  id: string;
  name: string;
  type: "system" | "user";
  color: string | null;
  unread: number;
  total: number;
};

export type ParsedMessage = {
  id: string;
  threadId: string;
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  unread: boolean;
  starred: boolean;
  bodyHtml: string;
  bodyText: string;
  hasUnsubscribe: boolean;
  isMe: boolean;
};

export type ThreadDetail = {
  id: string;
  subject: string;
  messages: ParsedMessage[];
  labelIds: string[];
};

function parseFromHeader(value: string): { name: string; email: string } {
  // "Display Name <addr@x.com>" or "addr@x.com"
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(value);
  if (m) return { name: m[1].replace(/^"|"$/g, "") || m[2], email: m[2] };
  return { name: value, email: value };
}

type GmailPart = {
  mimeType?: string | null;
  filename?: string | null;
  body?: { data?: string | null; size?: number | null } | null;
  parts?: GmailPart[] | null;
};

function findBodyPart(part: GmailPart | null | undefined, mime: string): string {
  if (!part) return "";
  if (
    part.mimeType === mime &&
    part.body?.data &&
    !(part.filename && part.filename.length > 0)
  ) {
    return Buffer.from(part.body.data, "base64").toString("utf8");
  }
  for (const p of part.parts ?? []) {
    const got = findBodyPart(p, mime);
    if (got) return got;
  }
  return "";
}

export async function listThreads(
  opts: { max?: number; query?: string; labelIds?: string[] } = {},
): Promise<ThreadSummary[]> {
  const gmail = await gmailClient();
  const max = Math.max(1, Math.min(100, opts.max ?? 50));
  const q = opts.query;

  const list = await gmail.users.threads.list({
    userId: "me",
    q,
    labelIds: opts.labelIds,
    maxResults: max,
  });
  const ids = list.data.threads ?? [];

  const threads = await Promise.all(
    ids.map((t) =>
      gmail.users.threads.get({
        userId: "me",
        id: t.id!,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date", "List-Unsubscribe"],
      }),
    ),
  );

  return threads.map((r): ThreadSummary => {
    const msgs = r.data.messages ?? [];
    const last = msgs[msgs.length - 1] ?? msgs[0];
    const headers = last?.payload?.headers ?? [];
    const fromRaw = header(headers, "From");
    const { name, email } = parseFromHeader(fromRaw);
    const unread = msgs.some((m) =>
      (m.labelIds ?? []).includes("UNREAD"),
    );
    const starred = msgs.some((m) =>
      (m.labelIds ?? []).includes("STARRED"),
    );
    const hasUnsubscribe = msgs.some((m) => {
      const h = m.payload?.headers ?? [];
      return !!header(h, "List-Unsubscribe");
    });
    // Union of label IDs across all messages in the thread.
    const labelIds = Array.from(
      new Set(msgs.flatMap((m) => m.labelIds ?? [])),
    );
    return {
      id: r.data.id!,
      from: name,
      fromEmail: email,
      subject: header(headers, "Subject"),
      snippet: r.data.snippet ?? "",
      date: header(headers, "Date"),
      unread,
      starred,
      messageCount: msgs.length,
      hasUnsubscribe,
      labelIds,
    };
  });
}

export async function listLabels(): Promise<LabelInfo[]> {
  const gmail = await gmailClient();
  const res = await gmail.users.labels.list({ userId: "me" });
  const items = res.data.labels ?? [];
  // Hydrate counts + colors. labels.list only returns name+id; need labels.get for counts.
  const details = await Promise.all(
    items.map((l) =>
      gmail.users.labels.get({ userId: "me", id: l.id! }),
    ),
  );
  return details.map((r): LabelInfo => {
    const d = r.data;
    return {
      id: d.id!,
      name: d.name ?? "",
      type: d.type === "user" ? "user" : "system",
      color: d.color?.backgroundColor ?? null,
      unread: d.threadsUnread ?? 0,
      total: d.threadsTotal ?? 0,
    };
  });
}

export async function getThread(threadId: string): Promise<ThreadDetail> {
  const gmail = await gmailClient();
  const [res, myEmail] = await Promise.all([
    gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    }),
    getMyAddress(),
  ]);
  const myEmailLower = myEmail.toLowerCase();
  const labelIdsAll = (res.data.messages ?? []).map((m) => m.labelIds ?? []);
  const messages: ParsedMessage[] = (res.data.messages ?? []).map((m, i) => {
    const headers = m.payload?.headers ?? [];
    const labelIds = labelIdsAll[i];
    const payload = m.payload as GmailPart | null | undefined;
    const html = findBodyPart(payload, "text/html");
    const text = findBodyPart(payload, "text/plain");
    const fromRaw = header(headers, "From");
    const fromEmail = parseFromHeader(fromRaw).email.toLowerCase();
    const isMe =
      labelIds.includes("SENT") || fromEmail === myEmailLower;
    return {
      id: m.id!,
      threadId: m.threadId!,
      from: fromRaw,
      to: header(headers, "To"),
      cc: header(headers, "Cc"),
      subject: header(headers, "Subject"),
      date: header(headers, "Date"),
      unread: labelIds.includes("UNREAD"),
      starred: labelIds.includes("STARRED"),
      bodyHtml: html,
      bodyText: text,
      hasUnsubscribe: !!header(headers, "List-Unsubscribe"),
      isMe,
    };
  });
  const firstSubject = messages[0]?.subject ?? "";
  const labelIds = Array.from(new Set(labelIdsAll.flat()));
  return { id: res.data.id!, subject: firstSubject, messages, labelIds };
}

export async function modifyThread(
  threadId: string,
  patch: { addLabelIds?: string[]; removeLabelIds?: string[] },
): Promise<{ ok: true }> {
  const gmail = await gmailClient();
  await gmail.users.threads.modify({
    userId: "me",
    id: threadId,
    requestBody: {
      addLabelIds: patch.addLabelIds,
      removeLabelIds: patch.removeLabelIds,
    },
  });
  return { ok: true };
}

export const archiveThread = (id: string) =>
  modifyThread(id, { removeLabelIds: ["INBOX"] });
export const markThreadRead = (id: string) =>
  modifyThread(id, { removeLabelIds: ["UNREAD"] });
export const markThreadUnread = (id: string) =>
  modifyThread(id, { addLabelIds: ["UNREAD"] });
export const starThread = (id: string) =>
  modifyThread(id, { addLabelIds: ["STARRED"] });
export const unstarThread = (id: string) =>
  modifyThread(id, { removeLabelIds: ["STARRED"] });

export async function trashThread(threadId: string): Promise<{ ok: true }> {
  const gmail = await gmailClient();
  await gmail.users.threads.trash({ userId: "me", id: threadId });
  return { ok: true };
}

// ─── Drafts ─────────────────────────────────────────────────────

export type DraftSummary = {
  id: string;
  messageId: string;
  threadId: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  isReply: boolean;
};

export type DraftDetail = {
  id: string;
  messageId: string;
  threadId: string;
  to: string;
  cc: string;
  subject: string;
  body: string;
  isReply: boolean;
};

function buildReplyHeaders(opts: {
  from: string;
  to: string;
  cc?: string;
  subject: string;
  inReplyTo?: string;
  references?: string;
  body: string;
}): string {
  const lines = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
  ];
  if (opts.cc) lines.push(`Cc: ${opts.cc}`);
  lines.push(
    `Subject: ${opts.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
  );
  if (opts.inReplyTo) lines.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) lines.push(`References: ${opts.references}`);
  lines.push("", opts.body);
  return Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function listDrafts(
  opts: { max?: number } = {},
): Promise<DraftSummary[]> {
  const gmail = await gmailClient();
  const max = Math.max(1, Math.min(100, opts.max ?? 50));
  const list = await gmail.users.drafts.list({ userId: "me", maxResults: max });
  const ids = list.data.drafts ?? [];
  const details = await Promise.all(
    ids.map((d) =>
      gmail.users.drafts.get({
        userId: "me",
        id: d.id!,
        format: "metadata",
        // metadataHeaders not supported on drafts.get — fetch metadata format
      }),
    ),
  );
  return details
    .filter((r) => !!r.data.message)
    .map((r): DraftSummary => {
      const msg = r.data.message!;
      const headers = msg.payload?.headers ?? [];
      return {
        id: r.data.id!,
        messageId: msg.id ?? "",
        threadId: msg.threadId ?? "",
        to: header(headers, "To"),
        subject: header(headers, "Subject"),
        snippet: msg.snippet ?? "",
        date: header(headers, "Date") || new Date().toISOString(),
        isReply: !!(msg.threadId && msg.threadId !== msg.id),
      };
    });
}

export async function getDraft(draftId: string): Promise<DraftDetail> {
  const gmail = await gmailClient();
  const res = await gmail.users.drafts.get({
    userId: "me",
    id: draftId,
    format: "full",
  });
  const msg = res.data.message;
  if (!msg) throw new Error("draft has no message");
  const headers = msg.payload?.headers ?? [];
  const payload = msg.payload as GmailPart | null | undefined;
  const text = findBodyPart(payload, "text/plain");
  const html = findBodyPart(payload, "text/html");
  return {
    id: res.data.id!,
    messageId: msg.id ?? "",
    threadId: msg.threadId ?? "",
    to: header(headers, "To"),
    cc: header(headers, "Cc"),
    subject: header(headers, "Subject"),
    body: text || html.replace(/<[^>]+>/g, ""),
    isReply: !!(msg.threadId && msg.threadId !== msg.id),
  };
}

export async function deleteDraft(draftId: string): Promise<{ ok: true }> {
  const gmail = await gmailClient();
  await gmail.users.drafts.delete({ userId: "me", id: draftId });
  return { ok: true };
}

export async function sendDraft(
  draftId: string,
): Promise<{ ok: true; messageId: string }> {
  const gmail = await gmailClient();
  const res = await gmail.users.drafts.send({
    userId: "me",
    requestBody: { id: draftId },
  });
  return { ok: true, messageId: res.data.id ?? "" };
}

export async function upsertReplyDraft(input: {
  draftId?: string;
  threadId: string;
  body: string;
  replyAll?: boolean;
}): Promise<{ ok: true; draftId: string; messageId: string }> {
  const gmail = await gmailClient();
  const from = await getMyAddress();

  const thread = await gmail.users.threads.get({
    userId: "me",
    id: input.threadId,
    format: "metadata",
    metadataHeaders: [
      "From",
      "To",
      "Cc",
      "Subject",
      "Message-ID",
      "References",
      "Reply-To",
    ],
  });
  const last = (thread.data.messages ?? []).slice(-1)[0];
  if (!last) throw new Error("thread has no messages");
  const headers = last.payload?.headers ?? [];
  const replyTo = header(headers, "Reply-To") || header(headers, "From");
  const origTo = header(headers, "To");
  const origCc = header(headers, "Cc");
  const origSubject = header(headers, "Subject");
  const messageId = header(headers, "Message-ID");
  const existingRefs = header(headers, "References");
  const subject = origSubject.toLowerCase().startsWith("re:")
    ? origSubject
    : `Re: ${origSubject}`;
  const references = existingRefs ? `${existingRefs} ${messageId}` : messageId;

  let to = replyTo;
  let cc = "";
  if (input.replyAll) {
    const others = [origTo, origCc]
      .join(",")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && !s.toLowerCase().includes(from.toLowerCase()));
    cc = others.join(", ");
  }

  const raw = buildReplyHeaders({
    from,
    to,
    cc,
    subject,
    inReplyTo: messageId,
    references,
    body: input.body,
  });

  const requestBody = {
    message: { raw, threadId: input.threadId },
  };

  if (input.draftId) {
    const res = await gmail.users.drafts.update({
      userId: "me",
      id: input.draftId,
      requestBody,
    });
    return {
      ok: true,
      draftId: res.data.id ?? input.draftId,
      messageId: res.data.message?.id ?? "",
    };
  }
  const res = await gmail.users.drafts.create({
    userId: "me",
    requestBody,
  });
  return {
    ok: true,
    draftId: res.data.id ?? "",
    messageId: res.data.message?.id ?? "",
  };
}

export async function upsertComposeDraft(input: {
  draftId?: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
}): Promise<{ ok: true; draftId: string; messageId: string }> {
  const gmail = await gmailClient();
  const from = await getMyAddress();
  const raw = buildReplyHeaders({
    from,
    to: input.to,
    cc: input.cc,
    subject: input.subject,
    body: input.body,
  });
  const requestBody = { message: { raw } };
  if (input.draftId) {
    const res = await gmail.users.drafts.update({
      userId: "me",
      id: input.draftId,
      requestBody,
    });
    return {
      ok: true,
      draftId: res.data.id ?? input.draftId,
      messageId: res.data.message?.id ?? "",
    };
  }
  const res = await gmail.users.drafts.create({
    userId: "me",
    requestBody,
  });
  return {
    ok: true,
    draftId: res.data.id ?? "",
    messageId: res.data.message?.id ?? "",
  };
}

export async function sendReply(input: {
  threadId: string;
  body: string;
  replyAll?: boolean;
}): Promise<{ ok: true; messageId: string }> {
  const gmail = await gmailClient();
  const from = await getMyAddress();

  const thread = await gmail.users.threads.get({
    userId: "me",
    id: input.threadId,
    format: "metadata",
    metadataHeaders: [
      "From",
      "To",
      "Cc",
      "Subject",
      "Message-ID",
      "References",
      "Reply-To",
    ],
  });
  const last = (thread.data.messages ?? []).slice(-1)[0];
  if (!last) throw new Error("thread has no messages");
  const headers = last.payload?.headers ?? [];
  const replyTo = header(headers, "Reply-To") || header(headers, "From");
  const origTo = header(headers, "To");
  const origCc = header(headers, "Cc");
  const origSubject = header(headers, "Subject");
  const messageId = header(headers, "Message-ID");
  const existingRefs = header(headers, "References");
  const subject = origSubject.toLowerCase().startsWith("re:")
    ? origSubject
    : `Re: ${origSubject}`;
  const references = existingRefs
    ? `${existingRefs} ${messageId}`
    : messageId;

  let to = replyTo;
  let cc = "";
  if (input.replyAll) {
    const others = [origTo, origCc]
      .join(",")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && !s.includes(from));
    cc = others.join(", ");
  }

  const lines = [
    `From: ${from}`,
    `To: ${to}`,
  ];
  if (cc) lines.push(`Cc: ${cc}`);
  lines.push(
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    `In-Reply-To: ${messageId}`,
    `References: ${references}`,
    "",
    input.body,
  );
  const raw = Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw, threadId: input.threadId },
  });
  return { ok: true, messageId: res.data.id ?? "" };
}
