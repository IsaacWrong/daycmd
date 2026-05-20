import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "secrets.db");
const LEGACY_DB_PATHS = [
  path.join(DATA_DIR, "daycmd.db"),
  path.join(DATA_DIR, "ai-os.db"),
];

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// One-shot rename of any legacy DB file (and its sqlite WAL/SHM sidecars) to
// the new name. Reflects the post-vault-migration intent: this DB is now only
// for device-local secrets and caches, not user data.
if (!fs.existsSync(DB_PATH)) {
  for (const legacy of LEGACY_DB_PATHS) {
    if (!fs.existsSync(legacy)) continue;
    try {
      fs.renameSync(legacy, DB_PATH);
      for (const ext of ["-wal", "-shm"]) {
        const from = legacy + ext;
        const to = DB_PATH + ext;
        if (fs.existsSync(from)) {
          try { fs.renameSync(from, to); } catch {}
        }
      }
      break;
    } catch {
      // fall through — better-sqlite3 will just create a fresh DB at DB_PATH
    }
  }
}

declare global {
  var __daycmd_db: Database.Database | undefined;
}

export const db =
  globalThis.__daycmd_db ??
  (globalThis.__daycmd_db = (() => {
    const d = new Database(DB_PATH);
    d.pragma("journal_mode = WAL");
    d.exec(`
      CREATE TABLE IF NOT EXISTS oauth_tokens (
        provider TEXT PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at INTEGER,
        scope TEXT,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER NOT NULL,
        source TEXT NOT NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cache_read_tokens INTEGER NOT NULL DEFAULT 0,
        cache_write_tokens INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_agent_usage_ts ON agent_usage(ts);
      CREATE TABLE IF NOT EXISTS automations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        cron TEXT NOT NULL,
        prompt TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        last_run_at INTEGER,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS automation_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        automation_id INTEGER NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        ok INTEGER,
        output TEXT,
        error TEXT,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        cache_read_tokens INTEGER DEFAULT 0,
        cache_write_tokens INTEGER DEFAULT 0,
        FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_runs_aid ON automation_runs(automation_id, started_at DESC);
      CREATE TABLE IF NOT EXISTS kb_compiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        ok INTEGER,
        summary TEXT,
        error TEXT,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        cache_read_tokens INTEGER DEFAULT 0,
        cache_write_tokens INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_compiles_cat ON kb_compiles(category, started_at DESC);
    `);
    // Migrations for older databases
    try {
      d.exec("ALTER TABLE automations ADD COLUMN kind TEXT NOT NULL DEFAULT 'agent'");
    } catch {}
    try {
      d.exec("ALTER TABLE automations ADD COLUMN target_category TEXT");
    } catch {}
    d.exec(`
      CREATE TABLE IF NOT EXISTS error_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER NOT NULL,
        source TEXT NOT NULL,
        message TEXT NOT NULL,
        context TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_error_log_ts ON error_log(ts DESC);
    `);
    try {
      d.exec("ALTER TABLE error_log ADD COLUMN resolved_at INTEGER");
    } catch {}
    try {
      d.exec("ALTER TABLE oauth_tokens ADD COLUMN last_error TEXT");
    } catch {}
    try {
      d.exec("ALTER TABLE oauth_tokens ADD COLUMN last_error_at INTEGER");
    } catch {}
    // Recipients the user has previously approved a gmail_send to — used by
    // the per-tool confirmation flow to display "previously approved" so the
    // user can disambiguate first-time sends from repeat sends. Storing
    // approvals doesn't skip confirmation; the gate still fires every time.
    d.exec(`
      CREATE TABLE IF NOT EXISTS gmail_allowed_recipients (
        email TEXT PRIMARY KEY,
        first_approved_at INTEGER NOT NULL,
        last_approved_at INTEGER NOT NULL,
        approval_count INTEGER NOT NULL DEFAULT 1
      );
    `);
    return d;
  })());

function normalizeEmail(addr: string): string {
  // Strip "Display Name <foo@bar>" → "foo@bar" and lowercase.
  const m = /<([^>]+)>/.exec(addr);
  return (m ? m[1] : addr).trim().toLowerCase();
}

export function isAllowedRecipient(email: string): boolean {
  const norm = normalizeEmail(email);
  if (!norm) return false;
  const row = db
    .prepare("SELECT email FROM gmail_allowed_recipients WHERE email = ?")
    .get(norm) as { email: string } | undefined;
  return !!row;
}

export function recordAllowedRecipient(email: string): void {
  const norm = normalizeEmail(email);
  if (!norm) return;
  const now = Date.now();
  db.prepare(
    `INSERT INTO gmail_allowed_recipients (email, first_approved_at, last_approved_at, approval_count)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(email) DO UPDATE SET
       last_approved_at = excluded.last_approved_at,
       approval_count = approval_count + 1`,
  ).run(norm, now, now);
}
