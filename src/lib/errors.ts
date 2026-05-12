import { db } from "./db";

export type ErrorRow = {
  id: number;
  ts: number;
  source: string;
  message: string;
  context: string | null;
};

export function logError(source: string, message: string, context?: unknown): void {
  try {
    db.prepare(
      "INSERT INTO error_log (ts, source, message, context) VALUES (?, ?, ?, ?)",
    ).run(
      Date.now(),
      source,
      message.slice(0, 4000),
      context ? JSON.stringify(context).slice(0, 4000) : null,
    );
  } catch {
    // never throw from logger
  }
}

export function recentErrors(limit = 20): ErrorRow[] {
  return db
    .prepare("SELECT * FROM error_log ORDER BY ts DESC LIMIT ?")
    .all(limit) as ErrorRow[];
}

export function clearErrors(): void {
  db.prepare("DELETE FROM error_log").run();
}
