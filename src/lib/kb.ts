import fs from "node:fs/promises";
import path from "node:path";
import { env } from "./config";
import { db } from "./db";
import { appendLog, readAllLogs } from "./vault-state";
import {
  GLOBAL_SCHEMA,
  CATEGORY_SCHEMAS,
  defaultCategories,
} from "./kb-schemas";

const KB_ROOT_NAME = "Categories";

export function kbRoot(): string {
  return path.join(env.VAULT_PATH, KB_ROOT_NAME);
}

export function categoryPath(category: string): string {
  return path.join(kbRoot(), category);
}

async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

async function writeIfMissing(p: string, content: string): Promise<void> {
  try {
    await fs.access(p);
  } catch {
    await fs.writeFile(p, content, "utf8");
  }
}

export async function ensureCategory(name: string): Promise<void> {
  const root = categoryPath(name);
  await ensureDir(root);
  await ensureDir(path.join(root, "raw"));
  await ensureDir(path.join(root, "wiki"));
  await ensureDir(path.join(root, "wiki", "concepts"));
  await ensureDir(path.join(root, "wiki", "sources"));
  await ensureDir(path.join(root, "wiki", "people"));
  await ensureDir(path.join(root, "output"));
  const schema = CATEGORY_SCHEMAS[name] ?? `# ${name} Schema\n\nSee \`../_SCHEMA.md\` for global rules.\n`;
  await writeIfMissing(path.join(root, "SCHEMA.md"), schema);
  await writeIfMissing(
    path.join(root, "wiki", "INDEX.md"),
    `---\ntype: index\nupdated: ${new Date().toISOString().slice(0, 10)}\n---\n\n# ${name} — Wiki Index\n\n_Empty. Run Compile after raw entries accumulate._\n`,
  );
}

let _bootstrapped = false;
export async function ensureKbBootstrap(): Promise<void> {
  if (_bootstrapped) return;
  await ensureDir(kbRoot());
  await writeIfMissing(path.join(kbRoot(), "_SCHEMA.md"), GLOBAL_SCHEMA);
  for (const c of defaultCategories()) {
    await ensureCategory(c);
  }
  _bootstrapped = true;
}

export async function listCategories(): Promise<string[]> {
  await ensureKbBootstrap();
  const entries = await fs.readdir(kbRoot(), { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

export type CategoryStats = {
  name: string;
  rawCount: number;
  wikiCount: number;
  outputCount: number;
  lastRawAt: number | null;
  lastCompileAt: number | null;
  driftCount: number;
};

async function countFiles(dir: string, recursive = false): Promise<{
  count: number;
  mostRecent: number;
}> {
  try {
    let count = 0;
    let mostRecent = 0;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith(".md")) {
        count++;
        const st = await fs.stat(path.join(dir, e.name));
        if (st.mtimeMs > mostRecent) mostRecent = st.mtimeMs;
      } else if (e.isDirectory() && recursive) {
        const sub = await countFiles(path.join(dir, e.name), true);
        count += sub.count;
        if (sub.mostRecent > mostRecent) mostRecent = sub.mostRecent;
      }
    }
    return { count, mostRecent };
  } catch {
    return { count: 0, mostRecent: 0 };
  }
}

export async function categoryStats(name: string): Promise<CategoryStats> {
  const root = categoryPath(name);
  const [raw, wiki, output] = await Promise.all([
    countFiles(path.join(root, "raw")),
    countFiles(path.join(root, "wiki"), true),
    countFiles(path.join(root, "output")),
  ]);
  const lastCompileAt = lastSuccessfulCompileAt(name);
  let driftCount = 0;
  if (lastCompileAt && raw.count > 0) {
    const entries = await fs.readdir(path.join(root, "raw"));
    for (const e of entries) {
      if (!e.endsWith(".md")) continue;
      const st = await fs.stat(path.join(root, "raw", e));
      if (st.mtimeMs > lastCompileAt) driftCount++;
    }
  } else {
    driftCount = raw.count;
  }
  return {
    name,
    rawCount: raw.count,
    wikiCount: wiki.count,
    outputCount: output.count,
    lastRawAt: raw.mostRecent || null,
    lastCompileAt,
    driftCount,
  };
}

export async function listAllStats(): Promise<CategoryStats[]> {
  const cats = await listCategories();
  return Promise.all(cats.map(categoryStats));
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function isoStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export async function writeRawAgentRun(input: {
  category: string;
  prompt: string;
  output: string;
  model: string;
  tools: Array<{ name: string; ok?: boolean }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
  };
  source?: string;
}): Promise<string> {
  await ensureCategory(input.category);
  const title = input.prompt.split("\n")[0].slice(0, 80);
  const slug = slugify(title) || "agent-run";
  const stamp = isoStamp();
  const filename = `${stamp}-${slug}.md`;
  const fullPath = path.join(categoryPath(input.category), "raw", filename);

  const frontmatter = [
    "---",
    "type: agent_run",
    `category: ${input.category}`,
    `date: ${new Date().toISOString()}`,
    `model: ${input.model}`,
    `source: ${input.source ?? "panel"}`,
    `tools_used: [${input.tools.map((t) => t.name).join(", ")}]`,
    `tokens_in: ${input.usage.input_tokens}`,
    `tokens_out: ${input.usage.output_tokens}`,
    `tokens_cache_read: ${input.usage.cache_read_tokens}`,
    `tokens_cache_write: ${input.usage.cache_write_tokens}`,
    "---",
    "",
  ].join("\n");

  const body = [
    `# ${title}`,
    "",
    "## Prompt",
    "",
    input.prompt,
    "",
    "## Output",
    "",
    input.output || "_(no output)_",
    "",
  ];

  if (input.tools.length > 0) {
    body.push("## Tool calls", "");
    for (const t of input.tools) {
      const status = t.ok === undefined ? "·" : t.ok ? "✓" : "✗";
      body.push(`- ${status} \`${t.name}\``);
    }
    body.push("");
  }

  await fs.writeFile(fullPath, frontmatter + body.join("\n"), "utf8");
  return path.relative(env.VAULT_PATH, fullPath);
}

export async function writeRawIngest(input: {
  category: string;
  title: string;
  content: string;
  sourceUrl?: string;
  sourceType?: string;
}): Promise<string> {
  await ensureCategory(input.category);
  const stamp = isoStamp();
  const slug = slugify(input.title) || "ingest";
  const filename = `${stamp}-${slug}.md`;
  const fullPath = path.join(categoryPath(input.category), "raw", filename);

  const fm = [
    "---",
    "type: ingest",
    `category: ${input.category}`,
    `date: ${new Date().toISOString()}`,
    `source_type: ${input.sourceType ?? "manual"}`,
    input.sourceUrl ? `source_url: ${input.sourceUrl}` : null,
    "---",
    "",
  ]
    .filter(Boolean)
    .join("\n");

  await fs.writeFile(
    fullPath,
    `${fm}# ${input.title}\n\n${input.content}\n`,
    "utf8",
  );
  return path.relative(env.VAULT_PATH, fullPath);
}

export async function writeOutput(input: {
  category: string;
  title: string;
  content: string;
}): Promise<string> {
  await ensureCategory(input.category);
  const date = new Date().toISOString().slice(0, 10);
  const slug = slugify(input.title) || "output";
  const filename = `${date}-${slug}.md`;
  const fullPath = path.join(categoryPath(input.category), "output", filename);
  await fs.writeFile(
    fullPath,
    `---\ntype: output\ncategory: ${input.category}\ndate: ${new Date().toISOString()}\n---\n\n# ${input.title}\n\n${input.content}\n`,
    "utf8",
  );
  return path.relative(env.VAULT_PATH, fullPath);
}

export async function readWikiIndex(category: string): Promise<string> {
  const p = path.join(categoryPath(category), "wiki", "INDEX.md");
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return "";
  }
}

export async function readWikiPage(
  category: string,
  relPath: string,
): Promise<string> {
  const full = path.join(categoryPath(category), "wiki", relPath);
  return fs.readFile(full, "utf8");
}

export async function listWikiPages(
  category: string,
): Promise<string[]> {
  const root = path.join(categoryPath(category), "wiki");
  const out: string[] = [];
  async function walk(dir: string, prefix: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(path.join(dir, e.name), rel);
      else if (e.name.endsWith(".md")) out.push(rel);
    }
  }
  try {
    await walk(root, "");
  } catch {
    // ignore
  }
  return out;
}

export async function listRawFiles(
  category: string,
  sinceMs: number | null = null,
): Promise<Array<{ name: string; mtime: number }>> {
  const dir = path.join(categoryPath(category), "raw");
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const out: Array<{ name: string; mtime: number }> = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".md")) continue;
      const st = await fs.stat(path.join(dir, e.name));
      if (sinceMs !== null && st.mtimeMs <= sinceMs) continue;
      out.push({ name: e.name, mtime: st.mtimeMs });
    }
    return out.sort((a, b) => a.mtime - b.mtime);
  } catch {
    return [];
  }
}

export async function readRawFile(
  category: string,
  filename: string,
): Promise<string> {
  return fs.readFile(
    path.join(categoryPath(category), "raw", filename),
    "utf8",
  );
}

export async function listOutputs(
  category: string,
  limit = 20,
): Promise<Array<{ name: string; path: string; mtime: number }>> {
  const dir = path.join(categoryPath(category), "output");
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const out: Array<{ name: string; path: string; mtime: number }> = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".md")) continue;
      const st = await fs.stat(path.join(dir, e.name));
      out.push({
        name: e.name,
        path: path.relative(env.VAULT_PATH, path.join(dir, e.name)),
        mtime: st.mtimeMs,
      });
    }
    return out.sort((a, b) => b.mtime - a.mtime).slice(0, limit);
  } catch {
    return [];
  }
}

export async function grepWiki(
  category: string,
  query: string,
  limit = 25,
): Promise<Array<{ path: string; line: number; snippet: string }>> {
  if (!query.trim()) return [];
  const root = path.join(categoryPath(category), "wiki");
  const pages = await listWikiPages(category);
  const re = new RegExp(query, "i");
  const out: Array<{ path: string; line: number; snippet: string }> = [];
  for (const rel of pages) {
    try {
      const content = await fs.readFile(path.join(root, rel), "utf8");
      const lines = content.split("\n");
      lines.forEach((line, i) => {
        if (out.length >= limit) return;
        if (re.test(line)) {
          out.push({ path: rel, line: i + 1, snippet: line.slice(0, 200) });
        }
      });
      if (out.length >= limit) break;
    } catch {
      // skip unreadable
    }
  }
  return out;
}

export async function readSchema(category: string): Promise<string> {
  try {
    const cat = await fs.readFile(
      path.join(categoryPath(category), "SCHEMA.md"),
      "utf8",
    );
    const global = await fs.readFile(
      path.join(kbRoot(), "_SCHEMA.md"),
      "utf8",
    );
    return `${global}\n\n---\n\n${cat}`;
  } catch {
    return "";
  }
}

export async function wikiWrite(
  category: string,
  relPath: string,
  content: string,
): Promise<{ path: string }> {
  const full = path.join(categoryPath(category), "wiki", relPath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, "utf8");
  return { path: path.relative(env.VAULT_PATH, full) };
}

export async function wikiDelete(
  category: string,
  relPath: string,
): Promise<void> {
  const full = path.join(categoryPath(category), "wiki", relPath);
  await fs.unlink(full);
}

// Compile record helpers — backed by per-device NDJSON in the vault, with a
// one-shot import of any remaining DB rows on first read.

type CompileRecord = {
  category: string;
  started_at: number;
  ended_at: number | null;
  ok: number | null;
  summary: string | null;
  error: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
};

const COMPILES_TABLE = "kb_compiles";

// Track in-flight compiles only in memory. start returns the started_at
// timestamp as the token; end writes the complete record.
const _inflight = new Map<number, { category: string; started_at: number }>();

let _compilesMigrated = false;
function migrateCompilesFromDb(): void {
  if (_compilesMigrated) return;
  _compilesMigrated = true;
  let rows: CompileRecord[] = [];
  try {
    rows = db
      .prepare(
        "SELECT category, started_at, ended_at, ok, summary, error, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens FROM kb_compiles ORDER BY started_at ASC",
      )
      .all() as CompileRecord[];
  } catch {
    return;
  }
  if (rows.length === 0) return;
  for (const r of rows) appendLog(COMPILES_TABLE, r);
  try {
    db.prepare("DELETE FROM kb_compiles").run();
  } catch {}
}

function loadCompiles(): CompileRecord[] {
  migrateCompilesFromDb();
  return readAllLogs<CompileRecord>(COMPILES_TABLE);
}

export function recordCompileStart(category: string): number {
  const startedAt = Date.now();
  _inflight.set(startedAt, { category, started_at: startedAt });
  return startedAt;
}

export function recordCompileEnd(
  id: number,
  result: {
    ok: boolean;
    summary?: string;
    error?: string;
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_read_tokens: number;
      cache_write_tokens: number;
    };
  },
): void {
  const meta = _inflight.get(id);
  _inflight.delete(id);
  const record: CompileRecord = {
    category: meta?.category ?? "unknown",
    started_at: meta?.started_at ?? id,
    ended_at: Date.now(),
    ok: result.ok ? 1 : 0,
    summary: result.summary?.slice(0, 4000) ?? null,
    error: result.error ?? null,
    input_tokens: result.usage.input_tokens,
    output_tokens: result.usage.output_tokens,
    cache_read_tokens: result.usage.cache_read_tokens,
    cache_write_tokens: result.usage.cache_write_tokens,
  };
  appendLog(COMPILES_TABLE, record);
}

export function recentCompiles(category: string, limit = 5) {
  return loadCompiles()
    .filter((c) => c.category === category)
    .sort((a, b) => b.started_at - a.started_at)
    .slice(0, limit);
}

function lastSuccessfulCompileAt(category: string): number | null {
  let last: number | null = null;
  for (const c of loadCompiles()) {
    if (c.category !== category) continue;
    if (c.ok !== 1) continue;
    if (!c.ended_at) continue;
    if (last === null || c.ended_at > last) last = c.ended_at;
  }
  return last;
}
