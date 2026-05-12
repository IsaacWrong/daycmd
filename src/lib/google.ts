import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { db } from "./db";
import { env } from "./config";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "email",
  "profile",
];

export function googleConfigured(): boolean {
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

type StoredToken = {
  access_token: string;
  refresh_token: string | null;
  expires_at: number | null;
  scope: string | null;
};

function loadToken(): StoredToken | null {
  const row = db
    .prepare(
      "SELECT access_token, refresh_token, expires_at, scope FROM oauth_tokens WHERE provider = ?",
    )
    .get("google") as StoredToken | undefined;
  return row ?? null;
}

function saveToken(t: {
  access_token: string;
  refresh_token?: string | null;
  expiry_date?: number | null;
  scope?: string | null;
}) {
  const existing = loadToken();
  const refresh = t.refresh_token ?? existing?.refresh_token ?? null;
  db.prepare(
    `INSERT INTO oauth_tokens (provider, access_token, refresh_token, expires_at, scope, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(provider) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = COALESCE(excluded.refresh_token, oauth_tokens.refresh_token),
       expires_at = excluded.expires_at,
       scope = excluded.scope,
       updated_at = excluded.updated_at`,
  ).run(
    "google",
    t.access_token,
    refresh,
    t.expiry_date ?? null,
    t.scope ?? null,
    Date.now(),
  );
}

export function makeClient(): OAuth2Client {
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );
}

export function authUrl(): string {
  const c = makeClient();
  return c.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

export async function exchangeCode(code: string): Promise<void> {
  const c = makeClient();
  const { tokens } = await c.getToken(code);
  if (!tokens.access_token) throw new Error("no access_token returned");
  saveToken({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expiry_date: tokens.expiry_date ?? null,
    scope: tokens.scope ?? null,
  });
}

export async function getClient(): Promise<OAuth2Client | null> {
  const stored = loadToken();
  if (!stored) return null;
  const c = makeClient();
  c.setCredentials({
    access_token: stored.access_token,
    refresh_token: stored.refresh_token ?? undefined,
    expiry_date: stored.expires_at ?? undefined,
    scope: stored.scope ?? undefined,
  });
  c.on("tokens", (t) => {
    if (t.access_token) {
      saveToken({
        access_token: t.access_token,
        refresh_token: t.refresh_token ?? null,
        expiry_date: t.expiry_date ?? null,
        scope: t.scope ?? null,
      });
    }
  });
  return c;
}

export function disconnect(): void {
  db.prepare("DELETE FROM oauth_tokens WHERE provider = ?").run("google");
}

export function status(): {
  configured: boolean;
  connected: boolean;
} {
  return { configured: googleConfigured(), connected: !!loadToken() };
}
