import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { db } from "./db";
import { runAgentOnce, type UsageTotals } from "./agent";
import { streamCompile } from "./kb-compile";
import { streamLint } from "./kb-lint";
import { logError } from "./errors";
import {
  readStateSync,
  writeStateSync,
  appendLog,
  readAllLogs,
  getDeviceId,
} from "./vault-state";
import { env } from "./config";

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

const AUTOMATIONS_KEY = "automations";

type StoredAutomation = {
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

type DbRow = {
  id: number;
  name: string;
  cron: string;
  prompt: string;
  enabled: number;
  kind: string | null;
  target_category: string | null;
  last_run_at: number | null;
  created_at: number;
};

let _migrated = false;
function migrateFromDb(): StoredAutomation[] | null {
  if (_migrated) return null;
  _migrated = true;
  let rows: DbRow[] = [];
  try {
    rows = db
      .prepare(
        "SELECT id, name, cron, prompt, enabled, kind, target_category, last_run_at, created_at FROM automations ORDER BY id ASC",
      )
      .all() as DbRow[];
  } catch {
    return null;
  }
  if (rows.length === 0) return null;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    cron: r.cron,
    prompt: r.prompt,
    enabled: !!r.enabled,
    kind: ((r.kind ?? "agent") as AutomationKind),
    target_category: r.target_category,
    last_run_at: r.last_run_at,
    created_at: r.created_at,
  }));
}

function loadAll(): StoredAutomation[] {
  if (!env.VAULT_PATH) return [];
  const remote = readStateSync<StoredAutomation[]>(AUTOMATIONS_KEY);
  if (remote) return remote;
  const migrated = migrateFromDb();
  if (migrated) {
    try {
      writeStateSync(AUTOMATIONS_KEY, migrated);
    } catch {}
    return migrated;
  }
  return [];
}

function saveAll(next: StoredAutomation[]): void {
  if (!env.VAULT_PATH) return;
  writeStateSync(AUTOMATIONS_KEY, next);
}

function nextId(items: StoredAutomation[]): number {
  return items.reduce((m, x) => Math.max(m, x.id), 0) + 1;
}

function toAutomation(s: StoredAutomation): Automation {
  return { ...s };
}

export function listAutomations(): Automation[] {
  return loadAll()
    .slice()
    .sort((a, b) => b.id - a.id)
    .map(toAutomation);
}

export function getAutomation(id: number): Automation | null {
  const found = loadAll().find((a) => a.id === id);
  return found ? toAutomation(found) : null;
}

export function createAutomation(input: {
  name: string;
  cron: string;
  prompt?: string;
  enabled?: boolean;
  kind?: AutomationKind;
  target_category?: string | null;
}): Automation {
  const all = loadAll();
  const row: StoredAutomation = {
    id: nextId(all),
    name: input.name,
    cron: input.cron,
    prompt: input.prompt ?? "",
    enabled: input.enabled !== false,
    kind: input.kind ?? "agent",
    target_category: input.target_category ?? null,
    last_run_at: null,
    created_at: Date.now(),
  };
  saveAll([...all, row]);
  return toAutomation(row);
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
  const all = loadAll();
  const idx = all.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  const cur = all[idx];
  const next: StoredAutomation = {
    ...cur,
    name: patch.name ?? cur.name,
    cron: patch.cron ?? cur.cron,
    prompt: patch.prompt ?? cur.prompt,
    enabled: patch.enabled ?? cur.enabled,
    kind: patch.kind ?? cur.kind,
    target_category:
      patch.target_category !== undefined ? patch.target_category : cur.target_category,
  };
  const out = all.slice();
  out[idx] = next;
  saveAll(out);
  return toAutomation(next);
}

export function deleteAutomation(id: number): void {
  const all = loadAll();
  const next = all.filter((a) => a.id !== id);
  if (next.length !== all.length) saveAll(next);
  // Local run history left in place; rows become orphans referenced only by
  // their numeric automation_id. Cheap to ignore on read.
}

function setLastRunAt(id: number, ts: number): void {
  const all = loadAll();
  const idx = all.findIndex((a) => a.id === id);
  if (idx < 0) return;
  const out = all.slice();
  out[idx] = { ...out[idx], last_run_at: ts };
  saveAll(out);
}

export type AutomationRun = {
  id: string;
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

const RUNS_TABLE = "automation_runs";

type StoredRun = Omit<AutomationRun, "id">;

let _runsMigrated = false;
function migrateRunsFromDb(): void {
  if (_runsMigrated) return;
  _runsMigrated = true;
  let rows: Array<StoredRun & { id: number }> = [];
  try {
    rows = db
      .prepare(
        "SELECT id, automation_id, started_at, ended_at, ok, output, error, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens FROM automation_runs ORDER BY started_at ASC",
      )
      .all() as Array<StoredRun & { id: number }>;
  } catch {
    return;
  }
  if (rows.length === 0) return;
  for (const r of rows) {
    const { id: _id, ...rest } = r;
    appendLog(RUNS_TABLE, rest);
  }
  try {
    db.prepare("DELETE FROM automation_runs").run();
  } catch {}
}

function loadRuns(): AutomationRun[] {
  migrateRunsFromDb();
  return readAllLogs<StoredRun>(RUNS_TABLE).map((r) => ({
    ...r,
    id: `${r._device}:${r.started_at}`,
  }));
}

export function listRuns(automationId: number, limit = 5): AutomationRun[] {
  return loadRuns()
    .filter((r) => r.automation_id === automationId)
    .sort((a, b) => b.started_at - a.started_at)
    .slice(0, limit);
}

export function listRecentRuns(limit = 10): (AutomationRun & { name: string })[] {
  const rows = loadRuns()
    .sort((a, b) => b.started_at - a.started_at)
    .slice(0, limit);
  const nameById = new Map(loadAll().map((a) => [a.id, a.name]));
  return rows.map((r) => ({ ...r, name: nameById.get(r.automation_id) ?? `#${r.automation_id}` }));
}

export async function runAutomation(id: number): Promise<AutomationRun> {
  const a = getAutomation(id);
  if (!a) throw new Error("automation not found");

  const startedAt = Date.now();
  const finalRecord: StoredRun = {
    automation_id: id,
    started_at: startedAt,
    ended_at: null,
    ok: null,
    output: null,
    error: null,
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
  };

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
    finalRecord.ended_at = endedAt;
    finalRecord.ok = result.ok ? 1 : 0;
    finalRecord.output = result.output.slice(0, 20000);
    finalRecord.error = result.error ?? null;
    finalRecord.input_tokens = result.usage.input_tokens;
    finalRecord.output_tokens = result.usage.output_tokens;
    finalRecord.cache_read_tokens = result.usage.cache_read_tokens;
    finalRecord.cache_write_tokens = result.usage.cache_write_tokens;
    setLastRunAt(id, endedAt);
  } catch (e) {
    finalRecord.ended_at = Date.now();
    finalRecord.ok = 0;
    finalRecord.error = (e as Error).message;
    logError(`automation:${a.name}`, (e as Error).message);
  }

  appendLog(RUNS_TABLE, finalRecord);
  return { ...finalRecord, id: `${getDeviceId()}:${startedAt}` };
}

// 6am daily compile, 6:30am daily lint.
const DEFAULT_COMPILE_CRON = "0 6 * * *";
const DEFAULT_LINT_CRON = "30 6 * * *";

function automationExists(name: string): boolean {
  return loadAll().some((a) => a.name === name);
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
