"use client";

import { usePoll } from "@/lib/hooks";
import { format } from "date-fns";

type ErrRow = {
  id: number;
  ts: number;
  source: string;
  message: string;
  context: string | null;
};

type Resp = { errors: ErrRow[] };

export function ErrorsCard() {
  const { data, refresh } = usePoll<Resp>("/api/errors", 30_000);
  const errors = data?.errors ?? [];

  async function clear() {
    await fetch("/api/errors", { method: "DELETE" });
    refresh();
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 min-h-[160px] lg:col-span-2">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
          Errors
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">{errors.length}</span>
          {errors.length > 0 && (
            <button
              onClick={clear}
              className="text-xs px-2 py-0.5 rounded text-zinc-500 hover:text-zinc-300"
            >
              Clear
            </button>
          )}
        </div>
      </header>
      {errors.length === 0 && (
        <p className="text-sm text-zinc-500">No errors. Clean run.</p>
      )}
      <ul className="space-y-1 max-h-[240px] overflow-y-auto">
        {errors.map((e) => (
          <li key={e.id} className="text-xs flex items-baseline gap-2">
            <span className="text-zinc-600 w-20 shrink-0">
              {format(new Date(e.ts), "MMM d HH:mm")}
            </span>
            <span className="text-amber-400 font-mono w-32 shrink-0 truncate">
              {e.source}
            </span>
            <span className="text-zinc-300 truncate" title={e.message}>
              {e.message}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
