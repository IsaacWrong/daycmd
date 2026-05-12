import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "ai-os.db");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

declare global {
  // eslint-disable-next-line no-var
  var __aios_db: Database.Database | undefined;
}

export const db =
  globalThis.__aios_db ??
  (globalThis.__aios_db = (() => {
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
    return d;
  })());
