import { streamAgent, type ClientMessage } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    messages: ClientMessage[];
    category?: string;
    containerId?: string;
  };
  const messages = body.messages ?? [];
  const category = body.category;
  const containerId = body.containerId;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      try {
        for await (const ev of streamAgent(messages, { category, containerId })) {
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
