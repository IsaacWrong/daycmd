import Anthropic from "@anthropic-ai/sdk";
import { env } from "./config";
import {
  ensureCategory,
  readSchema,
  readWikiIndex,
  listWikiPages,
  readWikiPage,
} from "./kb";
import { recordUsage } from "./usage";
import { logError } from "./errors";

const MODEL = "claude-sonnet-4-6";

const tools: Anthropic.Tool[] = [
  {
    name: "schema_read",
    description: "Read global + category schemas.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "wiki_list",
    description: "List all wiki page paths (relative to wiki/).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "wiki_read",
    description: "Read a wiki page. Path relative to wiki/.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "wiki_index_read",
    description: "Read wiki/INDEX.md.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "report_lint",
    description:
      "Submit lint findings and end the lint pass. Each finding has type (contradiction | orphan | missing_concept | broken_link | other), location (page path or 'wiki' for global), and description (1-2 sentences). Provide an empty findings array if wiki is clean.",
    input_schema: {
      type: "object",
      properties: {
        findings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: [
                  "contradiction",
                  "orphan",
                  "missing_concept",
                  "broken_link",
                  "other",
                ],
              },
              location: { type: "string" },
              description: { type: "string" },
            },
            required: ["type", "location", "description"],
          },
        },
        summary: {
          type: "string",
          description: "1-3 sentence overall assessment.",
        },
      },
      required: ["findings", "summary"],
    },
  },
];

function systemPrompt(category: string): string {
  return `You are linting the wiki for "${category}" category. READ-ONLY pass.

Steps:
1. schema_read — understand the rules.
2. wiki_list + wiki_index_read — overview.
3. Sample-read key wiki pages (especially concepts/) to check:
   - Contradictions
   - Orphans (concept pages not linked from anywhere — check INDEX and other concepts for [[wikilinks]])
   - Missing concepts (mentioned via [[link]] but no page exists)
   - Broken links
4. report_lint with structured findings and a summary.

What "contradiction" means here:
- Two pages make conflicting *factual* claims about the same thing (e.g. page A says X started in 2024, page B says 2025).
- It is NOT a contradiction when a page describes past events with past-dated headers, even if the date is no longer "today". A page dated 2026-05-12 with calendar entries for that day is correct, not stale. The fact that the dashboard's current date has moved on is irrelevant.
- DO flag relative time words ("today", "yesterday", "this week", "now") in wiki pages — those violate the schema and cause real drift. Report those as type "other" with a clear description.

Don't try to read every page. Spot-check. Lint should be cheap.

If wiki is empty or near-empty, report_lint with empty findings and a note like "Wiki has only N pages, nothing to lint yet."`;
}

export async function* streamLint(
  category: string,
): AsyncGenerator<{ type: string; data: unknown }> {
  if (!env.ANTHROPIC_API_KEY) {
    yield { type: "error", data: "ANTHROPIC_API_KEY not set" };
    return;
  }
  await ensureCategory(category);
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const totals = {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
  };

  const apiMessages: Anthropic.MessageParam[] = [
    { role: "user", content: `Lint the "${category}" wiki.` },
  ];

  const MAX_ITERATIONS = 12;
  try {
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 8000,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        system: systemPrompt(category),
        tools,
        messages: apiMessages,
      });

      for await (const event of stream) {
        if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
          yield { type: "tool_start", data: { name: event.content_block.name } };
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

      if (final.stop_reason === "end_turn") break;
      if (final.stop_reason !== "tool_use") {
        throw new Error(`stopped: ${final.stop_reason}`);
      }

      const toolUses = final.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      const results: Anthropic.ToolResultBlockParam[] = [];
      let finished = false;

      for (const tu of toolUses) {
        const input = tu.input as Record<string, unknown>;
        let payload: unknown;
        let isError = false;
        try {
          switch (tu.name) {
            case "schema_read":
              payload = await readSchema(category);
              break;
            case "wiki_list":
              payload = await listWikiPages(category);
              break;
            case "wiki_index_read":
              payload = await readWikiIndex(category);
              break;
            case "wiki_read":
              payload = await readWikiPage(category, String(input.path));
              break;
            case "report_lint":
              payload = { ok: true };
              finished = true;
              yield {
                type: "lint_result",
                data: { findings: input.findings, summary: input.summary },
              };
              break;
            default:
              throw new Error(`unknown: ${tu.name}`);
          }
        } catch (e) {
          isError = true;
          payload = { error: (e as Error).message };
        }
        yield { type: "tool_result", data: { name: tu.name, ok: !isError } };
        results.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(payload).slice(0, 40_000),
          is_error: isError,
        });
      }
      apiMessages.push({ role: "user", content: results });
      if (finished) break;
    }
    recordUsage({ source: `kb_lint:${category}`, model: MODEL, ...totals });
    yield { type: "usage", data: totals };
    yield { type: "done", data: null };
  } catch (e) {
    recordUsage({ source: `kb_lint:${category}`, model: MODEL, ...totals });
    logError(`kb_lint:${category}`, (e as Error).message);
    yield { type: "error", data: (e as Error).message };
  }
}
