import fs from "node:fs/promises";
import path from "node:path";
import { format } from "date-fns";
import { env } from "./config";
import { safeJoin, safeVaultJoin } from "./vault-path";

const TASKS_DIR = () => safeVaultJoin("Tasks");

const PRIORITY_GLYPH: Record<string, string> = {
  highest: "🔺",
  high: "⏫",
  medium: "🔼",
  low: "🔽",
  lowest: "⏬",
};

function resolveTaskFile(file: string): string {
  const normalized = file.replace(/\.md$/, "") + ".md";
  // Strip any absolute or vault-prefixed input down to a vault-relative segment,
  // then validate it stays inside Tasks/ (default) or inside the vault.
  if (path.isAbsolute(normalized)) {
    const rel = path.relative(env.VAULT_PATH, normalized);
    return safeVaultJoin(rel);
  }
  if (normalized.startsWith(`Tasks${path.sep}`) || normalized.startsWith("Tasks/")) {
    return safeVaultJoin(normalized);
  }
  return safeJoin(TASKS_DIR(), normalized);
}

export async function appendTask(input: {
  file?: string;
  text: string;
  due?: string;
  start?: string;
  scheduled?: string;
  priority?: "highest" | "high" | "medium" | "low" | "lowest";
}): Promise<{ path: string; line: number }> {
  const filename = (input.file ?? "Inbox").replace(/\.md$/, "") + ".md";
  const filePath = safeJoin(TASKS_DIR(), filename);
  await fs.mkdir(TASKS_DIR(), { recursive: true });

  let body = "";
  try {
    body = await fs.readFile(filePath, "utf8");
  } catch {
    body = "";
  }

  const parts: string[] = ["- [ ]", input.text.trim()];
  if (input.priority) parts.push(PRIORITY_GLYPH[input.priority]);
  if (input.due) parts.push(`📅 ${input.due}`);
  if (input.start) parts.push(`🛫 ${input.start}`);
  if (input.scheduled) parts.push(`⏳ ${input.scheduled}`);
  const taskLine = parts.join(" ");

  const next = body.endsWith("\n") || body === "" ? body + taskLine + "\n" : body + "\n" + taskLine + "\n";
  await fs.writeFile(filePath, next, "utf8");

  const lineIndex = next.split("\n").findIndex((l) => l === taskLine);
  return {
    path: path.relative(env.VAULT_PATH, filePath),
    line: lineIndex,
  };
}

const TASK_LINE_RE = /^(\s*[-*+]\s+)\[(.)\](\s+)(.*)$/;

function stripTaskMetadata(body: string): string {
  return body
    .replace(/[🔺⏫🔼🔽⏬]/gu, "")
    .replace(/📅\s*\d{4}-\d{2}-\d{2}/gu, "")
    .replace(/🛫\s*\d{4}-\d{2}-\d{2}/gu, "")
    .replace(/⏳\s*\d{4}-\d{2}-\d{2}/gu, "")
    .replace(/✅\s*\d{4}-\d{2}-\d{2}/gu, "")
    .replace(/❌\s*\d{4}-\d{2}-\d{2}/gu, "")
    .replace(/🔁\s*[^📅🛫⏳✅❌🔺⏫🔼🔽⏬]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

type Priority = "highest" | "high" | "medium" | "low" | "lowest";

function buildTaskBody(input: {
  text: string;
  priority?: Priority;
  due?: string;
  start?: string;
  scheduled?: string;
}): string {
  const parts: string[] = [input.text.trim()];
  if (input.priority) parts.push(PRIORITY_GLYPH[input.priority]);
  if (input.due) parts.push(`📅 ${input.due}`);
  if (input.start) parts.push(`🛫 ${input.start}`);
  if (input.scheduled) parts.push(`⏳ ${input.scheduled}`);
  return parts.join(" ");
}

export async function editTask(input: {
  file: string;
  line: number;
  originalText?: string;
  text: string;
  priority?: Priority;
  due?: string;
  start?: string;
  scheduled?: string;
}): Promise<
  | { ok: true; line: number; raw: string }
  | { ok: false; error: string; status?: number }
> {
  const filePath = resolveTaskFile(input.file);
  let body: string;
  try {
    body = await fs.readFile(filePath, "utf8");
  } catch {
    return { ok: false, error: `cannot read ${filePath}`, status: 404 };
  }
  const lines = body.split("\n");
  if (input.line < 0 || input.line >= lines.length) {
    return { ok: false, error: `line ${input.line} out of range`, status: 409 };
  }
  const target = lines[input.line];
  const m = target.match(TASK_LINE_RE);
  if (!m) {
    return { ok: false, error: `line ${input.line} is not a task`, status: 409 };
  }
  if (input.originalText !== undefined) {
    const currentText = stripTaskMetadata(m[4]);
    if (currentText !== stripTaskMetadata(input.originalText)) {
      return { ok: false, error: "task text has changed on disk", status: 409 };
    }
  }
  const rebuilt = `${m[1]}[${m[2]}]${m[3]}${buildTaskBody(input)}`;
  lines[input.line] = rebuilt;
  await fs.writeFile(filePath, lines.join("\n"), "utf8");
  return { ok: true, line: input.line, raw: rebuilt };
}

export async function markTaskDone(input: {
  file: string;
  text: string;
}): Promise<{ ok: true; matched: number } | { ok: false; error: string }> {
  const filePath = resolveTaskFile(input.file);
  let body: string;
  try {
    body = await fs.readFile(filePath, "utf8");
  } catch {
    return { ok: false, error: `cannot read ${filePath}` };
  }
  const today = format(new Date(), "yyyy-MM-dd");
  const lines = body.split("\n");
  let matched = 0;
  const needle = input.text.trim().toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const m = l.match(/^(\s*[-*+]\s+)\[ \](\s+)(.*)$/);
    if (!m) continue;
    if (!m[3].toLowerCase().includes(needle)) continue;
    lines[i] = `${m[1]}[x]${m[2]}${m[3]} ✅ ${today}`;
    matched++;
  }
  if (matched === 0) return { ok: false, error: `no open task matched: ${input.text}` };
  await fs.writeFile(filePath, lines.join("\n"), "utf8");
  return { ok: true, matched };
}
