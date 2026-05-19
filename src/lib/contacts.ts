import { google } from "googleapis";
import { getClient } from "./google";

export type Contact = {
  email: string;
  name: string | null;
  count: number;
  lastTs: number;
};

type Cache = { fetchedAt: number; contacts: Contact[] };
let cache: Cache | null = null;
const TTL_MS = 5 * 60_000;

const HEADER_FIELDS = ["From", "To", "Cc", "Bcc", "Date"] as const;

// Parses a header value like '"Name" <a@b.com>, b@c.com'.
export function parseAddressList(raw: string): Array<{ email: string; name: string | null }> {
  if (!raw) return [];
  const out: Array<{ email: string; name: string | null }> = [];
  // Split on commas not inside quotes.
  const parts: string[] = [];
  let buf = "";
  let inQuote = false;
  for (const ch of raw) {
    if (ch === '"') inQuote = !inQuote;
    if (ch === "," && !inQuote) {
      parts.push(buf);
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf);
  for (const p of parts) {
    const s = p.trim();
    if (!s) continue;
    const angle = s.match(/^(.*?)<([^>]+)>\s*$/);
    if (angle) {
      const name = angle[1].replace(/^["\s]+|["\s]+$/g, "");
      const email = angle[2].trim().toLowerCase();
      if (email) out.push({ email, name: name || null });
    } else if (s.includes("@")) {
      out.push({ email: s.toLowerCase(), name: null });
    }
  }
  return out;
}

async function fetchHeaders(q: string, max: number) {
  const auth = await getClient();
  if (!auth) throw new Error("not connected");
  const gmail = google.gmail({ version: "v1", auth });
  const list = await gmail.users.messages.list({ userId: "me", q, maxResults: max });
  const ids = list.data.messages ?? [];
  const msgs = await Promise.all(
    ids.map((m) =>
      gmail.users.messages.get({
        userId: "me",
        id: m.id!,
        format: "metadata",
        metadataHeaders: [...HEADER_FIELDS],
      }),
    ),
  );
  return msgs.map((r) => r.data.payload?.headers ?? []);
}

function header(
  headers: Array<{ name?: string | null; value?: string | null }>,
  name: string,
): string {
  const h = headers.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

async function buildContacts(): Promise<Contact[]> {
  // Sent: addresses I write to (To/Cc/Bcc). Inbox: addresses that write me (From).
  const [sentHeaders, inboxHeaders] = await Promise.all([
    fetchHeaders("in:sent", 100).catch(() => []),
    fetchHeaders("in:inbox -category:promotions -category:social", 100).catch(() => []),
  ]);

  type Agg = { name: string | null; count: number; lastTs: number };
  const acc = new Map<string, Agg>();

  const bump = (email: string, name: string | null, ts: number) => {
    const key = email.toLowerCase();
    const existing = acc.get(key);
    if (existing) {
      existing.count++;
      if (name && !existing.name) existing.name = name;
      if (ts > existing.lastTs) existing.lastTs = ts;
    } else {
      acc.set(key, { name, count: 1, lastTs: ts });
    }
  };

  for (const hdrs of sentHeaders) {
    const dateStr = header(hdrs, "Date");
    const ts = Date.parse(dateStr) || 0;
    for (const field of ["To", "Cc", "Bcc"] as const) {
      const raw = header(hdrs, field);
      for (const a of parseAddressList(raw)) bump(a.email, a.name, ts);
    }
  }
  for (const hdrs of inboxHeaders) {
    const dateStr = header(hdrs, "Date");
    const ts = Date.parse(dateStr) || 0;
    const raw = header(hdrs, "From");
    for (const a of parseAddressList(raw)) bump(a.email, a.name, ts);
  }

  const contacts: Contact[] = [];
  for (const [email, agg] of acc) {
    if (email.includes("noreply") || email.includes("no-reply")) continue;
    if (email.startsWith("mailer-daemon@")) continue;
    contacts.push({ email, name: agg.name, count: agg.count, lastTs: agg.lastTs });
  }
  contacts.sort((a, b) => b.count - a.count || b.lastTs - a.lastTs);
  return contacts;
}

export async function getContacts(forceRefresh = false): Promise<Contact[]> {
  if (!forceRefresh && cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return cache.contacts;
  }
  const contacts = await buildContacts();
  cache = { fetchedAt: Date.now(), contacts };
  return contacts;
}
