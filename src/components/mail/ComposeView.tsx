"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  deleteDraft,
  sendDraft,
  upsertDraft,
  useDraft,
} from "@/lib/gmail-client";
import { usePoll } from "@/lib/hooks";

type Contact = { email: string; name: string | null; count: number; lastTs: number };
type ContactsResp = { contacts: Contact[] } | { error: string };

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

function lastToken(value: string): { before: string; token: string } {
  const idx = Math.max(value.lastIndexOf(","), value.lastIndexOf(";"));
  if (idx === -1) return { before: "", token: value.trimStart() };
  return { before: value.slice(0, idx + 1), token: value.slice(idx + 1).trimStart() };
}

function formatRecipient(c: Contact): string {
  if (c.name) return `${c.name} <${c.email}>`;
  return c.email;
}

function RecipientField({
  value,
  onChange,
  placeholder,
  contacts,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  contacts: Contact[];
}) {
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { token } = useMemo(() => lastToken(value), [value]);
  const trimmedToken = token.trim();
  const suggestions = useMemo(() => {
    if (!trimmedToken) return [] as Contact[];
    const q = trimmedToken.toLowerCase();
    const ranked = contacts
      .filter((c) =>
        c.email.toLowerCase().includes(q) ||
        (c.name?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 8);
    return ranked;
  }, [contacts, trimmedToken]);

  useEffect(() => {
    setActiveIdx(0);
  }, [trimmedToken]);

  useEffect(() => {
    if (!focused) return;
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setFocused(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [focused]);

  function apply(c: Contact) {
    const { before } = lastToken(value);
    const prefix = before ? `${before.trim().replace(/[,;]\s*$/, "")}, ` : "";
    onChange(`${prefix}${formatRecipient(c)}, `);
    setFocused(false);
  }

  const showDropdown = focused && suggestions.length > 0;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        className="cal-input"
        value={value}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setFocused(true);
        }}
        onKeyDown={(e) => {
          if (!showDropdown) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIdx((i) => Math.min(suggestions.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter" || e.key === "Tab") {
            const pick = suggestions[activeIdx];
            if (pick) {
              e.preventDefault();
              apply(pick);
            }
          } else if (e.key === "Escape") {
            setFocused(false);
          }
        }}
        style={{ width: "100%" }}
      />
      {showDropdown && (
        <div
          className="scroll"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            maxHeight: 280,
            overflowY: "auto",
            background: "var(--bg-b)",
            border: "1px solid var(--rule)",
            borderRadius: 8,
            boxShadow: "0 10px 30px -10px rgb(0 0 0 / 0.35)",
            zIndex: 10,
            padding: 4,
          }}
        >
          {suggestions.map((c, i) => (
            <button
              key={c.email}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => apply(c)}
              onMouseEnter={() => setActiveIdx(i)}
              data-active={i === activeIdx}
              className="mail-label-menu-item"
              style={{ display: "flex", alignItems: "baseline", gap: 10 }}
            >
              <span style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                {c.name ? (
                  <>
                    <span>{c.name}</span>
                    <span className="text-fg-soft" style={{ marginLeft: 8, fontSize: 11 }}>
                      {c.email}
                    </span>
                  </>
                ) : (
                  <span>{c.email}</span>
                )}
              </span>
              <span className="t-mono text-fg-soft" style={{ fontSize: 10 }}>
                ×{c.count}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ComposeView({ draftId, onClose, onSent }: Props) {
  const { data, error } = useDraft(draftId);
  const { data: contactsData } = usePoll<ContactsResp>("/api/gmail/contacts", 5 * 60_000);
  const contacts: Contact[] =
    contactsData && "contacts" in contactsData ? contactsData.contacts : [];
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
          <RecipientField
            value={form.to}
            onChange={(v) => set("to", v)}
            placeholder="recipient@example.com"
            contacts={contacts}
          />
        </Field>
        <Field label="Cc">
          <RecipientField
            value={form.cc}
            onChange={(v) => set("cc", v)}
            placeholder="Optional"
            contacts={contacts}
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
