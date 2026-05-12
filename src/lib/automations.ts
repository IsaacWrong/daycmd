import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { db } from "./db";
import { runAgentOnce, type UsageTotals } from "./agent";
import { streamCompile } from "./kb-compile";
import { streamLint } from "./kb-lint";
import { logError } from "./errors";

export type AutomationKind = "agent" | "compile" | "lint";

export type Automation = {
  id: number;
  name: string;
  cron: string;
  prompt: string;
  enabled: boolean;
  kind: AutomationKind;
  target_category: string | null;
  last_run_at: number | null;
  created_at: number;
};

type Row = Omit<Automation, "enabled" | "kind"> & {
  enabled: number;
  kind: string | null;
};

function rowToAutomation(r: Row): Automation {
  return { ...r, enabled: !!r.enabled, kind: (r.kind as AutomationKind) ?? "agent" };
}

const COLS =
  "id, name, cron, prompt, enabled, last_run_at, created_at, kind, target_category";

export function listAutomations(): Automation[] {
  const rows = db
    .prepare(`SELECT ${COLS} FROM automations ORDER BY id DESC`)
    .all() as Row[];
  return rows.map(rowToAutomation);
}

export function getAutomation(id: number): Automation | null {
  const row = db
    .prepare(`SELECT ${COLS} FROM automations WHERE id = ?`)
    .get(id) as Row | undefined;
  return row ? rowToAutomation(row) : null;
}

export function createAutomation(input: {
  name: string;
  cron: string;
  prompt?: string;
  enabled?: boolean;
  kind?: AutomationKind;
  target_category?: string | null;
}): Automation {
  const kind = input.kind ?? "agent";
  const info = db
    .prepare(
      "INSERT INTO automations (name, cron, prompt, enabled, kind, target_category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      input.name,
      input.cron,
      input.prompt ?? "",
      input.enabled === false ? 0 : 1,
      kind,
      input.target_category ?? null,
      Date.now(),
    );
  return getAutomation(Number(info.lastInsertRowid))!;
}

export function updateAutomation(
  id: number,
  patch: Partial<{
    name: string;
    cron: string;
    prompt: string;
    enabled: boolean;
    kind: AutomationKind;
    target_category: string | null;
  }>,
): Automation | null {
  const cur = getAutomation(id);
  if (!cur) return null;
  const next = {
    name: patch.name ?? cur.name,
    cron: patch.cron ?? cur.cron,
    prompt: patch.prompt ?? cur.prompt,
    enabled: patch.enabled ?? cur.enabled,
    kind: patch.kind ?? cur.kind,
    target_category:
      patch.target_category !== undefined ? patch.target_category : cur.target_category,
  };
  db.prepare(
    "UPDATE automations SET name = ?, cron = ?, prompt = ?, enabled = ?, kind = ?, target_category = ? WHERE id = ?",
  ).run(
    next.name,
    next.cron,
    next.prompt,
    next.enabled ? 1 : 0,
    next.kind,
    next.target_category,
    id,
  );
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
    let result: {
      ok: boolean;
      output: string;
      error?: string;
      usage: UsageTotals;
    };
    if ((a.kind === "compile" || a.kind === "lint") && a.target_category) {
      // Drain a compile/lint stream into the same {ok, output, usage} shape.
      let output = "";
      let error: string | undefined;
      let usage: UsageTotals = {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
      };
      const stream = a.kind === "compile"
        ? streamCompile(a.target_category)
        : streamLint(a.target_category);
      for await (const ev of stream) {
        if (ev.type === "text") output += ev.data as string;
        else if (ev.type === "error") error = String(ev.data);
        else if (ev.type === "usage") usage = ev.data as UsageTotals;
        else if (ev.type === "done") {
          const d = ev.data as { summary?: string };
          if (d?.summary) output = `${d.summary}\n\n${output}`.trim();
        } else if (ev.type === "lint_result" && a.kind === "lint") {
          const d = ev.data as {
            findings?: Array<{ type: string; location: string; description: string }>;
            summary?: string;
          };
          const findings = d.findings ?? [];
          for (const f of findings) {
            logError(
              `kb_lint:${a.target_category}:${f.type}`,
              `${f.location} — ${f.description}`,
              { category: a.target_category, finding: f },
            );
          }
          if (d.summary) output = `${d.summary}\n\n${output}`.trim();
        }
      }
      result = { ok: !error, output, error, usage };
    } else {
      result = await runAgentOnce(a.prompt, { source: `auto:${a.name}` });
    }
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
    logError(`automation:${a.name}`, (e as Error).message);
  }

  return db
    .prepare("SELECT * FROM automation_runs WHERE id = ?")
    .get(runId) as AutomationRun;
}

// 6am daily compile, 6:30am daily lint.
const DEFAULT_COMPILE_CRON = "0 6 * * *";
const DEFAULT_LINT_CRON = "30 6 * * *";

function automationExists(name: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM automations WHERE name = ?")
    .get(name) as unknown;
  return !!row;
}

/**
 * Seed one compile + one lint automation per KB category (idempotent).
 * Existing rows w/ matching names are left alone.
 */
export async function ensureDefaultKbAutomations(): Promise<{ created: string[] }> {
  const { listCategories } = await import("./kb");
  const created: string[] = [];
  let cats: string[] = [];
  try {
    cats = await listCategories();
  } catch {
    return { created };
  }
  for (const cat of cats) {
    const compileName = `KB Compile · ${cat}`;
    if (!automationExists(compileName)) {
      createAutomation({
        name: compileName,
        cron: DEFAULT_COMPILE_CRON,
        kind: "compile",
        target_category: cat,
        enabled: true,
      });
      created.push(compileName);
    }
    const lintName = `KB Lint · ${cat}`;
    if (!automationExists(lintName)) {
      createAutomation({
        name: lintName,
        cron: DEFAULT_LINT_CRON,
        kind: "lint",
        target_category: cat,
        enabled: true,
      });
      created.push(lintName);
    }
  }
  return { created };
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
