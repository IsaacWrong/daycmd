"use client";

import { usePoll } from "@/lib/hooks";
import type { GmailMsg } from "@/lib/gmail";

type Resp =
  | { messages: GmailMsg[]; configured: boolean; connected: boolean }
  | { error: string; configured: boolean; connected: boolean };

function parseFrom(from: string): string {
  const m = from.match(/^"?([^"<]+?)"?\s*<.+>$/);
  return (m ? m[1] : from).trim();
}

export function GmailCard() {
  const { data, error } = usePoll<Resp>("/api/gmail", 60_000);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 min-h-[240px] lg:col-span-2">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
          Inbox
        </h2>
        {data && "messages" in data && (
          <span className="text-xs text-zinc-500">
            {data.messages.filter((m) => m.unread).length} unread
          </span>
        )}
      </header>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {!data && !error && <p className="text-sm text-zinc-500">Loading…</p>}

      {data && "error" in data && !data.configured && (
        <p className="text-sm text-zinc-500">
          Google not configured. Add{" "}
          <code className="text-zinc-400">GOOGLE_CLIENT_ID</code> +{" "}
          <code className="text-zinc-400">GOOGLE_CLIENT_SECRET</code> to{" "}
          <code className="text-zinc-400">.env.local</code>.
        </p>
      )}
      {data && "error" in data && data.configured && !data.connected && (
        <a
          href="/api/auth/google"
          className="inline-block text-sm rounded-md bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-zinc-100"
        >
          Connect Google
        </a>
      )}

      {data && "messages" in data && (
        <ul className="space-y-1">
          {data.messages.length === 0 && (
            <p className="text-sm text-zinc-500">Inbox zero.</p>
          )}
          {data.messages.slice(0, 8).map((m) => (
            <li key={m.id} className="text-sm">
              <a
                href={m.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-baseline gap-2 hover:bg-zinc-800/50 rounded px-1 py-0.5 -mx-1"
              >
                <span
                  className={
                    "w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 " +
                    (m.unread ? "bg-sky-400" : "bg-transparent")
                  }
                />
                <span
                  className={
                    "text-xs shrink-0 w-32 truncate " +
                    (m.unread ? "text-zinc-200" : "text-zinc-500")
                  }
                >
                  {parseFrom(m.from)}
                </span>
                <span
                  className={
                    "flex-1 truncate " +
                    (m.unread ? "text-zinc-100" : "text-zinc-400")
                  }
                >
                  {m.subject || "(no subject)"}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
