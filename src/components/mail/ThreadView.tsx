"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  archiveThread,
  markThreadRead,
  markThreadUnread,
  setThreadLabel,
  starThread,
  trashThread,
  unsubscribeThread,
  useDraft,
  useDrafts,
  useLabels,
  useThread,
} from "@/lib/gmail-client";
import type { LabelInfo } from "@/lib/gmail";
import { MessageBubble } from "./MessageBubble";
import { ReplyBox } from "./ReplyBox";

type Props = {
  threadId: string;
  onClose: () => void;
};

export function ThreadView({ threadId, onClose }: Props) {
  const { data, error } = useThread(threadId);
  const thread = data && "thread" in data ? data.thread : null;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [replying, setReplying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Find existing draft attached to this thread, if any.
  const { data: draftsData } = useDrafts();
  const draftStub = useMemo(() => {
    if (!draftsData || !("drafts" in draftsData)) return null;
    return draftsData.drafts.find((d) => d.threadId === threadId && d.isReply) ?? null;
  }, [draftsData, threadId]);
  const { data: draftDetailData } = useDraft(draftStub?.id ?? null);
  const draftDetail =
    draftDetailData && "draft" in draftDetailData ? draftDetailData.draft : null;

  // Auto-open reply box if there's a saved draft for this thread.
  useEffect(() => {
    if (draftStub && !replying) setReplying(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftStub?.id]);

  const lastMessageId = useMemo(
    () => (thread ? thread.messages[thread.messages.length - 1]?.id ?? null : null),
    [thread],
  );

  // Default expand only the most recent message when thread changes.
  useEffect(() => {
    if (!thread || thread.messages.length === 0) return;
    const last = thread.messages[thread.messages.length - 1];
    setExpandedIds(new Set([last.id]));
  }, [thread?.id]);

  // Auto mark-read on open.
  useEffect(() => {
    if (!thread) return;
    if (thread.messages.some((m) => m.unread)) {
      void markThreadRead(threadId);
    }
  }, [thread, threadId]);

  const { data: labelsData } = useLabels();
  const allLabels: LabelInfo[] = useMemo(() => {
    if (!labelsData || !("labels" in labelsData)) return [];
    return labelsData.labels.filter((l) => l.type === "user");
  }, [labelsData]);
  const appliedLabels = useMemo(
    () =>
      thread
        ? allLabels.filter((l) => thread.labelIds.includes(l.id))
        : [],
    [allLabels, thread],
  );
  const addableLabels = useMemo(
    () =>
      thread
        ? allLabels.filter((l) => !thread.labelIds.includes(l.id))
        : [],
    [allLabels, thread],
  );
  const [labelPickerOpen, setLabelPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!labelPickerOpen) return;
    function onClick(e: MouseEvent) {
      if (!pickerRef.current?.contains(e.target as Node)) {
        setLabelPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [labelPickerOpen]);

  if (error) {
    return (
      <div className="p-4 text-[12px]" style={{ color: "var(--c-error)" }}>
        {error}
      </div>
    );
  }
  if (!thread) {
    return <div className="p-4 text-fg-soft text-[12px]">Loading…</div>;
  }

  const starred = thread.messages.some((m) => m.starred);
  const hasUnsub = thread.messages.some((m) => m.hasUnsubscribe);

  async function runAction(fn: () => Promise<void>) {
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <header
        className="flex items-center gap-2 px-5"
        style={{ height: 56, borderBottom: "1px solid var(--rule)", flexShrink: 0 }}
      >
        <h3
          className="m-0 text-[15px] font-medium truncate"
          style={{ letterSpacing: "-0.01em", flex: 1, minWidth: 0 }}
        >
          {thread.subject || "(no subject)"}
        </h3>
        <button
          onClick={() => runAction(() => starThread(thread.id, !starred))}
          className="cal-icon-btn"
          aria-label={starred ? "Unstar" : "Star"}
          title={starred ? "Unstar" : "Star"}
          style={{ color: starred ? "#e8b94d" : undefined }}
        >
          ★
        </button>
        <button
          onClick={() => setReplying(true)}
          className="cal-primary-btn"
          title="Reply (r)"
          disabled={replying}
        >
          Reply
        </button>
        <button
          onClick={() =>
            runAction(async () => {
              await archiveThread(thread.id);
              onClose();
            })
          }
          className="cal-pill"
          title="Archive (e)"
        >
          Archive
        </button>
        <button
          onClick={() =>
            runAction(async () => {
              await trashThread(thread.id);
              onClose();
            })
          }
          className="cal-danger-btn"
          title="Trash (#)"
        >
          Trash
        </button>
        <button
          onClick={() => runAction(() => markThreadUnread(thread.id))}
          className="cal-pill"
          title="Mark unread"
        >
          Unread
        </button>
        <div ref={pickerRef} style={{ position: "relative" }}>
          <button
            onClick={() => setLabelPickerOpen((v) => !v)}
            className="cal-pill"
            title="Add label"
          >
            🏷
          </button>
          {labelPickerOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                right: 0,
                minWidth: 220,
                maxHeight: 320,
                overflowY: "auto",
                background: "var(--bg-b)",
                border: "1px solid var(--rule)",
                borderRadius: 8,
                boxShadow: "0 10px 30px -10px rgb(0 0 0 / 0.35)",
                zIndex: 10,
                padding: 4,
              }}
              className="scroll"
            >
              {addableLabels.length === 0 && (
                <div className="text-fg-soft text-[12px] p-2">
                  All labels applied.
                </div>
              )}
              {addableLabels.map((l) => (
                <button
                  key={l.id}
                  onClick={() =>
                    runAction(async () => {
                      await setThreadLabel(thread.id, l.id, true);
                      setLabelPickerOpen(false);
                    })
                  }
                  className="mail-label-menu-item"
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: l.color ?? "var(--fg-soft)",
                      marginRight: 8,
                    }}
                  />
                  <span style={{ flex: 1, textAlign: "left" }}>{l.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {hasUnsub && (
          <button
            onClick={() =>
              runAction(async () => {
                const r = await unsubscribeThread(thread.id);
                if (!r.ok) throw new Error(r.error ?? "unsubscribe failed");
              })
            }
            className="cal-pill"
            title="Unsubscribe"
          >
            Unsub
          </button>
        )}
        <button onClick={onClose} className="cal-icon-btn" aria-label="Close thread">
          ✕
        </button>
      </header>

      {appliedLabels.length > 0 && (
        <div
          className="flex items-center gap-1 flex-wrap"
          style={{
            padding: "6px 18px",
            borderBottom: "1px solid var(--rule)",
            flexShrink: 0,
          }}
        >
          {appliedLabels.map((l) => (
            <span
              key={l.id}
              className="mail-label-chip"
              style={{
                background: l.color
                  ? `color-mix(in srgb, ${l.color} 24%, transparent)`
                  : "oklch(from var(--fg) l c h / 0.08)",
                borderLeft: `2px solid ${l.color ?? "var(--fg-soft)"}`,
                paddingRight: 0,
                fontSize: 11,
              }}
            >
              {l.name}
              <button
                onClick={() =>
                  runAction(() => setThreadLabel(thread.id, l.id, false))
                }
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  marginLeft: 4,
                  marginRight: 4,
                  color: "var(--fg-soft)",
                  fontSize: 11,
                }}
                aria-label={`Remove ${l.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div
        className="flex-1 min-h-0 overflow-y-auto scroll"
        style={{ padding: 0, position: "relative" }}
      >
        {actionError && (
          <div
            className="text-[12px]"
            style={{
              color: "var(--c-error)",
              whiteSpace: "pre-wrap",
              padding: "8px 14px",
              borderBottom: "1px solid var(--rule)",
            }}
          >
            {actionError}
          </div>
        )}

        {thread.messages.map((m, i) => {
          const isLast = i === thread.messages.length - 1;
          const isExpanded = expandedIds.has(m.id);
          return (
            <MessageBubble
              key={m.id}
              message={m}
              expanded={isExpanded}
              onToggle={() => toggleExpand(m.id)}
              fill={isLast && isExpanded}
              relayoutKey={expandedIds.size}
            />
          );
        })}

        {replying && (
          <div style={{ padding: "10px 14px", borderTop: "1px solid var(--rule)" }}>
            <ReplyBox
              key={draftStub?.id ?? "new"}
              threadId={thread.id}
              existingDraftId={draftStub?.id ?? null}
              initialBody={draftDetail?.body ?? ""}
              onDone={() => setReplying(false)}
              onCancel={() => setReplying(false)}
            />
          </div>
        )}

        {lastMessageId && <div style={{ height: 0 }} />}
      </div>
    </>
  );
}
