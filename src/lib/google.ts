import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { db } from "./db";
import { env } from "./config";
import { readStateSync, writeStateSync } from "./vault-state";

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

// Cross-device token sync: the refresh_token is mirrored to the Obsidian
// vault so a second device picks it up via Obsidian Sync without a second
// OAuth dance. Access tokens stay per-device — they're short-lived and each
// device refreshes independently to avoid sync write races.
const VAULT_KEY = "auth/google-token";

// Vault entry is either an active token or a "revoked" tombstone. The
// tombstone is how disconnect propagates across devices: other devices see
// it, compare its timestamp against their local row's updated_at, and wipe
// local state if the tombstone is newer. Deleting the file outright would
// just let the other device re-upload its still-valid refresh_token.
type VaultActive = {
  refresh_token: string;
  scope: string | null;
  updated_at: number;
  revoked?: false;
};
type VaultRevoked = {
  revoked: true;
  revoked_at: number;
};
type VaultEntry = VaultActive | VaultRevoked;

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
  updated_at: number;
};

function readVaultEntry(): VaultEntry | null {
  if (!env.VAULT_PATH) return null;
  return readStateSync<VaultEntry>(VAULT_KEY);
}

function writeVaultToken(refresh_token: string, scope: string | null): void {
  if (!env.VAULT_PATH) return;
  try {
    writeStateSync(VAULT_KEY, {
      refresh_token,
      scope,
      updated_at: Date.now(),
    } satisfies VaultActive);
  } catch {
    // best-effort — vault unavailable shouldn't break local auth
  }
}

function writeVaultTombstone(): void {
  if (!env.VAULT_PATH) return;
  try {
    writeStateSync(VAULT_KEY, {
      revoked: true,
      revoked_at: Date.now(),
    } satisfies VaultRevoked);
  } catch {}
}

function loadLocalRow(): StoredToken | null {
  const row = db
    .prepare(
      "SELECT access_token, refresh_token, expires_at, scope, last_error, last_error_at, updated_at FROM oauth_tokens WHERE provider = ?",
    )
    .get("google") as StoredToken | undefined;
  return row ?? null;
}

// Reconcile local DB with vault on every load. Cases:
//   1. Vault tombstone newer than local row — another device disconnected;
//      wipe local row to propagate.
//   2. Vault has refresh_token, local missing — seed local from vault.
//   3. Vault refresh_token differs from local — another device rotated;
//      copy into local (keep our access_token, let next API call refresh).
//   4. Vault empty/missing, local has refresh_token — first run after this
//      change shipped; upload local refresh_token to vault.
function loadToken(): StoredToken | null {
  const local = loadLocalRow();
  const vault = readVaultEntry();

  if (vault && "revoked" in vault && vault.revoked) {
    if (local && vault.revoked_at >= local.updated_at) {
      db.prepare("DELETE FROM oauth_tokens WHERE provider = ?").run("google");
      return null;
    }
    // Tombstone is older than our local row (we re-authed after the remote
    // disconnect). Overwrite the tombstone with our current state.
    if (local?.refresh_token) {
      writeVaultToken(local.refresh_token, local.scope);
    }
    return local;
  }

  if (!vault) {
    if (local?.refresh_token) {
      writeVaultToken(local.refresh_token, local.scope);
    }
    return local;
  }

  if (!local) {
    db.prepare(
      `INSERT INTO oauth_tokens (provider, access_token, refresh_token, expires_at, scope, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider) DO NOTHING`,
    ).run("google", "", vault.refresh_token, null, vault.scope, Date.now());
    return loadLocalRow();
  }

  if (vault.refresh_token && vault.refresh_token !== local.refresh_token) {
    db.prepare(
      "UPDATE oauth_tokens SET refresh_token = ?, scope = COALESCE(?, scope), updated_at = ? WHERE provider = ?",
    ).run(vault.refresh_token, vault.scope, Date.now(), "google");
    return loadLocalRow();
  }
  return local;
}

const REAUTH_ERROR_PATTERN =
  /invalid_grant|invalid_token|invalid_client|invalid_rapt|unauthorized_client|token has been expired or revoked|bad request/i;

export function recordError(message: string): void {
  // Self-heal: on a reauth-class error, another device may have rotated the
  // refresh_token since we last loaded. Check the vault once before flagging
  // reauth so the user doesn't have to redo OAuth needlessly.
  if (REAUTH_ERROR_PATTERN.test(message)) {
    const vault = readVaultEntry();
    const local = loadLocalRow();
    if (
      vault &&
      !("revoked" in vault && vault.revoked) &&
      local &&
      vault.refresh_token !== local.refresh_token
    ) {
      db.prepare(
        "UPDATE oauth_tokens SET refresh_token = ?, last_error = NULL, last_error_at = NULL, updated_at = ? WHERE provider = ?",
      ).run(vault.refresh_token, Date.now(), "google");
      return;
    }
  }
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
  const existing = loadLocalRow();
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

  // Mirror refresh_token to vault only when it changed. Access tokens are
  // per-device — syncing them would just generate write races.
  if (t.refresh_token && t.refresh_token !== existing?.refresh_token) {
    writeVaultToken(t.refresh_token, t.scope ?? existing?.scope ?? null);
  }
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
  if (!stored || (!stored.access_token && !stored.refresh_token)) return null;
  const c = makeClient();
  c.setCredentials({
    access_token: stored.access_token || undefined,
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
      clearError();
    }
  });
  return c;
}

export function disconnect(): void {
  db.prepare("DELETE FROM oauth_tokens WHERE provider = ?").run("google");
  // Write a tombstone (not a delete) so other devices see the disconnect
  // and wipe their own local row on next load. Deleting would let them
  // simply re-upload their still-valid refresh_token.
  writeVaultTombstone();
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
