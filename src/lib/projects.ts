import fs from "node:fs/promises";
import path from "node:path";
import { format, differenceInMinutes, subDays } from "date-fns";
import matter from "gray-matter";
import { env } from "./config";
import {
  trashBeforeOverwrite,
  vaultAppend,
  vaultWrite,
} from "./vault-write";

const PROJECTS_DIR = path.join(env.VAULT_PATH, "Projects");
const INBOX_PATH = path.join(env.VAULT_PATH, "Inbox.md");

export type ProjectFrontmatter = {
  type?: string;
  status?: string;
  started?: string;
  url?: string;
  repo?: string;
  next?: string;
  weekly_hours?: number;
  archived?: boolean;
  tags?: string[];
  [key: string]: unknown;
};

export type Project = {
  name: string;
  filePath: string;
  frontmatter: ProjectFrontmatter;
  body: string;
  mtime: number;
};

export type TimeEntry = {
  date: string;
  start: string;
  end: string;
  minutes: number;
  note?: string;
};

function projectFileName(name: string): string {
  return `${name}.md`;
}

function projectPath(name: string): string {
  return path.join(PROJECTS_DIR, projectFileName(name));
}

export async function listProjectFiles(): Promise<string[]> {
  const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => path.join(PROJECTS_DIR, e.name));
}

async function readProjectFile(filePath: string): Promise<Project> {
  const [raw, stat] = await Promise.all([
    fs.readFile(filePath, "utf8"),
    fs.stat(filePath),
  ]);
  const parsed = matter(raw);
  const name = path.basename(filePath, ".md");
  return {
    name,
    filePath,
    frontmatter: parsed.data as ProjectFrontmatter,
    body: parsed.content,
    mtime: stat.mtimeMs,
  };
}

export async function readProject(name: string): Promise<Project> {
  return readProjectFile(projectPath(name));
}

export async function listProjects(): Promise<Project[]> {
  const files = await listProjectFiles();
  const projects = await Promise.all(files.map(readProjectFile));
  return projects.filter((p) => p.frontmatter.type === "project");
}

export async function listActiveProjects(): Promise<Project[]> {
  const all = await listProjects();
  return all.filter((p) => p.frontmatter.archived !== true);
}

async function writeProject(project: Project, nextFrontmatter: ProjectFrontmatter, nextBody: string): Promise<number> {
  const serialized = matter.stringify(nextBody, nextFrontmatter as Record<string, unknown>);
  await trashBeforeOverwrite(project.filePath);
  await vaultWrite(project.filePath, serialized);
  const stat = await fs.stat(project.filePath);
  return stat.mtimeMs;
}

export async function updateFrontmatter(name: string, patch: Partial<ProjectFrontmatter>): Promise<Project> {
  const project = await readProject(name);
  const nextFm = { ...project.frontmatter, ...patch };
  await writeProject(project, nextFm, project.body);
  return readProject(name);
}

function findSectionRange(body: string, heading: string): { start: number; end: number } | null {
  const lines = body.split("\n");
  const headingRegex = new RegExp(`^##\\s+${heading}\\s*$`, "i");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingRegex.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { start, end };
}

function appendToSection(body: string, heading: string, line: string): string {
  const range = findSectionRange(body, heading);
  if (!range) {
    const sep = body.endsWith("\n") ? "" : "\n";
    return `${body}${sep}\n## ${heading}\n\n${line}\n`;
  }
  const lines = body.split("\n");
  let insertAt = range.end;
  while (insertAt > range.start + 1 && lines[insertAt - 1].trim() === "") insertAt--;
  lines.splice(insertAt, 0, line);
  return lines.join("\n");
}

export async function appendLogEntry(name: string, entry: TimeEntry): Promise<Project> {
  const project = await readProject(name);
  const noteSuffix = entry.note?.trim() ? ` — ${entry.note.trim().replace(/\s+/g, " ")}` : "";
  const line = `- ${entry.date} ${entry.start}–${entry.end} (${entry.minutes}m)${noteSuffix}`;
  const nextBody = appendToSection(project.body, "Log", line);
  const weeklyHours = computeWeeklyHoursFromBody(nextBody);
  const nextFm = { ...project.frontmatter, weekly_hours: weeklyHours };
  await writeProject(project, nextFm, nextBody);
  return readProject(name);
}

export async function appendIdea(name: string, text: string, now = new Date()): Promise<Project> {
  const project = await readProject(name);
  const stamp = format(now, "yyyy-MM-dd HH:mm");
  const line = `- ${stamp} — ${text}`;
  const nextBody = appendToSection(project.body, "Ideas", line);
  await writeProject(project, project.frontmatter, nextBody);
  return readProject(name);
}

export async function appendUnfiledIdea(text: string, now = new Date()): Promise<string> {
  const stamp = format(now, "yyyy-MM-dd HH:mm");
  const line = `- ${stamp} — ${text}\n`;
  try {
    await fs.access(INBOX_PATH);
  } catch {
    // New file — no prior contents to trash.
    await vaultWrite(INBOX_PATH, `# Inbox\n\n`);
  }
  await vaultAppend(INBOX_PATH, line);
  return INBOX_PATH;
}

const LOG_LINE = /^-\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})[–-](\d{2}:\d{2})\s+\((\d+)m\)(?:\s+[—-]\s+(.*))?/;

export function parseLogEntries(body: string): TimeEntry[] {
  const range = findSectionRange(body, "Log");
  if (!range) return [];
  const lines = body.split("\n").slice(range.start + 1, range.end);
  const entries: TimeEntry[] = [];
  for (const l of lines) {
    const m = l.match(LOG_LINE);
    if (!m) continue;
    const entry: TimeEntry = {
      date: m[1],
      start: m[2],
      end: m[3],
      minutes: Number(m[4]),
    };
    if (m[5]) entry.note = m[5].trim();
    entries.push(entry);
  }
  return entries;
}

export function computeWeeklyHoursFromBody(body: string, now = new Date()): number {
  const cutoff = subDays(now, 7);
  const cutoffStr = format(cutoff, "yyyy-MM-dd");
  const entries = parseLogEntries(body);
  const minutes = entries
    .filter((e) => e.date >= cutoffStr)
    .reduce((sum, e) => sum + e.minutes, 0);
  return Math.round((minutes / 60) * 100) / 100;
}

export function buildTimeEntry(
  startISO: string,
  endISO: string,
  note?: string,
): TimeEntry {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const minutes = Math.max(0, differenceInMinutes(end, start));
  const entry: TimeEntry = {
    date: format(start, "yyyy-MM-dd"),
    start: format(start, "HH:mm"),
    end: format(end, "HH:mm"),
    minutes,
  };
  if (note?.trim()) entry.note = note.trim();
  return entry;
}

export async function createProject(
  name: string,
  fields: { status?: string; repo?: string; url?: string; next?: string } = {},
): Promise<Project> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Project name required");
  if (/[\\/]/.test(trimmed)) throw new Error("Project name cannot contain slashes");
  const filePath = projectPath(trimmed);
  try {
    await fs.access(filePath);
    throw new Error(`Project "${trimmed}" already exists`);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  const fm: ProjectFrontmatter = {
    type: "project",
    status: fields.status ?? "idea",
    started: format(new Date(), "yyyy-MM-dd"),
    weekly_hours: 0,
  };
  if (fields.repo) fm.repo = fields.repo;
  if (fields.url) fm.url = fields.url;
  if (fields.next) fm.next = fields.next;
  const body = `\n## Next\n\n${fields.next ?? ""}\n\n## Log\n\n## Ideas\n\n`;
  const serialized = matter.stringify(body, fm as Record<string, unknown>);
  // New project file (we already asserted it didn't exist above) — no trash.
  await vaultWrite(filePath, serialized);
  return readProject(trimmed);
}

export async function setNext(name: string, next: string): Promise<Project> {
  return updateFrontmatter(name, { next });
}

export async function archiveProject(name: string): Promise<Project> {
  return updateFrontmatter(name, { archived: true });
}
