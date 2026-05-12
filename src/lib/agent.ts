import Anthropic from "@anthropic-ai/sdk";
import { env } from "./config";
import { tools, runTool } from "./agent-tools";
import { recordUsage, getTodaySpendUsd } from "./usage";
import { writeRawAgentRun } from "./kb";
import { getSettings } from "./settings";
import { logError } from "./errors";

export type ClientMessage = {
  role: "user" | "assistant";
  content: string;
};

const SYSTEM_PROMPT = `You are the agent inside AI OS — Isaac's personal dashboard. You help him manage his day across Obsidian (his memory + tasks vault), Gmail, Google Calendar, and GitHub.

Style:
- Direct, terse, no fluff. Skip preamble.
- Use markdown. Tight lists over walls of text.
- When you take action (writing to vault), say what you did in one line.
- When data is missing or a service isn't connected, say so briefly and keep going with what you have.

Tools:
- Use get_tasks / get_inbox / get_calendar / get_github_summary to pull live state. Don't ask the user — fetch.
- append_to_daily_note for capturing ideas, journal entries, or notes. Common sections: "Quick Capture", "Journal", "Side Projects".
- read_past_daily_notes for reflection or weekly review.

Gmail actions:
- gmail_archive / gmail_mark_read / gmail_star / gmail_trash for triage. Archive freely during triage — it's reversible.
- gmail_unsubscribe: NEVER call without explicit confirmation. Unsubscribing is one-way and Isaac may want to keep some "marketing" senders. Always propose first — list the candidate newsletters with sender + subject, then wait. Only execute on a clear "yes" / "go" / "all" / "do it" or a specific list. Even during a triage skill, propose-then-confirm for unsubscribes.
- gmail_get_message to read full body before replying or summarizing.
- For replies: ALWAYS use gmail_draft_reply (not gmail_send) unless Isaac explicitly says "send it". Drafts land in Gmail for him to review and send.
- For new emails: gmail_create_draft is the default. Only gmail_send if he says "send" explicitly.
- When triaging, batch tool calls — archive many in one turn rather than one-at-a-time round trips.

Inbox triage protocol:
1. Call get_inbox with query='in:inbox' (no category filter) and max=50 — pulls EVERYTHING in inbox including Promotions/Social.
2. Compare result.returned vs result.estimatedTotal. If different, page or increase max.
3. State the count up front ("X emails in inbox") so Isaac knows you have the full set.
4. Then triage.

Context:
- Isaac's side projects: Palm Commissions, Exit Edge AI, iWrightCode.
- Obsidian vault uses Tasks plugin format (📅 due, 🛫 start, ⏫ priority, etc.).
- Today's daily note lives at Daily/YYYY-MM-DD.md.

Web research:
- web_search and web_fetch are server-hosted tools. Use them for anything past your training cutoff or anything specific to current news, regulations, prices, docs, etc. Don't refuse a research request — search.
- Pattern: web_search for discovery, web_fetch on the most promising URL(s) for deep read. Cite URLs as inline markdown links like [Title](url).

Substantive outputs:
- If your reply is a substantive deliverable (research summary, weekly review, plan, draft, anything you'd want to read again later), CALL kb_write_output FIRST with the polished markdown, THEN show it in chat. One write. Not a placeholder then a real version.
- For research specifically, kb_ingest the source findings to raw/ AND kb_write_output the polished summary. Different purposes: ingest = source material for compile, write_output = ready-to-read artifact.
- Chat is for ephemeral back-and-forth. Files are for keepsakes. If the user asked for "a summary" or "a report" or "an analysis", they want a file.

Output formatting:
- Use real markdown: # / ## / ### headings, bullet lists, **bold**, [links](url), tables when comparing things, fenced code blocks. Renderer supports GFM.
- Lead with the punchline. Headings group sections. Tables for comparisons. Bullet lists for enumerations.

Calendar + Tasks (write):
- calendar_create_event / calendar_reschedule_event for booking time. For cancel, ASK FIRST — cancellation is irreversible and may notify attendees.
- task_create to capture todos into <vault>/Tasks/<file>.md. Default file Inbox; route to Personal/Work/Side Projects when obvious.
- task_done marks an existing task complete (matches by substring).

Knowledge base (Karpathy 3-tier per category):
- Every session has a current category (Personal, Research, Sales, project names, etc.). Every run of you is auto-logged to that category's raw/ folder — no action required from you.
- kb_query(category) reads the category's wiki INDEX + page list. Use this at the START of substantive work to ground yourself in prior compiled knowledge for the category. Skip for Personal-category quick tasks.
- kb_read_wiki_page(category, path) — read a specific wiki page.
- kb_grep(category, query) — fast regex search across all wiki pages. Use BEFORE web_search if topic is within an established category.
- kb_list_outputs(category) — see recent deliverables in output/.
- kb_ingest when the user gives you source material (article, paste, notes) — lands in raw/. Default category is the current session category unless they specify.
- kb_write_output when you produce a deliverable (drafted report, summary worth keeping, deck outline) — lands in output/. Don't kb_write_output for chat replies — only for things he'll come back to.
- The wiki is compiled by a separate user-triggered pass. Don't try to write to wiki/ directly.`;

const DEFAULT_MODEL = "claude-opus-4-7";
const DEFAULT_EFFORT: "high" = "high";
const DEFAULT_MAX_TOKENS = 16000;
type Effort = "low" | "medium" | "high" | "xhigh" | "max";

function clampEffort(model: string, effort: Effort): Effort {
  // Sonnet 4.6 / Haiku don't support xhigh or max — clamp to high.
  if (model.startsWith("claude-sonnet") || model.startsWith("claude-haiku")) {
    if (effort === "xhigh" || effort === "max") return "high";
  }
  return effort;
}

export type UsageTotals = {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
};

export async function* streamAgent(
  messages: ClientMessage[],
  opts: {
    source?: string;
    category?: string;
    containerId?: string;
    model?: string;
    effort?: Effort;
    maxTokens?: number;
  } = {},
): AsyncGenerator<{ type: string; data: unknown }> {
  if (!env.ANTHROPIC_API_KEY) {
    yield { type: "error", data: "ANTHROPIC_API_KEY not set in .env.local" };
    return;
  }

  // Hard budget cap check
  const settings = getSettings();
  if (settings.budgetDailyUsd > 0) {
    const spent = getTodaySpendUsd();
    if (spent >= settings.budgetDailyUsd) {
      const msg = `Daily budget cap hit ($${spent.toFixed(2)} / $${settings.budgetDailyUsd}). Raise in Settings or wait until tomorrow.`;
      logError("agent.budget", msg);
      yield { type: "error", data: msg };
      return;
    }
  }

  const source = opts.source ?? "panel";
  const category = opts.category ?? "Personal";
  const model = opts.model ?? DEFAULT_MODEL;
  const effort = clampEffort(model, opts.effort ?? DEFAULT_EFFORT);
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  let containerId: string | null = opts.containerId ?? null;
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const apiMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const totals: UsageTotals = {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
  };

  const toolsUsed: Array<{ name: string; ok?: boolean }> = [];
  let collectedText = "";
  const userPrompt = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  async function logRaw(): Promise<void> {
    try {
      const rel = await writeRawAgentRun({
        category,
        prompt: userPrompt,
        output: collectedText,
        model,
        tools: toolsUsed,
        usage: totals,
        source,
      });
      return void rel;
    } catch (e) {
      console.error("[kb] failed to write raw:", (e as Error).message);
    }
  }

  const MAX_ITERATIONS = 8;
  try {
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const stream = client.messages.stream({
      ...(containerId ? { container: containerId } : {}),
      model,
      max_tokens: maxTokens,
      thinking: { type: "adaptive" },
      output_config: { effort },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral", ttl: "1h" },
        },
      ],
      tools,
      messages: apiMessages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        const block = event.content_block as { type: string; name?: string; id?: string };
        if (block.type === "tool_use" && block.name) {
          toolsUsed.push({ name: block.name });
          yield {
            type: "tool_start",
            data: { name: block.name, id: block.id },
          };
        } else if (block.type === "server_tool_use" && block.name) {
          toolsUsed.push({ name: block.name, ok: true });
          yield {
            type: "tool_start",
            data: { name: block.name, id: block.id },
          };
          yield {
            type: "tool_result",
            data: { name: block.name, ok: true },
          };
        }
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          collectedText += event.delta.text;
          yield { type: "text", data: event.delta.text };
        }
      } else if (event.type === "message_start") {
        // Initial message snapshot may include container if code_execution
        // was already provisioned server-side before streaming began.
        const c = (event.message as { container?: { id?: string } | null }).container;
        if (c && typeof c === "object" && c.id && c.id !== containerId) {
          containerId = c.id;
          yield { type: "container", data: containerId };
        }
      } else if (event.type === "message_delta") {
        // SDK aggregator drops container from message_delta — read it manually.
        const c = (event.delta as { container?: { id?: string } | null }).container;
        if (c && typeof c === "object" && c.id && c.id !== containerId) {
          containerId = c.id;
          yield { type: "container", data: containerId };
        }
      }
    }

    const final = await stream.finalMessage();
    apiMessages.push({ role: "assistant", content: final.content });
    console.log(
      `[agent] iter ${iter} stop_reason=${final.stop_reason} containerId=${containerId ?? "none"}`,
    );

    totals.input_tokens += final.usage.input_tokens ?? 0;
    totals.output_tokens += final.usage.output_tokens ?? 0;
    totals.cache_read_tokens += final.usage.cache_read_input_tokens ?? 0;
    totals.cache_write_tokens += final.usage.cache_creation_input_tokens ?? 0;

    if (final.stop_reason === "end_turn") {
      recordUsage({ source, model, ...totals });
      await logRaw();
      yield { type: "usage", data: totals };
      yield { type: "done", data: { category } };
      return;
    }

    if (final.stop_reason === "pause_turn") {
      // Server-side tool (web_search/web_fetch) hit its internal iteration cap.
      // Assistant content already appended above; re-issue with same messages
      // to let the server resume.
      continue;
    }

    if (final.stop_reason !== "tool_use") {
      recordUsage({ source, model, ...totals });
      await logRaw();
      yield {
        type: "error",
        data: `stopped with reason: ${final.stop_reason}`,
      };
      return;
    }

    const toolUses = final.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const out = await runTool(tu.name, tu.input as Record<string, unknown>, {
        category,
      });
      const payload = out.ok ? out.result : { error: out.error };
      const idx = toolsUsed.findIndex(
        (t) => t.name === tu.name && t.ok === undefined,
      );
      if (idx >= 0) toolsUsed[idx] = { name: tu.name, ok: out.ok };
      yield {
        type: "tool_result",
        data: { name: tu.name, ok: out.ok },
      };
      results.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(payload).slice(0, 50_000),
        is_error: !out.ok,
      });
    }
    apiMessages.push({ role: "user", content: results });
  }

  recordUsage({ source, model, ...totals });
  await logRaw();
  yield { type: "error", data: "max iterations reached" };
  } catch (e) {
    recordUsage({ source, model, ...totals });
    logError(`agent:${source}`, (e as Error).message, { category, model });
    await logRaw();
    yield { type: "error", data: (e as Error).message };
  }
}

export async function runAgentOnce(
  prompt: string,
  opts: {
    source: string;
    category?: string;
    model?: string;
    effort?: Effort;
    maxTokens?: number;
  },
): Promise<{
  ok: boolean;
  output: string;
  error?: string;
  usage: UsageTotals;
}> {
  let output = "";
  let error: string | undefined;
  let usage: UsageTotals = {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
  };
  // Default automations to cheaper Sonnet unless caller overrides.
  const runOpts = {
    model: "claude-sonnet-4-6",
    effort: "medium" as Effort,
    maxTokens: 8000,
    ...opts,
  };
  for await (const ev of streamAgent(
    [{ role: "user", content: prompt }],
    runOpts,
  )) {
    if (ev.type === "text") output += ev.data as string;
    else if (ev.type === "error") error = String(ev.data);
    else if (ev.type === "usage") usage = ev.data as UsageTotals;
  }
  return { ok: !error, output, error, usage };
}
