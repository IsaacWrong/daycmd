import { streamAgent, type ClientMessage } from "@/lib/agent";
import { getSettings } from "@/lib/settings";
import { SKILLS, resolveSkill, isValidModel } from "@/lib/skills-defs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    messages: ClientMessage[];
    category?: string;
    containerId?: string;
    skillId?: string;
    model?: string;
    effort?: "low" | "medium" | "high" | "xhigh" | "max";
    maxTokens?: number;
  };
  const messages = body.messages ?? [];
  const category = body.category;
  const containerId = body.containerId;

  const settings = getSettings();
  let model: string | undefined;
  let effort: "low" | "medium" | "high" | "xhigh" | "max" | undefined;
  let maxTokens: number | undefined;

  if (body.skillId) {
    const base = SKILLS.find((s) => s.id === body.skillId);
    if (base) {
      const merged = resolveSkill(base, settings.skillOverrides);
      model = merged.model;
      effort = merged.effort;
      maxTokens = merged.maxTokens;
    }
  }
  // Client-supplied values win (e.g. free-form chat picker).
  if (body.model && isValidModel(body.model)) model = body.model;
  else if (!body.skillId && !model) model = settings.defaultChatModel;
  if (body.effort) effort = body.effort;
  if (body.maxTokens) maxTokens = body.maxTokens;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      try {
        for await (const ev of streamAgent(messages, {
          category,
          containerId,
          model,
          effort,
          maxTokens,
        })) {
          send(ev);
        }
      } catch (e) {
        send({ type: "error", data: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
