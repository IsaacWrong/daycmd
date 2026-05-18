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
  listLabels,
  modifyThread,
} from "./gmail";
import {
  listCategories,
  writeRawIngest,
  writeOutput,
  readWikiIndex,
  listWikiPages,
  readWikiPage,
  ensureCategory,
  wikiWrite,
  wikiDelete,
} from "./kb";
import {
  getEvents,
  createEvent,
  rescheduleEvent,
  cancelEvent,
} from "./calendar";
import { getSummary as getGithub } from "./github";
import { appendTask, markTaskDone } from "./tasks-writer";
import { grepWiki, listOutputs } from "./kb";
import { routeQuickCapture } from "./quick-capture";
import { recentErrors, resolveError } from "./errors";

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
    name: "gmail_list_labels",
    description:
      "List user-created Gmail labels (categories). Returns name + id for each. Call before applying labels so you know which ones exist. Do not invent label IDs.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "gmail_label_thread",
    description:
      "Add or remove labels (categories) on a Gmail thread. Use to categorize threads during triage (e.g., Work, Bills, Newsletters). Pass label IDs from gmail_list_labels. Multiple labels allowed.",
    input_schema: {
      type: "object",
      properties: {
        thread_id: { type: "string", description: "Gmail thread id." },
        add: {
          type: "array",
          items: { type: "string" },
          description: "Label IDs to add.",
        },
        remove: {
          type: "array",
          items: { type: "string" },
          description: "Label IDs to remove.",
        },
      },
      required: ["thread_id"],
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
    name: "calendar_create_event",
    description:
      "Create a Google Calendar event on the primary calendar. Times are ISO 8601 (e.g. '2026-05-12T15:00:00-04:00'). Returns event id + html link.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Event title." },
        start: { type: "string", description: "ISO 8601 start datetime." },
        end: { type: "string", description: "ISO 8601 end datetime." },
        description: { type: "string" },
        location: { type: "string" },
        attendees: {
          type: "array",
          items: { type: "string" },
          description: "Email addresses.",
        },
      },
      required: ["summary", "start", "end"],
    },
  },
  {
    name: "calendar_reschedule_event",
    description: "Move an existing event to a new start/end (ISO 8601).",
    input_schema: {
      type: "object",
      properties: {
        event_id: { type: "string" },
        start: { type: "string" },
        end: { type: "string" },
      },
      required: ["event_id", "start", "end"],
    },
  },
  {
    name: "calendar_cancel_event",
    description: "Delete an event from the primary calendar. Irreversible — confirm with user first.",
    input_schema: {
      type: "object",
      properties: { event_id: { type: "string" } },
      required: ["event_id"],
    },
  },
  {
    name: "task_create",
    description:
      "Add an Obsidian task to a file in <vault>/Tasks/. Format follows Obsidian Tasks plugin (📅 due, 🛫 start, ⏳ scheduled, priority emoji). Default file: 'Inbox'.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Task text (without [ ] prefix)." },
        file: {
          type: "string",
          description: "File in Tasks/ folder, no extension (e.g. 'Personal', 'Work', 'Side Projects'). Defaults to 'Inbox'.",
        },
        due: { type: "string", description: "YYYY-MM-DD." },
        start: { type: "string" },
        scheduled: { type: "string" },
        priority: {
          type: "string",
          enum: ["highest", "high", "medium", "low", "lowest"],
        },
      },
      required: ["text"],
    },
  },
  {
    name: "task_done",
    description:
      "Mark an Obsidian task as done in a Tasks/ file. Matches by substring of task text. Sets ✅ done date to today. Returns count of matched lines.",
    input_schema: {
      type: "object",
      properties: {
        file: { type: "string", description: "Tasks file (e.g. 'Personal')." },
        text: { type: "string", description: "Substring of the task to match." },
      },
      required: ["file", "text"],
    },
  },
  {
    name: "kb_grep",
    description:
      "Search the wiki of a category by regex/string (case-insensitive). Returns matches with path, line number, snippet. Use this to find compiled knowledge fast before reading full pages.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string" },
        query: { type: "string", description: "Regex or substring." },
      },
      required: ["query"],
    },
  },
  {
    name: "route_quick_capture",
    description:
      "Scan today's daily note Quick Capture section for lines tagged with #category (matched case-insensitive to existing categories). For each match, kb_ingest the line to that category's raw/ and remove it from Quick Capture. Returns {processed, unrouted}. Untagged lines stay.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "kb_list_outputs",
    description:
      "List recent finished deliverables in a category's output/ folder.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string" },
        limit: { type: "integer" },
      },
    },
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
    name: "kb_wiki_write",
    description:
      "Write or overwrite a wiki page in a category's wiki/ folder. Path is relative to wiki/ (e.g. 'INDEX.md', 'concepts/foo.md', 'sources/2026-05-13.md'). Use for surgical fixes between full compile passes — edit INDEX, fix a source page, patch a concept. Read the page first with kb_read_wiki_page if you're doing a partial edit. Full content replaces the file.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string" },
        path: {
          type: "string",
          description: "Path relative to wiki/, e.g. 'INDEX.md' or 'sources/2026-05-13.md'.",
        },
        content: { type: "string", description: "Full file contents." },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "kb_wiki_delete",
    description:
      "Delete a wiki page. Path is relative to wiki/. Irreversible — use sparingly (e.g. removing a stale source page). Prefer kb_wiki_write to update content.",
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
    name: "get_errors",
    description:
      "Read recent errors from the in-app error log (the 'Errors' panel in the dashboard). Returns array of {id, ts, source, message, context, resolved_at}. Use to diagnose what's broken when Isaac says 'fix the errors' / 'look at the error log'. Default returns unresolved only.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Max rows (default 30, max 100)." },
        include_resolved: {
          type: "boolean",
          description: "Include already-resolved errors. Default false.",
        },
      },
    },
  },
  {
    name: "resolve_error",
    description:
      "Mark an error in the error log as resolved by id. Call after you've actually fixed the underlying issue, not just acknowledged it.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Error id from get_errors." },
      },
      required: ["id"],
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
      case "gmail_list_labels": {
        const labels = await listLabels();
        // Return only fields the agent needs to keep the response tight.
        return {
          ok: true,
          result: labels
            .filter((l) => l.type === "user")
            .map((l) => ({
              id: l.id,
              name: l.name,
              unread: l.unread,
              total: l.total,
            })),
        };
      }
      case "gmail_label_thread": {
        const add = Array.isArray(input.add) ? (input.add as string[]) : [];
        const remove = Array.isArray(input.remove)
          ? (input.remove as string[])
          : [];
        if (add.length === 0 && remove.length === 0) {
          return { ok: false, error: "add or remove required" };
        }
        await modifyThread(String(input.thread_id), {
          addLabelIds: add.length ? add : undefined,
          removeLabelIds: remove.length ? remove : undefined,
        });
        return { ok: true, result: { ok: true } };
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
      case "calendar_create_event": {
        const r = await createEvent({
          summary: String(input.summary),
          start: String(input.start),
          end: String(input.end),
          description: input.description ? String(input.description) : undefined,
          location: input.location ? String(input.location) : undefined,
          attendees: Array.isArray(input.attendees)
            ? (input.attendees as string[])
            : undefined,
        });
        return { ok: true, result: r };
      }
      case "calendar_reschedule_event": {
        const r = await rescheduleEvent({
          eventId: String(input.event_id),
          start: String(input.start),
          end: String(input.end),
        });
        return { ok: true, result: r };
      }
      case "calendar_cancel_event": {
        const r = await cancelEvent(String(input.event_id));
        return { ok: true, result: r };
      }
      case "task_create": {
        const r = await appendTask({
          text: String(input.text),
          file: input.file ? String(input.file) : undefined,
          due: input.due ? String(input.due) : undefined,
          start: input.start ? String(input.start) : undefined,
          scheduled: input.scheduled ? String(input.scheduled) : undefined,
          priority: input.priority
            ? (String(input.priority) as
                | "highest"
                | "high"
                | "medium"
                | "low"
                | "lowest")
            : undefined,
        });
        return { ok: true, result: r };
      }
      case "task_done": {
        const r = await markTaskDone({
          file: String(input.file),
          text: String(input.text),
        });
        return r.ok ? { ok: true, result: r } : { ok: false, error: r.error };
      }
      case "kb_grep": {
        const category = String(input.category ?? ctx.category ?? "Personal");
        const matches = await grepWiki(category, String(input.query));
        return { ok: true, result: { category, query: String(input.query), matches } };
      }
      case "route_quick_capture": {
        const r = await routeQuickCapture();
        return { ok: true, result: r };
      }
      case "kb_list_outputs": {
        const category = String(input.category ?? ctx.category ?? "Personal");
        const limit = Number(input.limit ?? 10);
        const files = await listOutputs(category, limit);
        return { ok: true, result: { category, files } };
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
      case "kb_wiki_write": {
        const category = String(input.category ?? ctx.category ?? "Personal");
        await ensureCategory(category);
        const r = await wikiWrite(
          category,
          String(input.path),
          String(input.content),
        );
        return { ok: true, result: { path: r.path, category } };
      }
      case "kb_wiki_delete": {
        const category = String(input.category ?? ctx.category ?? "Personal");
        await wikiDelete(category, String(input.path));
        return { ok: true, result: { ok: true, category, path: String(input.path) } };
      }
      case "get_errors": {
        const limit = Math.max(1, Math.min(100, Number(input.limit ?? 30)));
        const includeResolved = Boolean(input.include_resolved ?? false);
        const errors = recentErrors(limit, includeResolved);
        return { ok: true, result: { errors, count: errors.length } };
      }
      case "resolve_error": {
        const id = String(input.id ?? "");
        if (!id) return { ok: false, error: "id required" };
        const ok = resolveError(id);
        return { ok: true, result: { resolved: ok, id } };
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
