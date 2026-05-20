import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---- Module mocks ---------------------------------------------------------
//
// We don't want streamAgent to touch the real Anthropic API, the vault, the
// usage log, or the settings file. Mock everything around it so each test can
// describe a tiny SDK transcript and assert on the events the generator emits
// + the calls it makes into recordUsage / runTool.

// Pretend the env has an API key so streamAgent doesn't early-return.
vi.mock("./config", () => ({ env: { ANTHROPIC_API_KEY: "test-key" } }));

const recordUsage = vi.fn();
const getTodaySpendUsd = vi.fn(() => 0);
vi.mock("./usage", async () => {
  const actual = await vi.importActual<typeof import("./usage")>("./usage");
  return {
    ...actual,
    recordUsage: (...args: unknown[]) => recordUsage(...args),
    getTodaySpendUsd: () => getTodaySpendUsd(),
  };
});

type ToolResult = { ok: boolean; result?: unknown; error?: string };
const runTool = vi.fn<(...args: unknown[]) => Promise<ToolResult>>(
  async () => ({ ok: true, result: {} }),
);
type ValidatedInput =
  | { ok: true; input: Record<string, unknown> }
  | { ok: false; error: string };
const validateToolInput = vi.fn<(name: string, raw: unknown) => ValidatedInput>(
  (_n, raw) => ({ ok: true, input: (raw as Record<string, unknown>) ?? {} }),
);
vi.mock("./agent-tools", () => ({
  tools: [],
  runTool: (...args: unknown[]) => runTool(...(args as Parameters<typeof runTool>)),
  validateToolInput: (name: string, raw: unknown) => validateToolInput(name, raw),
}));

vi.mock("./kb", () => ({
  writeRawAgentRun: vi.fn(async () => "raw/test.md"),
}));

let budgetDailyUsd = 0;
vi.mock("./settings", () => ({
  getSettings: () => ({ budgetDailyUsd }),
}));

vi.mock("./errors", () => ({ logError: vi.fn() }));

// The agent calls `new Anthropic({...})` and then `client.messages.stream(...)`.
// We need to drive that stream by hand so tests can control how many events
// land and what stop_reason fires. The shape returned from .stream() must be:
//   - async-iterable (drives the streamed-event for-await loop)
//   - finalMessage() returns the assembled message
type Event = { type: string; [k: string]: unknown };

function makeStream(events: Event[], final: {
  stop_reason: string;
  content: Array<{ type: string; [k: string]: unknown }>;
  usage: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}) {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        async next() {
          if (i >= events.length) return { value: undefined, done: true };
          return { value: events[i++], done: false };
        },
      };
    },
    async finalMessage() {
      return final;
    },
  };
}

const streamFn = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    messages = { stream: streamFn };
  }
  return { default: FakeAnthropic };
});

import { streamAgent } from "./agent";

beforeEach(() => {
  recordUsage.mockClear();
  getTodaySpendUsd.mockReset();
  getTodaySpendUsd.mockReturnValue(0);
  runTool.mockReset();
  runTool.mockResolvedValue({ ok: true, result: {} });
  validateToolInput.mockReset();
  validateToolInput.mockImplementation((_n, raw) => ({
    ok: true,
    input: (raw as Record<string, unknown>) ?? {},
  }));
  streamFn.mockReset();
  budgetDailyUsd = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

async function collect(
  gen: AsyncGenerator<{ type: string; data: unknown }>,
): Promise<Array<{ type: string; data: unknown }>> {
  const out: Array<{ type: string; data: unknown }> = [];
  for await (const ev of gen) out.push(ev);
  return out;
}

describe("streamAgent abort signal (issue #25)", () => {
  it("short-circuits the tool loop and emits 'aborted' when signal fires before next iteration", async () => {
    // First model response: a tool_use that asks us to run a tool. The agent
    // will call runTool, push results, and start another iteration — that's
    // where the abort check fires.
    streamFn.mockImplementationOnce(() =>
      makeStream(
        [
          {
            type: "content_block_start",
            content_block: { type: "tool_use", name: "gmail_send", id: "tu_1" },
          },
        ],
        {
          stop_reason: "tool_use",
          content: [
            {
              type: "tool_use",
              id: "tu_1",
              name: "gmail_send",
              input: { to: "x@y.z" },
            },
          ],
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      ),
    );

    const ctrl = new AbortController();
    // runTool resolves once, then we trip the abort so the *next* iteration
    // never makes another API call.
    runTool.mockImplementationOnce(async () => {
      ctrl.abort();
      return { ok: true, result: { sent: true } };
    });

    const events = await collect(
      streamAgent([{ role: "user", content: "hi" }], { signal: ctrl.signal }),
    );

    const aborted = events.find((e) => e.type === "aborted");
    expect(aborted, "should emit 'aborted' SSE event").toBeDefined();
    expect(aborted?.data).toMatch(/aborted by user/i);
    // The model was only called once — the loop did NOT spin up a second iter.
    expect(streamFn).toHaveBeenCalledTimes(1);
    // Usage was still recorded so spend isn't lost.
    expect(recordUsage).toHaveBeenCalled();
  });

  it("skips dispatching pending tools and emits a failed tool_result when abort fires mid-batch", async () => {
    streamFn.mockImplementationOnce(() =>
      makeStream(
        [],
        {
          stop_reason: "tool_use",
          content: [
            {
              type: "tool_use",
              id: "tu_first",
              name: "gmail_send",
              input: {},
            },
            {
              type: "tool_use",
              id: "tu_second",
              name: "gmail_archive",
              input: {},
            },
          ],
          usage: { input_tokens: 10, output_tokens: 5 },
        },
      ),
    );

    const ctrl = new AbortController();
    // The agent walks the tool batch in order — abort after the first tool
    // resolves so the second is never dispatched.
    runTool.mockImplementationOnce(async () => {
      ctrl.abort();
      return { ok: true, result: { sent: true } };
    });
    runTool.mockImplementationOnce(async () => {
      throw new Error("second tool should not have been dispatched");
    });

    const events = await collect(
      streamAgent([{ role: "user", content: "hi" }], { signal: ctrl.signal }),
    );

    // The second tool's runTool was never called — abort short-circuited it.
    expect(runTool).toHaveBeenCalledTimes(1);
    // The UI still got a tool_result event for the skipped tool so its
    // spinner resolves rather than hanging.
    const archiveResult = events.find(
      (e) =>
        e.type === "tool_result" &&
        (e.data as { name: string }).name === "gmail_archive",
    );
    expect(archiveResult).toBeDefined();
    expect((archiveResult?.data as { ok: boolean }).ok).toBe(false);
    expect(events.some((e) => e.type === "aborted")).toBe(true);
  });
});

describe("streamAgent mid-flight budget cap (issue #26)", () => {
  it("aborts the loop with a 'budget cap exceeded' error after the iteration that crosses the cap", async () => {
    // Budget: $0.10. Each iteration burns enough Opus tokens to cost a lot
    // more than that on its own, so the post-iteration check should fire and
    // prevent a second model call.
    budgetDailyUsd = 0.1;
    getTodaySpendUsd.mockReturnValue(0);

    // 1M output tokens of opus-4-7 = $25, way over the $0.10 cap.
    streamFn.mockImplementationOnce(() =>
      makeStream(
        [],
        {
          stop_reason: "tool_use",
          content: [
            {
              type: "tool_use",
              id: "tu_1",
              name: "noop",
              input: {},
            },
          ],
          usage: { input_tokens: 0, output_tokens: 1_000_000 },
        },
      ),
    );

    const events = await collect(
      streamAgent([{ role: "user", content: "hi" }]),
    );

    // Only one model call — the post-iteration check tripped the cap.
    expect(streamFn).toHaveBeenCalledTimes(1);
    const err = events.find((e) => e.type === "error");
    expect(err, "should emit budget-cap error").toBeDefined();
    expect(String(err?.data)).toMatch(/budget cap/i);
    // Usage was recorded — the user paid for what they got, no silent loss.
    expect(recordUsage).toHaveBeenCalled();
  });

  it("emits an interim recordUsage between iterations so concurrent processes see spend in near-real time", async () => {
    // Two iterations, neither over cap, end with end_turn on second.
    streamFn.mockImplementationOnce(() =>
      makeStream(
        [],
        {
          stop_reason: "tool_use",
          content: [
            { type: "tool_use", id: "tu_a", name: "noop", input: {} },
          ],
          usage: { input_tokens: 1000, output_tokens: 500 },
        },
      ),
    );
    streamFn.mockImplementationOnce(() =>
      makeStream(
        [{ type: "content_block_delta", delta: { type: "text_delta", text: "ok" } }],
        {
          stop_reason: "end_turn",
          content: [{ type: "text", text: "ok" }],
          usage: { input_tokens: 500, output_tokens: 100 },
        },
      ),
    );

    await collect(streamAgent([{ role: "user", content: "hi" }]));

    // At least one interim record before the final end_turn record.
    expect(recordUsage.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

describe("streamAgent tool input validation (issue #27)", () => {
  it("returns a ToolInputError without dispatching when zod rejects the input", async () => {
    // Model asks to call a tool with bogus input — validator should bounce it
    // before runTool ever sees it.
    validateToolInput.mockImplementationOnce(() => ({
      ok: false,
      error: "to must be a string",
    }));

    streamFn.mockImplementationOnce(() =>
      makeStream(
        [],
        {
          stop_reason: "tool_use",
          content: [
            {
              type: "tool_use",
              id: "tu_bad",
              name: "gmail_send",
              input: { to: 42 },
            },
          ],
          usage: { input_tokens: 5, output_tokens: 5 },
        },
      ),
    );
    // Second iter ends the turn so the loop terminates cleanly.
    streamFn.mockImplementationOnce(() =>
      makeStream([], {
        stop_reason: "end_turn",
        content: [],
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    );

    const events = await collect(
      streamAgent([{ role: "user", content: "hi" }]),
    );

    expect(runTool).not.toHaveBeenCalled();
    const result = events.find(
      (e) =>
        e.type === "tool_result" &&
        (e.data as { name: string }).name === "gmail_send",
    );
    expect(result).toBeDefined();
    expect((result?.data as { ok: boolean }).ok).toBe(false);
  });
});
