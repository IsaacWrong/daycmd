"use client";

import { useEffect, useRef, useState } from "react";
import {
  deleteDraft,
  sendDraft,
  upsertDraft,
  useDraft,
} from "@/lib/gmail-client";

type Props = {
  draftId: string | null;
  onClose: () => void;
  onSent: () => void;
};

type FormState = {
  to: string;
  cc: string;
  subject: string;
  body: string;
};

const empty: FormState = { to: "", cc: "", subject: "", body: "" };

const AUTOSAVE_MS = 2000;

export function ComposeView({ draftId, onClose, onSent }: Props) {
  const { data, error } = useDraft(draftId);
  const [form, setForm] = useState<FormState>(empty);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(draftId);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const dirty = useRef(false);
  const lastSaved = useRef<string>("");

  // Hydrate from server draft on load.
  useEffect(() => {
    if (!draftId) return;
    if (!data || !("draft" in data)) return;
    const d = data.draft;
    if (d.isReply) {
      // ComposeView shouldn't be used for reply drafts — but be safe
      setForm({
        to: d.to,
        cc: d.cc,
        subject: d.subject,
        body: d.body,
      });
    } else {
      setForm({
        to: d.to,
        cc: d.cc,
        subject: d.subject,
        body: d.body,
      });
    }
    lastSaved.current = JSON.stringify({
      to: d.to,
      cc: d.cc,
      subject: d.subject,
      body: d.body,
    });
    setCurrentDraftId(d.id);
  }, [draftId, data]);

  // Debounced auto-save.
  useEffect(() => {
    if (!dirty.current) return;
    const snapshot = JSON.stringify(form);
    if (snapshot === lastSaved.current) return;
    if (!form.to && !form.subject && !form.body && !form.cc) return;
    const id = setTimeout(async () => {
      try {
        const r = await upsertDraft({
          kind: "compose",
          draftId: currentDraftId ?? undefined,
          to: form.to,
          cc: form.cc || undefined,
          subject: form.subject,
          body: form.body,
        });
        setCurrentDraftId(r.draftId);
        lastSaved.current = snapshot;
        setSavedAt(Date.now());
        setSaveError(null);
      } catch (e) {
        setSaveError((e as Error).message);
      }
    }, AUTOSAVE_MS);
    return () => clearTimeout(id);
  }, [form, currentDraftId]);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    dirty.current = true;
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSend() {
    setActionError(null);
    if (!form.to.trim()) {
      setActionError("To required");
      return;
    }
    if (!form.body.trim()) {
      setActionError("Body required");
      return;
    }
    setSending(true);
    try {
      // Save final state first, then send
      const r = await upsertDraft({
        kind: "compose",
        draftId: currentDraftId ?? undefined,
        to: form.to,
        cc: form.cc || undefined,
        subject: form.subject,
        body: form.body,
      });
      await sendDraft(r.draftId);
      onSent();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function onDiscard() {
    setActionError(null);
    if (!currentDraftId) {
      onClose();
      return;
    }
    if (!confirm("Discard draft?")) return;
    setDiscarding(true);
    try {
      await deleteDraft(currentDraftId);
      onClose();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setDiscarding(false);
    }
  }

  if (draftId && error) {
    return (
      <div className="p-4 text-[12px]" style={{ color: "var(--c-error)" }}>
        {error}
      </div>
    );
  }

  return (
    <>
      <header
        className="flex items-center gap-2 px-5"
        style={{ height: 56, borderBottom: "1px solid var(--rule)", flexShrink: 0 }}
      >
        <h3 className="m-0 text-[15px] font-medium" style={{ letterSpacing: "-0.01em" }}>
          {draftId ? "Draft" : "New message"}
        </h3>
        <span className="text-fg-soft text-[11px]">
          {savedAt
            ? `Saved ${new Date(savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
            : saveError
              ? `Save failed: ${saveError}`
              : ""}
        </span>
        <span className="flex-1" />
        <button onClick={onDiscard} className="cal-danger-btn" disabled={discarding}>
          {discarding ? "Discarding…" : "Discard"}
        </button>
        <button onClick={onSend} className="cal-primary-btn" disabled={sending}>
          {sending ? "Sending…" : "Send"}
        </button>
        <button onClick={onClose} className="cal-icon-btn" aria-label="Close">
          ✕
        </button>
      </header>

      <div
        className="flex-1 min-h-0 overflow-y-auto scroll"
        style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}
      >
        <Field label="To">
          <input
            className="cal-input"
            value={form.to}
            onChange={(e) => set("to", e.target.value)}
            placeholder="recipient@example.com"
          />
        </Field>
        <Field label="Cc">
          <input
            className="cal-input"
            value={form.cc}
            onChange={(e) => set("cc", e.target.value)}
            placeholder="Optional"
          />
        </Field>
        <Field label="Subject">
          <input
            className="cal-input"
            value={form.subject}
            onChange={(e) => set("subject", e.target.value)}
            placeholder="Subject"
          />
        </Field>
        <textarea
          className="cal-input"
          value={form.body}
          onChange={(e) => set("body", e.target.value)}
          placeholder="Write a message…"
          rows={20}
          style={{ resize: "vertical", fontFamily: "inherit", flex: 1, minHeight: 240 }}
        />

        {actionError && (
          <div className="text-[12px]" style={{ color: "var(--c-error)" }}>
            {actionError}
          </div>
        )}
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="cal-field">
      <span className="cal-field-label">{label}</span>
      {children}
    </label>
  );
}
