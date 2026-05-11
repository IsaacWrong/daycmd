"use client";

import { usePoll } from "@/lib/hooks";
import type { GhItem, GhNotification, GhSummary } from "@/lib/github";

type Resp = GhSummary | { error: string };

function isErr(r: Resp | null): r is { error: string } {
  return !!r && "error" in r;
}

function Row({ item }: { item: GhItem }) {
  return (
    <li className="text-sm">
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="flex items-baseline gap-2 hover:bg-zinc-800/50 rounded px-1 py-0.5 -mx-1"
      >
        <span className="text-zinc-500 text-xs shrink-0">
          {item.repo.split("/")[1]}#{item.number}
        </span>
        <span className="flex-1 truncate text-zinc-200">{item.title}</span>
        {item.isDraft && (
          <span className="text-xs text-zinc-500">draft</span>
        )}
      </a>
    </li>
  );
}

function NotifRow({ n }: { n: GhNotification }) {
  return (
    <li className="text-sm">
      <a
        href={n.url}
        target="_blank"
        rel="noreferrer"
        className="flex items-baseline gap-2 hover:bg-zinc-800/50 rounded px-1 py-0.5 -mx-1"
      >
        <span className="text-zinc-500 text-xs shrink-0">{n.reason}</span>
        <span className="flex-1 truncate text-zinc-200">{n.title}</span>
        <span className="text-xs text-zinc-600 shrink-0">
          {n.repo.split("/")[1]}
        </span>
      </a>
    </li>
  );
}

function Group({
  title,
  items,
}: {
  title: string;
  items: GhItem[];
}) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold text-zinc-300 mb-1">
        {title}{" "}
        <span className="text-zinc-500 font-normal">({items.length})</span>
      </h3>
      <ul className="space-y-0.5">
        {items.slice(0, 6).map((i) => (
          <Row key={i.id} item={i} />
        ))}
      </ul>
    </div>
  );
}

export function GitHubCard() {
  const { data, error } = usePoll<Resp>("/api/github", 60_000);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 min-h-[240px] lg:col-span-2">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
          GitHub
        </h2>
        {data && !isErr(data) && data.user && (
          <span className="text-xs text-zinc-500">@{data.user}</span>
        )}
      </header>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {!data && !error && <p className="text-sm text-zinc-500">Loading…</p>}
      {isErr(data) && (
        <p className="text-sm text-zinc-500">
          {data.error}. Add classic PAT to{" "}
          <code className="text-zinc-400">.env.local</code> (scopes:{" "}
          <code className="text-zinc-400">repo, notifications, read:user</code>
          ).
        </p>
      )}

      {data && !isErr(data) && (
        <div className="space-y-4">
          <Group title="Needs review" items={data.reviewRequested} />
          <Group title="My open PRs" items={data.authored} />
          <Group title="Assigned" items={data.assigned} />
          {data.notifications.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-300 mb-1">
                Notifications{" "}
                <span className="text-zinc-500 font-normal">
                  ({data.notifications.length})
                </span>
              </h3>
              <ul className="space-y-0.5">
                {data.notifications.slice(0, 6).map((n) => (
                  <NotifRow key={n.id} n={n} />
                ))}
              </ul>
            </div>
          )}
          {!data.reviewRequested.length &&
            !data.authored.length &&
            !data.assigned.length &&
            !data.notifications.length && (
              <p className="text-sm text-zinc-500">Inbox zero. Nice.</p>
            )}
        </div>
      )}
    </section>
  );
}
