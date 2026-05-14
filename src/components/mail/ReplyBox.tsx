"use client";

import { useEffect, useRef, useState } from "react";
import {
  deleteDraft,
  sendDraft,
  sendReply,
  upsertDraft,
} from "@/lib/gmail-client";

type Props = {
  threadId: string;
  existingDraftId?: string | null;
  initialBody?: string;
  initialReplyAll?: boolean;
  onDone: () => void;
  onCancel: () => void;
};

const AUTOSAVE_MS = 2000;

export function ReplyBox({
  threadId,
  existingDraftId = null,
  initialBody = "",
  initialReplyAll = false,
  onDone,
  onCancel,
}: Props) {
  const [body, setBody] = useState(initialBody);
  const [replyAll, setReplyAll] = useState(initialReplyAll);
  const [draftId, setDraftId] = useState<string | null>(existingDraftId);
  const [sending, setSending] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const dirty = useRef(false);
  const lastSaved = useRef<string>(initialBody);

  // Debounced auto-save.
  useEffect(() => {
    if (!dirty.current) return;
    if (!body.trim()) return;
    if (body === lastSaved.current) return;
    const id = setTimeout(async () => {
      try {
        const r = await upsertDraft({
          kind: "reply",
          draftId: draftId ?? undefined,
          threadId,
          body,
          replyAll,
        });
        setDraftId(r.draftId);
        lastSaved.current = body;
        setSavedAt(Date.now());
        setSaveError(null);
      } catch (e) {
        setSaveError((e as Error).message);
      }
    }, AUTOSAVE_MS);
    return () => clearTimeout(id);
  }, [body, replyAll, draftId, threadId]);

  function onChange(v: string) {
    dirty.current = true;
    setBody(v);
  }

  async function onSend() {
    if (!body.trim()) {
      setError("Body required");
      return;
    }
    setError(null);
    setSending(true);
    try {
      if (draftId) {
        // Save latest body then send via draft to preserve draft state and remove from drafts.
        await upsertDraft({
          kind: "reply",
          draftId,
          threadId,
          body,
          replyAll,
        });
        await sendDraft(draftId);
      } else {
        await sendReply(threadId, body, replyAll);
      }
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function onDiscard() {
    if (draftId) {
      if (!confirm("Discard draft?")) return;
      setDiscarding(true);
      try {
        await deleteDraft(draftId);
      } catch (e) {
        setError((e as Error).message);
        setDiscarding(false);
        return;
      }
      setDiscarding(false);
    }
    onCancel();
  }

  return (
    <div
      style={{
        border: "1px solid var(--rule)",
        borderRadius: 10,
        padding: 12,
        marginTop: 10,
        background: "var(--bg-a)",
      }}
    >
      <div className="flex items-center" style={{ marginBottom: 6 }}>
        <label
          className="text-fg-soft text-[11px]"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <input
            type="checkbox"
            checked={replyAll}
            onChange={(e) => {
              dirty.current = true;
              setReplyAll(e.target.checked);
            }}
          />
          Reply all
        </label>
        <span className="flex-1" />
        <span className="text-fg-soft text-[11px]">
          {savedAt
            ? `Saved ${new Date(savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
            : saveError
              ? `Save failed: ${saveError}`
              : draftId
                ? "Resuming draft"
                : ""}
        </span>
      </div>
      <textarea
        value={body}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your reply…"
        autoFocus
        rows={6}
        className="cal-input"
        style={{ width: "100%", resize: "vertical", fontFamily: "inherit" }}
      />
      {error && (
        <div className="text-[12px] mt-2" style={{ color: "var(--c-error)" }}>
          {error}
        </div>
      )}
      <div className="flex items-center gap-2 mt-3">
        <span className="flex-1" />
        <button onClick={onDiscard} className="cal-pill" disabled={sending || discarding}>
          {draftId ? "Discard draft" : "Cancel"}
        </button>
        <button onClick={onSend} className="cal-primary-btn" disabled={sending || discarding}>
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
