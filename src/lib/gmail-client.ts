"use client";

import type {
  DraftDetail,
  DraftSummary,
  LabelInfo,
  ThreadDetail,
  ThreadSummary,
} from "@/lib/gmail";
import { mutateCache, useResource } from "@/lib/hooks";

export type InboxThreadsResp =
  | { threads: ThreadSummary[]; configured: boolean; connected: boolean }
  | { error: string; configured: boolean; connected: boolean };

export type ThreadResp =
  | { thread: ThreadDetail }
  | { error: string };

const INBOX_KEY = "gmail:threads:inbox";
const INBOX_URL = "/api/gmail/threads?max=50&labelIds=INBOX";

function threadKey(id: string) {
  return `gmail:thread:${id}`;
}
function threadUrl(id: string) {
  return `/api/gmail/threads/${encodeURIComponent(id)}`;
}

function labelListKey(labelId: string) {
  return `gmail:threads:label:${labelId}`;
}
function labelListUrl(labelId: string) {
  return `/api/gmail/threads?max=50&labelIds=${encodeURIComponent(labelId)}`;
}

export function useInboxThreads() {
  return useResource<InboxThreadsResp>(INBOX_KEY, INBOX_URL);
}

export function useLabelThreads(labelId: string | null) {
  return useResource<InboxThreadsResp>(
    labelId ? labelListKey(labelId) : INBOX_KEY,
    labelId ? labelListUrl(labelId) : INBOX_URL,
  );
}

function searchKey(q: string) {
  return `gmail:threads:search:${q}`;
}
function searchUrl(q: string) {
  return `/api/gmail/threads?max=50&q=${encodeURIComponent(q)}`;
}

export function useSearchThreads(query: string | null) {
  return useResource<InboxThreadsResp>(
    query ? searchKey(query) : INBOX_KEY,
    query ? searchUrl(query) : INBOX_URL,
  );
}

export type LabelsResp =
  | { labels: LabelInfo[]; configured: boolean; connected: boolean }
  | { error: string; configured: boolean; connected: boolean };

const LABELS_KEY = "gmail:labels";
const LABELS_URL = "/api/gmail/labels";

export function useLabels() {
  return useResource<LabelsResp>(LABELS_KEY, LABELS_URL);
}

export function useThread(id: string | null) {
  return useResource<ThreadResp>(
    id ? threadKey(id) : "gmail:thread:none",
    id ? threadUrl(id) : "/api/gmail/threads",
  );
}

function mapThreads(
  resp: InboxThreadsResp | undefined,
  fn: (threads: ThreadSummary[]) => ThreadSummary[],
): InboxThreadsResp | undefined {
  if (!resp || !("threads" in resp)) return resp;
  return { ...resp, threads: fn(resp.threads) };
}

function mapThreadDetail(
  resp: ThreadResp | undefined,
  fn: (t: ThreadDetail) => ThreadDetail,
): ThreadResp | undefined {
  if (!resp || !("thread" in resp)) return resp;
  return { thread: fn(resp.thread) };
}

async function patchJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}

async function deleteJSON(url: string): Promise<void> {
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
}

export async function archiveThread(threadId: string): Promise<void> {
  await mutateCache<InboxThreadsResp>(
    INBOX_KEY,
    INBOX_URL,
    (prev) => mapThreads(prev, (ts) => ts.filter((t) => t.id !== threadId))!,
    async () => {
      await patchJSON(threadUrl(threadId), { removeLabels: ["INBOX"] });
    },
  );
}

export async function trashThread(threadId: string): Promise<void> {
  await mutateCache<InboxThreadsResp>(
    INBOX_KEY,
    INBOX_URL,
    (prev) => mapThreads(prev, (ts) => ts.filter((t) => t.id !== threadId))!,
    async () => {
      await deleteJSON(threadUrl(threadId));
    },
  );
}

function updateInboxThread(
  threadId: string,
  patch: Partial<ThreadSummary>,
) {
  return mutateCache<InboxThreadsResp>(
    INBOX_KEY,
    INBOX_URL,
    (prev) =>
      mapThreads(prev, (ts) =>
        ts.map((t) => (t.id === threadId ? { ...t, ...patch } : t)),
      )!,
    async () => {},
  );
}

export async function markThreadRead(threadId: string): Promise<void> {
  await Promise.all([
    updateInboxThread(threadId, { unread: false }),
    mutateCache<ThreadResp>(
      threadKey(threadId),
      threadUrl(threadId),
      (prev) =>
        mapThreadDetail(prev, (t) => ({
          ...t,
          messages: t.messages.map((m) => ({ ...m, unread: false })),
        }))!,
      async () => {
        await patchJSON(threadUrl(threadId), { removeLabels: ["UNREAD"] });
      },
    ),
  ]);
}

export async function markThreadUnread(threadId: string): Promise<void> {
  await Promise.all([
    updateInboxThread(threadId, { unread: true }),
    mutateCache<ThreadResp>(
      threadKey(threadId),
      threadUrl(threadId),
      (prev) =>
        mapThreadDetail(prev, (t) => ({
          ...t,
          messages: t.messages.map((m) => ({ ...m, unread: true })),
        }))!,
      async () => {
        await patchJSON(threadUrl(threadId), { addLabels: ["UNREAD"] });
      },
    ),
  ]);
}

export async function setThreadLabel(
  threadId: string,
  labelId: string,
  on: boolean,
): Promise<void> {
  const payload = on ? { addLabels: [labelId] } : { removeLabels: [labelId] };
  // Optimistic update in inbox cache + thread detail cache.
  await Promise.all([
    mutateCache<InboxThreadsResp>(
      INBOX_KEY,
      INBOX_URL,
      (prev) =>
        mapThreads(prev, (ts) =>
          ts.map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  labelIds: on
                    ? Array.from(new Set([...t.labelIds, labelId]))
                    : t.labelIds.filter((l) => l !== labelId),
                }
              : t,
          ),
        )!,
      async () => {
        await patchJSON(threadUrl(threadId), payload);
      },
    ),
  ]);
}

export async function starThread(threadId: string, starred: boolean): Promise<void> {
  const labels = starred
    ? { addLabels: ["STARRED"] }
    : { removeLabels: ["STARRED"] };
  await Promise.all([
    updateInboxThread(threadId, { starred }),
    mutateCache<ThreadResp>(
      threadKey(threadId),
      threadUrl(threadId),
      (prev) =>
        mapThreadDetail(prev, (t) => ({
          ...t,
          messages: t.messages.map((m) => ({ ...m, starred })),
        }))!,
      async () => {
        await patchJSON(threadUrl(threadId), labels);
      },
    ),
  ]);
}

export async function sendReply(
  threadId: string,
  body: string,
  replyAll: boolean,
): Promise<void> {
  await postJSON(`${threadUrl(threadId)}/reply`, { body, replyAll });
  // After send, force refresh the thread + inbox
  await Promise.all([
    mutateCache<ThreadResp>(
      threadKey(threadId),
      threadUrl(threadId),
      (prev) => prev as ThreadResp,
      async () => {},
    ),
    mutateCache<InboxThreadsResp>(
      INBOX_KEY,
      INBOX_URL,
      (prev) => prev as InboxThreadsResp,
      async () => {},
    ),
  ]);
}

export async function unsubscribeThread(threadId: string): Promise<{ ok: boolean; method?: string; error?: string }> {
  const res = await fetch(`${threadUrl(threadId)}/unsubscribe`, { method: "POST" });
  const json = await res.json();
  if (!res.ok) return { ok: false, error: json.error };
  return json;
}

// ─── Drafts ─────────────────────────────────────────────────────

export type DraftsResp =
  | { drafts: DraftSummary[]; configured: boolean; connected: boolean }
  | { error: string; configured: boolean; connected: boolean };

export type DraftResp =
  | { draft: DraftDetail }
  | { error: string };

const DRAFTS_KEY = "gmail:drafts";
const DRAFTS_URL = "/api/gmail/drafts";

function draftKey(id: string) {
  return `gmail:draft:${id}`;
}
function draftUrl(id: string) {
  return `/api/gmail/drafts/${encodeURIComponent(id)}`;
}

export function useDrafts() {
  return useResource<DraftsResp>(DRAFTS_KEY, DRAFTS_URL);
}

export function useDraft(id: string | null) {
  return useResource<DraftResp>(
    id ? draftKey(id) : "gmail:draft:none",
    id ? draftUrl(id) : "/api/gmail/drafts",
  );
}

export type DraftUpsertInput =
  | {
      kind: "reply";
      draftId?: string;
      threadId: string;
      body: string;
      replyAll?: boolean;
    }
  | {
      kind: "compose";
      draftId?: string;
      to: string;
      cc?: string;
      subject: string;
      body: string;
    };

export async function upsertDraft(
  input: DraftUpsertInput,
): Promise<{ ok: true; draftId: string; messageId: string }> {
  return postJSON("/api/gmail/drafts", input);
}

export async function deleteDraft(draftId: string): Promise<void> {
  await mutateCache<DraftsResp>(
    DRAFTS_KEY,
    DRAFTS_URL,
    (prev) => {
      if (!prev || !("drafts" in prev)) return prev as DraftsResp;
      return { ...prev, drafts: prev.drafts.filter((d) => d.id !== draftId) };
    },
    async () => {
      await deleteJSON(draftUrl(draftId));
    },
  );
}

export async function sendDraft(draftId: string): Promise<void> {
  await mutateCache<DraftsResp>(
    DRAFTS_KEY,
    DRAFTS_URL,
    (prev) => {
      if (!prev || !("drafts" in prev)) return prev as DraftsResp;
      return { ...prev, drafts: prev.drafts.filter((d) => d.id !== draftId) };
    },
    async () => {
      const res = await fetch(`${draftUrl(draftId)}/send`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    },
  );
}
