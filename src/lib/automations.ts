import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { db } from "./db";
import { runAgentOnce, type UsageTotals } from "./agent";

export type Automation = {
  id: number;
  name: string;
  cron: string;
  prompt: string;
  enabled: boolean;
  last_run_at: number | null;
  created_at: number;
};

type Row = Omit<Automation, "enabled"> & { enabled: number };

function rowToAutomation(r: Row): Automation {
  return { ...r, enabled: !!r.enabled };
}

export function listAutomations(): Automation[] {
  const rows = db
    .prepare(
      "SELECT id, name, cron, prompt, enabled, last_run_at, created_at FROM automations ORDER BY id DESC",
    )
    .all() as Row[];
  return rows.map(rowToAutomation);
}

export function getAutomation(id: number): Automation | null {
  const row = db
    .prepare(
      "SELECT id, name, cron, prompt, enabled, last_run_at, created_at FROM automations WHERE id = ?",
    )
    .get(id) as Row | undefined;
  return row ? rowToAutomation(row) : null;
}

export function createAutomation(input: {
  name: string;
  cron: string;
  prompt: string;
  enabled?: boolean;
}): Automation {
  const info = db
    .prepare(
      "INSERT INTO automations (name, cron, prompt, enabled, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      input.name,
      input.cron,
      input.prompt,
      input.enabled === false ? 0 : 1,
      Date.now(),
    );
  return getAutomation(Number(info.lastInsertRowid))!;
}

export function updateAutomation(
  id: number,
  patch: Partial<Pick<Automation, "name" | "cron" | "prompt" | "enabled">>,
): Automation | null {
  const cur = getAutomation(id);
  if (!cur) return null;
  const next = {
    name: patch.name ?? cur.name,
    cron: patch.cron ?? cur.cron,
    prompt: patch.prompt ?? cur.prompt,
    enabled: patch.enabled ?? cur.enabled,
  };
  db.prepare(
    "UPDATE automations SET name = ?, cron = ?, prompt = ?, enabled = ? WHERE id = ?",
  ).run(next.name, next.cron, next.prompt, next.enabled ? 1 : 0, id);
  return getAutomation(id);
}

export function deleteAutomation(id: number): void {
  db.prepare("DELETE FROM automations WHERE id = ?").run(id);
}

export type AutomationRun = {
  id: number;
  automation_id: number;
  started_at: number;
  ended_at: number | null;
  ok: number | null;
  output: string | null;
  error: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
};

export function listRuns(automationId: number, limit = 5): AutomationRun[] {
  return db
    .prepare(
      "SELECT * FROM automation_runs WHERE automation_id = ? ORDER BY started_at DESC LIMIT ?",
    )
    .all(automationId, limit) as AutomationRun[];
}

export function listRecentRuns(limit = 10): (AutomationRun & { name: string })[] {
  return db
    .prepare(
      `SELECT r.*, a.name AS name FROM automation_runs r
       JOIN automations a ON a.id = r.automation_id
       ORDER BY r.started_at DESC LIMIT ?`,
    )
    .all(limit) as (AutomationRun & { name: string })[];
}

export async function runAutomation(id: number): Promise<AutomationRun> {
  const a = getAutomation(id);
  if (!a) throw new Error("automation not found");

  const startedAt = Date.now();
  const runInfo = db
    .prepare(
      "INSERT INTO automation_runs (automation_id, started_at) VALUES (?, ?)",
    )
    .run(id, startedAt);
  const runId = Number(runInfo.lastInsertRowid);

  try {
    const result = await runAgentOnce(a.prompt, { source: `auto:${a.name}` });
    const endedAt = Date.now();
    db.prepare(
      `UPDATE automation_runs SET ended_at = ?, ok = ?, output = ?, error = ?,
        input_tokens = ?, output_tokens = ?, cache_read_tokens = ?, cache_write_tokens = ?
       WHERE id = ?`,
    ).run(
      endedAt,
      result.ok ? 1 : 0,
      result.output.slice(0, 20000),
      result.error ?? null,
      result.usage.input_tokens,
      result.usage.output_tokens,
      result.usage.cache_read_tokens,
      result.usage.cache_write_tokens,
      runId,
    );
    db.prepare("UPDATE automations SET last_run_at = ? WHERE id = ?").run(
      endedAt,
      id,
    );
  } catch (e) {
    db.prepare(
      "UPDATE automation_runs SET ended_at = ?, ok = 0, error = ? WHERE id = ?",
    ).run(Date.now(), (e as Error).message, runId);
  }

  return db
    .prepare("SELECT * FROM automation_runs WHERE id = ?")
    .get(runId) as AutomationRun;
}

export type ClaudeCodeRoutine = {
  name: string;
  description: string;
  path: string;
};

export async function readClaudeCodeRoutines(): Promise<ClaudeCodeRoutine[]> {
  const dir = path.join(os.homedir(), ".claude", "scheduled-tasks");
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const out: ClaudeCodeRoutine[] = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const skillPath = path.join(dir, e.name, "SKILL.md");
      try {
        const content = await fs.readFile(skillPath, "utf8");
        const descMatch = content.match(/^description:\s*(.+)$/m);
        out.push({
          name: e.name,
          description: descMatch ? descMatch[1].trim() : "",
          path: skillPath,
        });
      } catch {
        // skip
      }
    }
    return out;
  } catch {
    return [];
  }
}
