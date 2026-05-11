import type Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs/promises";
import path from "node:path";
import { format, subDays } from "date-fns";
import { env } from "./config";
import { getAllTasks, readDailyNote, writeDailyNote, dailyNotePath } from "./obsidian";
import { getInbox } from "./gmail";
import { getEvents } from "./calendar";
import { getSummary as getGithub } from "./github";

export const tools: Anthropic.Tool[] = [
  {
    name: "get_tasks",
    description:
      "Get all open tasks from the Obsidian Tasks/ folder. Returns tasks with text, due/start/scheduled dates, priority, and source file.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_daily_note",
    description:
      "Read today's daily note from Obsidian. Returns markdown content.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "append_to_daily_note",
    description:
      "Append content to today's daily note under a section header. If section doesn't exist, content is appended at the end.",
    input_schema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          description:
            "Section header to append under (e.g., 'Quick Capture', 'Journal', 'Side Projects'). Match existing H2 headers in the note.",
        },
        content: {
          type: "string",
          description: "Markdown content to append. Will be added on a new line under the section.",
        },
      },
      required: ["section", "content"],
    },
  },
  {
    name: "read_past_daily_notes",
    description:
      "Read daily notes from the past N days (excluding today). Returns array of {date, content}. Use for weekly review or reflection.",
    input_schema: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          description: "Number of past days to read (1-14).",
        },
      },
      required: ["days"],
    },
  },
  {
    name: "get_inbox",
    description:
      "Get recent inbox messages from Gmail (excludes Promotions/Social). Returns sender, subject, snippet, unread flag.",
    input_schema: {
      type: "object",
      properties: {
        max: {
          type: "integer",
          description: "Max messages to return (1-25). Default 10.",
        },
      },
    },
  },
  {
    name: "get_calendar",
    description:
      "Get upcoming calendar events. Returns events with start, end, title, location.",
    input_schema: {
      type: "object",
      properties: {
        hours_ahead: {
          type: "integer",
          description: "How many hours into the future to look. Default 36.",
        },
      },
    },
  },
  {
    name: "get_github_summary",
    description:
      "Get GitHub state: PRs needing review, my open PRs, assigned issues, unread notifications.",
    input_schema: { type: "object", properties: {} },
  },
];

type ToolInput = Record<string, unknown>;

async function appendToSection(
  section: string,
  content: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const note = await readDailyNote();
  let body = note.content;
  if (!note.exists) {
    body = `# ${format(new Date(), "yyyy-MM-dd")}\n\n## ${section}\n${content}\n`;
  } else {
    const re = new RegExp(`(^|\\n)## ${section}\\s*\\n`, "i");
    const m = body.match(re);
    if (!m) {
      body = body.replace(/\s*$/, "") + `\n\n## ${section}\n${content}\n`;
    } else {
      const idx = m.index! + m[0].length;
      const rest = body.slice(idx);
      const nextHeader = rest.match(/\n## /);
      const insertAt = nextHeader ? idx + nextHeader.index! : body.length;
      const before = body.slice(0, insertAt).replace(/\s*$/, "");
      const after = body.slice(insertAt);
      body = `${before}\n${content}\n${after}`;
    }
  }
  await writeDailyNote(body);
  return { ok: true, path: dailyNotePath() };
}

async function readPastDailyNotes(days: number) {
  const clamped = Math.max(1, Math.min(14, days));
  const out: Array<{ date: string; content: string; exists: boolean }> = [];
  for (let i = 1; i <= clamped; i++) {
    const d = subDays(new Date(), i);
    const p = path.join(env.VAULT_PATH, "Daily", `${format(d, "yyyy-MM-dd")}.md`);
    try {
      const content = await fs.readFile(p, "utf8");
      out.push({ date: format(d, "yyyy-MM-dd"), content, exists: true });
    } catch {
      out.push({ date: format(d, "yyyy-MM-dd"), content: "", exists: false });
    }
  }
  return out;
}

export async function runTool(
  name: string,
  input: ToolInput,
): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  try {
    switch (name) {
      case "get_tasks": {
        const tasks = await getAllTasks();
        return { ok: true, result: tasks.filter((t) => !t.done && !t.cancelled) };
      }
      case "get_daily_note": {
        const note = await readDailyNote();
        return { ok: true, result: note };
      }
      case "append_to_daily_note": {
        const section = String(input.section ?? "Quick Capture");
        const content = String(input.content ?? "");
        if (!content.trim()) return { ok: false, error: "content empty" };
        const res = await appendToSection(section, content);
        return res.ok
          ? { ok: true, result: res }
          : { ok: false, error: res.error };
      }
      case "read_past_daily_notes": {
        const days = Number(input.days ?? 7);
        const notes = await readPastDailyNotes(days);
        return { ok: true, result: notes };
      }
      case "get_inbox": {
        const max = Number(input.max ?? 10);
        const messages = await getInbox(Math.max(1, Math.min(25, max)));
        return { ok: true, result: messages };
      }
      case "get_calendar": {
        const hours = Number(input.hours_ahead ?? 36);
        const events = await getEvents(hours);
        return { ok: true, result: events };
      }
      case "get_github_summary": {
        const s = await getGithub();
        return { ok: true, result: s };
      }
      default:
        return { ok: false, error: `unknown tool: ${name}` };
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
