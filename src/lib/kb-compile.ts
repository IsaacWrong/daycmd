import Anthropic from "@anthropic-ai/sdk";
import { env } from "./config";
import {
  ensureCategory,
  readSchema,
  readWikiIndex,
  listWikiPages,
  readWikiPage,
  listRawFiles,
  readRawFile,
  wikiWrite,
  wikiDelete,
  recordCompileStart,
  recordCompileEnd,
} from "./kb";
import { recordUsage } from "./usage";
import { logError } from "./errors";

const MODEL = "claude-sonnet-4-6";

const tools: Anthropic.Tool[] = [
  {
    name: "schema_read",
    description: "Read global + category schemas. Call this first.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "wiki_index_read",
    description: "Read wiki/INDEX.md for this category.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "wiki_list",
    description: "List all wiki page paths (relative to wiki/).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "wiki_read",
    description: "Read a wiki page. Path is relative to wiki/, e.g. 'concepts/attention.md'.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "wiki_write",
    description:
      "Write/overwrite a wiki page. Path is relative to wiki/. Content should include frontmatter (type, tags, sources, updated).",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "wiki_delete",
    description: "Delete a wiki page (e.g. when merging duplicates).",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "raw_list",
    description:
      "List raw files. If since_iso provided, only files modified after that timestamp.",
    input_schema: {
      type: "object",
      properties: {
        since_iso: {
          type: "string",
          description: "ISO 8601. Optional. If omitted, lists all raws.",
        },
      },
    },
  },
  {
    name: "raw_read",
    description: "Read a raw file by filename (no path, just e.g. '2026-05-11T2045-foo.md').",
    input_schema: {
      type: "object",
      properties: { filename: { type: "string" } },
      required: ["filename"],
    },
  },
  {
    name: "compile_done",
    description:
      "Signal the compile is complete. Provide a 3-5 bullet summary of what changed, key new ideas, and anything that needs human attention.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string" },
      },
      required: ["summary"],
    },
  },
];

function systemPrompt(category: string, lastCompileIso: string | null): string {
  return `You are compiling the wiki for the "${category}" category in Isaac's knowledge base.

${lastCompileIso ? `Last compile: ${lastCompileIso}. Focus on raws newer than this (incremental compile). Pass this ISO to raw_list as since_iso.` : "First compile for this category. Process all raws."}

Your job:
1. schema_read — read the rules.
2. wiki_index_read + wiki_list — understand current state.
3. raw_list (with since_iso if incremental) — get raws to process.
4. For each raw: raw_read, decide what concepts/sources/people pages to create or update, then wiki_read existing candidates and wiki_write the updates.
5. Update wiki/INDEX.md to reflect changes.
6. Deduplicate as you go. Merge duplicate concept pages, leaving redirect stubs.
7. compile_done with a tight summary.

Rules:
- Never edit raw files (you don't have a tool to do so anyway).
- Every wiki page MUST have frontmatter (type, tags, sources, updated).
- Cite raws in the \`sources:\` frontmatter list.
- Keep pages dense. 3 sentences of signal beats 3 paragraphs of fluff.
- If a raw is just a one-line agent run with no real content, skip it (don't make wiki pages for noise, but optionally note in INDEX under "Recent agent runs" if relevant).
- Use Obsidian [[wikilinks]] in body.
- **Never use relative time words** in any wiki page: no "today", "yesterday", "tomorrow", "this week", "now", "currently", "recently", "earlier", "soon". Use absolute ISO dates (YYYY-MM-DD) or weekday + date ("Tue 5/13"). Section headers must be date-stamped, not "today"-stamped — write \`### Calendar — 2026-05-12\`, never \`### Today's Calendar\`. The only "as of" claim is the frontmatter \`updated:\` field plus, on INDEX, one optional \`Last compile: YYYY-MM-DD\` header.
- **INDEX is not a dashboard mirror.** Don't enumerate live state (calendar events, open tasks, GitHub PRs, inbox items) in INDEX. The live app surfaces that. INDEX is a pointer to concepts/sources/people pages plus enduring open questions.

Be efficient. Don't read every wiki page upfront — only the ones a raw touches. Batch tool calls when possible.`;
}

export async function* streamCompile(
  category: string,
): AsyncGenerator<{ type: string; data: unknown }> {
  if (!env.ANTHROPIC_API_KEY) {
    yield { type: "error", data: "ANTHROPIC_API_KEY not set" };
    return;
  }
  await ensureCategory(category);
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const compileId = recordCompileStart(category);

  const { recentCompiles } = await import("./kb");
  const lastSuccess = (recentCompiles(category, 10) as Array<{
    ok: number | null;
    ended_at: number | null;
  }>).find((c) => c.ok === 1 && c.ended_at);
  const lastCompileMs = lastSuccess?.ended_at ?? null;
  const lastIso = lastCompileMs ? new Date(lastCompileMs).toISOString() : null;

  yield {
    type: "tool_start",
    data: { name: "compile_init" },
  };

  const totals = {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
  };

  const apiMessages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Begin compiling "${category}". ${lastIso ? `Last compile was ${lastIso}.` : "First compile."}`,
    },
  ];

  let finalSummary = "";
  const MAX_ITERATIONS = 24;

  try {
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        output_config: { effort: "high" },
        system: [
          {
            type: "text",
            text: systemPrompt(category, lastIso),
            cache_control: { type: "ephemeral" },
          },
        ],
        tools,
        messages: apiMessages,
      });

      for await (const event of stream) {
        if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
          yield {
            type: "tool_start",
            data: { name: event.content_block.name },
          };
        } else if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield { type: "text", data: event.delta.text };
        }
      }

      const final = await stream.finalMessage();
      apiMessages.push({ role: "assistant", content: final.content });
      totals.input_tokens += final.usage.input_tokens ?? 0;
      totals.output_tokens += final.usage.output_tokens ?? 0;
      totals.cache_read_tokens += final.usage.cache_read_input_tokens ?? 0;
      totals.cache_write_tokens += final.usage.cache_creation_input_tokens ?? 0;

      if (final.stop_reason === "end_turn") {
        break;
      }
      if (final.stop_reason !== "tool_use") {
        throw new Error(`stopped: ${final.stop_reason}`);
      }

      const toolUses = final.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      const results: Anthropic.ToolResultBlockParam[] = [];
      let compileFinished = false;

      for (const tu of toolUses) {
        const input = tu.input as Record<string, unknown>;
        let payload: unknown;
        let isError = false;
        try {
          switch (tu.name) {
            case "schema_read":
              payload = await readSchema(category);
              break;
            case "wiki_index_read":
              payload = await readWikiIndex(category);
              break;
            case "wiki_list":
              payload = await listWikiPages(category);
              break;
            case "wiki_read":
              payload = await readWikiPage(category, String(input.path));
              break;
            case "wiki_write": {
              const r = await wikiWrite(
                category,
                String(input.path),
                String(input.content),
              );
              payload = r;
              break;
            }
            case "wiki_delete":
              await wikiDelete(category, String(input.path));
              payload = { ok: true };
              break;
            case "raw_list": {
              const sinceIso = input.since_iso ? String(input.since_iso) : null;
              const sinceMs = sinceIso ? Date.parse(sinceIso) : null;
              payload = await listRawFiles(category, sinceMs);
              break;
            }
            case "raw_read":
              payload = await readRawFile(category, String(input.filename));
              break;
            case "compile_done":
              finalSummary = String(input.summary ?? "");
              compileFinished = true;
              payload = { ok: true };
              break;
            default:
              throw new Error(`unknown tool: ${tu.name}`);
          }
        } catch (e) {
          isError = true;
          payload = { error: (e as Error).message };
        }
        yield { type: "tool_result", data: { name: tu.name, ok: !isError } };
        results.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(payload).slice(0, 60_000),
          is_error: isError,
        });
      }

      apiMessages.push({ role: "user", content: results });
      if (compileFinished) break;
    }

    recordUsage({ source: `kb_compile:${category}`, model: MODEL, ...totals });
    recordCompileEnd(compileId, {
      ok: true,
      summary: finalSummary,
      usage: totals,
    });
    yield { type: "usage", data: totals };
    yield { type: "done", data: { summary: finalSummary } };
  } catch (e) {
    recordUsage({ source: `kb_compile:${category}`, model: MODEL, ...totals });
    recordCompileEnd(compileId, {
      ok: false,
      error: (e as Error).message,
      usage: totals,
    });
    logError(`kb_compile:${category}`, (e as Error).message);
    yield { type: "error", data: (e as Error).message };
  }
}
