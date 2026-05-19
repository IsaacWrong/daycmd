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
  last_error: string | null;
  last_error_at: number | null;
};

function loadToken(): StoredToken | null {
  const row = db
    .prepare(
      "SELECT access_token, refresh_token, expires_at, scope, last_error, last_error_at FROM oauth_tokens WHERE provider = ?",
    )
    .get("google") as StoredToken | undefined;
  return row ?? null;
}

const REAUTH_ERROR_PATTERN =
  /invalid_grant|invalid_token|invalid_client|invalid_rapt|unauthorized_client|token has been expired or revoked|bad request/i;

export function recordError(message: string): void {
  db.prepare(
    "UPDATE oauth_tokens SET last_error = ?, last_error_at = ? WHERE provider = ?",
  ).run(message.slice(0, 500), Date.now(), "google");
}

export function clearError(): void {
  db.prepare(
    "UPDATE oauth_tokens SET last_error = NULL, last_error_at = NULL WHERE provider = ? AND last_error IS NOT NULL",
  ).run("google");
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
      // A fresh refresh means whatever was failing is no longer failing.
      clearError();
    }
  });
  return c;
}

export function disconnect(): void {
  db.prepare("DELETE FROM oauth_tokens WHERE provider = ?").run("google");
}

export type GoogleStatus = {
  configured: boolean;
  connected: boolean;
  needsReauth: boolean;
  lastError: string | null;
  lastErrorAt: number | null;
};

export function status(): GoogleStatus {
  const t = loadToken();
  const lastError = t?.last_error ?? null;
  const needsReauth = !!lastError && REAUTH_ERROR_PATTERN.test(lastError);
  return {
    configured: googleConfigured(),
    connected: !!t,
    needsReauth,
    lastError,
    lastErrorAt: t?.last_error_at ?? null,
  };
}
