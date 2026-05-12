import type Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs/promises";
import path from "node:path";
import { format, subDays } from "date-fns";
import { env } from "./config";
import { getAllTasks, readDailyNote, writeDailyNote, dailyNotePath } from "./obsidian";
import {
  getInbox,
  getMessageDetail,
  archiveMessage,
  markRead,
  markUnread,
  starMessage,
  unstarMessage,
  trashMessage,
  createDraft,
  createReplyDraft,
  sendEmail,
  unsubscribeMessage,
} from "./gmail";
import {
  listCategories,
  writeRawIngest,
  writeOutput,
  readWikiIndex,
  listWikiPages,
  readWikiPage,
  ensureCategory,
} from "./kb";
import { getEvents } from "./calendar";
import { getSummary as getGithub } from "./github";

export const tools: Anthropic.Messages.ToolUnion[] = [
  { type: "web_search_20260209", name: "web_search" },
  { type: "web_fetch_20260209", name: "web_fetch" },
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
      "Get Gmail messages. Returns {messages, query, returned, estimatedTotal}. Use estimatedTotal to verify you have the full set — if returned < estimatedTotal, increase max or paginate. For full inbox triage, override query='in:inbox' (no category filter). Default query excludes Promotions/Social.",
    input_schema: {
      type: "object",
      properties: {
        max: {
          type: "integer",
          description: "Max messages to return (1-50). Default 10. Use higher for triage.",
        },
        query: {
          type: "string",
          description:
            "Gmail search query. Defaults to 'in:inbox -category:promotions -category:social'. Override with e.g. 'in:inbox' (all), 'is:unread', 'in:inbox category:primary', 'from:foo@bar.com', etc.",
        },
      },
    },
  },
  {
    name: "gmail_get_message",
    description:
      "Read full body of a Gmail message. Use when you need the actual content before replying or summarizing.",
    input_schema: {
      type: "object",
      properties: {
        message_id: { type: "string", description: "Gmail message id from get_inbox." },
      },
      required: ["message_id"],
    },
  },
  {
    name: "gmail_archive",
    description:
      "Remove a message from inbox (archive). Reversible from Gmail UI. Use freely for triage.",
    input_schema: {
      type: "object",
      properties: {
        message_id: { type: "string" },
      },
      required: ["message_id"],
    },
  },
  {
    name: "gmail_mark_read",
    description: "Mark a message as read.",
    input_schema: {
      type: "object",
      properties: { message_id: { type: "string" } },
      required: ["message_id"],
    },
  },
  {
    name: "gmail_mark_unread",
    description: "Mark a message as unread.",
    input_schema: {
      type: "object",
      properties: { message_id: { type: "string" } },
      required: ["message_id"],
    },
  },
  {
    name: "gmail_star",
    description: "Star a message.",
    input_schema: {
      type: "object",
      properties: { message_id: { type: "string" } },
      required: ["message_id"],
    },
  },
  {
    name: "gmail_unstar",
    description: "Unstar a message.",
    input_schema: {
      type: "object",
      properties: { message_id: { type: "string" } },
      required: ["message_id"],
    },
  },
  {
    name: "gmail_trash",
    description:
      "Move message to Trash. Recoverable for 30 days. Use only when the user clearly wants the email deleted.",
    input_schema: {
      type: "object",
      properties: { message_id: { type: "string" } },
      required: ["message_id"],
    },
  },
  {
    name: "gmail_create_draft",
    description:
      "Create a NEW draft email (lands in Drafts for user review, NOT sent). Prefer this over gmail_send unless user explicitly asks to send.",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email." },
        subject: { type: "string" },
        body: { type: "string", description: "Plain text body." },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "gmail_draft_reply",
    description:
      "Draft a reply within an existing thread (lands in Drafts for user review, NOT sent). Auto-fills To, Subject (Re:), In-Reply-To, References.",
    input_schema: {
      type: "object",
      properties: {
        thread_id: { type: "string", description: "Gmail thread id from get_inbox." },
        body: { type: "string", description: "Plain text reply body." },
      },
      required: ["thread_id", "body"],
    },
  },
  {
    name: "gmail_unsubscribe",
    description:
      "Unsubscribe from a newsletter/marketing email using its List-Unsubscribe header. Tries one-click POST (RFC 8058) first, then mailto fallback. If neither is supported, returns the URL for the user to click manually. Result includes method ('one_click_post'|'mailto'|'manual_url'|'none') and ok flag. Recommended for newsletters during triage — actually removes future emails, not just hides current one. Pair with gmail_archive after success.",
    input_schema: {
      type: "object",
      properties: { message_id: { type: "string" } },
      required: ["message_id"],
    },
  },
  {
    name: "gmail_send",
    description:
      "Send an email IMMEDIATELY (no draft step). Only use when user explicitly says 'send' or after they've reviewed a draft. Otherwise use gmail_create_draft.",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["to", "subject", "body"],
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
  {
    name: "kb_list_categories",
    description:
      "List all knowledge-base categories (folders under <vault>/Categories/).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "kb_ingest",
    description:
      "Ingest material into a category's raw/ folder. Use when user gives you an article, paste, URL content, or anything worth preserving as source material. Returns the relative path.",
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Category name. If omitted, uses the current session category.",
        },
        title: { type: "string" },
        content: { type: "string" },
        source_url: { type: "string" },
        source_type: {
          type: "string",
          description: "e.g. 'article', 'paper', 'call_notes', 'transcript', 'paste'.",
        },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "kb_query",
    description:
      "Query a category's wiki for context. Returns INDEX.md + list of all wiki pages. Use to ground responses in compiled knowledge before substantive work.",
    input_schema: {
      type: "object",
      properties: { category: { type: "string" } },
    },
  },
  {
    name: "kb_read_wiki_page",
    description:
      "Read a specific wiki page. Path relative to wiki/, e.g. 'concepts/attention.md'.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string" },
        path: { type: "string" },
      },
      required: ["path"],
    },
  },
  {
    name: "kb_write_output",
    description:
      "Save a finished deliverable (draft, report, summary, deck outline) to a category's output/ folder. NOT for capturing source material — that's kb_ingest.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
      },
      required: ["title", "content"],
    },
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
  ctx: { category?: string } = {},
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
        const query = input.query ? String(input.query) : undefined;
        const result = await getInbox({ max, query });
        return { ok: true, result };
      }
      case "gmail_get_message": {
        const detail = await getMessageDetail(String(input.message_id));
        return { ok: true, result: detail };
      }
      case "gmail_archive": {
        const r = await archiveMessage(String(input.message_id));
        return { ok: true, result: r };
      }
      case "gmail_mark_read": {
        const r = await markRead(String(input.message_id));
        return { ok: true, result: r };
      }
      case "gmail_mark_unread": {
        const r = await markUnread(String(input.message_id));
        return { ok: true, result: r };
      }
      case "gmail_star": {
        const r = await starMessage(String(input.message_id));
        return { ok: true, result: r };
      }
      case "gmail_unstar": {
        const r = await unstarMessage(String(input.message_id));
        return { ok: true, result: r };
      }
      case "gmail_trash": {
        const r = await trashMessage(String(input.message_id));
        return { ok: true, result: r };
      }
      case "gmail_create_draft": {
        const r = await createDraft({
          to: String(input.to),
          subject: String(input.subject),
          body: String(input.body),
        });
        return { ok: true, result: r };
      }
      case "gmail_draft_reply": {
        const r = await createReplyDraft({
          threadId: String(input.thread_id),
          body: String(input.body),
        });
        return { ok: true, result: r };
      }
      case "gmail_send": {
        const r = await sendEmail({
          to: String(input.to),
          subject: String(input.subject),
          body: String(input.body),
        });
        return { ok: true, result: r };
      }
      case "gmail_unsubscribe": {
        const r = await unsubscribeMessage(String(input.message_id));
        return { ok: true, result: r };
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
      case "kb_list_categories": {
        const cats = await listCategories();
        return { ok: true, result: { categories: cats, current: ctx.category } };
      }
      case "kb_ingest": {
        const category = String(input.category ?? ctx.category ?? "Personal");
        await ensureCategory(category);
        const rel = await writeRawIngest({
          category,
          title: String(input.title),
          content: String(input.content),
          sourceUrl: input.source_url ? String(input.source_url) : undefined,
          sourceType: input.source_type ? String(input.source_type) : undefined,
        });
        return { ok: true, result: { path: rel, category } };
      }
      case "kb_query": {
        const category = String(input.category ?? ctx.category ?? "Personal");
        const index = await readWikiIndex(category);
        const pages = await listWikiPages(category);
        return { ok: true, result: { category, index, pages } };
      }
      case "kb_read_wiki_page": {
        const category = String(input.category ?? ctx.category ?? "Personal");
        const content = await readWikiPage(category, String(input.path));
        return { ok: true, result: { category, path: String(input.path), content } };
      }
      case "kb_write_output": {
        const category = String(input.category ?? ctx.category ?? "Personal");
        const rel = await writeOutput({
          category,
          title: String(input.title),
          content: String(input.content),
        });
        return { ok: true, result: { path: rel, category } };
      }
      default:
        return { ok: false, error: `unknown tool: ${name}` };
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
