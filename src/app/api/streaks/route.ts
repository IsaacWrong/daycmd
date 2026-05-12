import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { format } from "date-fns";
import { env } from "@/lib/config";
import { listActiveProjects } from "@/lib/projects";
import { getDailyCommitCounts } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAILY_DIR = path.join(env.VAULT_PATH, "Daily");

async function dailyExists(date: Date): Promise<boolean> {
  const p = path.join(DAILY_DIR, `${format(date, "yyyy-MM-dd")}.md`);
  try {
    const stat = await fs.stat(p);
    if (!stat.isFile()) return false;
    // Treat zero-byte file as not present so a placeholder doesn't inflate streak.
    return stat.size > 0;
  } catch {
    return false;
  }
}

async function dailyNoteStreak(): Promise<number> {
  // Walk back from today. If today is missing, start from yesterday — a
  // streak still "counts" until the user has gone a full day without writing.
  let count = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!(await dailyExists(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  // Cap at 365 to bound the walk.
  for (let i = 0; i < 365; i++) {
    if (await dailyExists(cursor)) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return count;
}

async function shipStreak(): Promise<number> {
  try {
    const projects = await listActiveProjects();
    const repos = projects
      .map((p) => (typeof p.frontmatter.repo === "string" ? p.frontmatter.repo : ""))
      .filter(Boolean);
    const days = await getDailyCommitCounts(repos, 30);
    if (days.length === 0) return 0;
    let count = 0;
    let i = days.length - 1;
    if (days[i] === 0) i -= 1; // today optional
    for (; i >= 0; i--) {
      if (days[i] > 0) count += 1;
      else break;
    }
    return count;
  } catch {
    return 0;
  }
}

let cache: { ts: number; data: { dailyNote: number; ship: number } } | null = null;
const TTL_MS = 5 * 60_000;

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL_MS) {
    return NextResponse.json(cache.data);
  }
  try {
    const [dailyNote, ship] = await Promise.all([dailyNoteStreak(), shipStreak()]);
    const data = { dailyNote, ship };
    cache = { ts: Date.now(), data };
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message, dailyNote: 0, ship: 0 },
      { status: 500 },
    );
  }
}
