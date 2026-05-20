"use client";

import { useEffect, useState } from "react";

export type PendingTool = {
  name: string;
  nonce: string;
  input: Record<string, unknown>;
  previouslyApproved?: boolean;
};

// Confirmation overlay for destructive agent tools. The agent loop emits a
// `tool_pending` SSE event with a nonce; the user clicks Approve or Deny
// which POSTs the decision back. The server-side handler in agent.ts is
// awaiting that decision (60s timeout) — denial returns a ToolDenied result
// to the model without dispatching.
const KEY_INPUT_FIELDS: Record<string, ReadonlyArray<string>> = {
  gmail_send: ["to", "subject", "body"],
  gmail_unsubscribe: ["message_id"],
  gmail_trash: ["message_id"],
  calendar_create_event: ["summary", "start", "end", "attendees"],
  calendar_reschedule_event: ["event_id", "start", "end"],
  calendar_cancel_event: ["event_id"],
  kb_wiki_delete: ["category", "path"],
};

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

export function ToolConfirmation({
  pending,
  onDecision,
}: {
  pending: PendingTool;
  onDecision: (approved: boolean) => Promise<void> | void;
}) {
  const [submitting, setSubmitting] = useState<"approve" | "deny" | null>(null);

  async function decide(approved: boolean) {
    if (submitting) return;
    setSubmitting(approved ? "approve" : "deny");
    try {
      await onDecision(approved);
    } finally {
      // Component will unmount when `pending` clears in parent.
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (submitting) return;
      if (e.key === "Escape") {
        e.preventDefault();
        void decide(false);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void decide(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitting]);

  const fields =
    KEY_INPUT_FIELDS[pending.name] ?? Object.keys(pending.input);

  return (
    <div
      role="dialog"
      aria-label="Confirm destructive tool"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "oklch(0 0 0 / 0.5)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        padding: 24,
      }}
    >
      <div
        className="glass"
        style={{
          width: "min(520px, 100%)",
          borderRadius: 14,
          padding: "20px 22px",
          boxShadow: "0 18px 40px -16px oklch(0 0 0 / 0.45)",
        }}
      >
        <div
          className="t-mono uppercase"
          style={{
            fontSize: 10.5,
            color: "var(--c-error)",
            letterSpacing: "0.04em",
            marginBottom: 8,
          }}
        >
          confirm destructive tool
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 500,
            letterSpacing: "-0.005em",
            marginBottom: 4,
          }}
        >
          {pending.name}
        </div>
        {pending.previouslyApproved && (
          <div
            className="t-mono"
            style={{
              fontSize: 11,
              color: "var(--c-good)",
              marginBottom: 10,
            }}
          >
            ✓ previously approved
          </div>
        )}
        <div
          style={{
            marginTop: 10,
            border: "1px solid var(--rule)",
            borderRadius: 8,
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontSize: 12.5,
            background: "oklch(from var(--fg) l c h / 0.04)",
            maxHeight: 280,
            overflowY: "auto",
          }}
          className="scroll"
        >
          {fields.map((k) => (
            <div key={k} style={{ display: "flex", gap: 10 }}>
              <span
                className="t-mono"
                style={{ color: "var(--fg-soft)", minWidth: 80 }}
              >
                {k}
              </span>
              <span
                style={{
                  color: "var(--fg)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  flex: 1,
                }}
              >
                {formatValue(pending.input[k])}
              </span>
            </div>
          ))}
        </div>
        <div
          className="flex items-center justify-end gap-2"
          style={{ marginTop: 16 }}
        >
          <button
            type="button"
            onClick={() => decide(false)}
            disabled={submitting !== null}
            className="t-mono"
            style={{
              padding: "7px 14px",
              borderRadius: 6,
              border: "1px solid var(--rule)",
              background: "transparent",
              color: "var(--c-error)",
              fontSize: 12,
              cursor: submitting ? "wait" : "pointer",
            }}
          >
            {submitting === "deny" ? "denying…" : "Deny (Esc)"}
          </button>
          <button
            type="button"
            onClick={() => decide(true)}
            disabled={submitting !== null}
            className="t-mono"
            style={{
              padding: "7px 14px",
              borderRadius: 6,
              border: 0,
              background: "var(--c-agent)",
              color: "white",
              fontSize: 12,
              cursor: submitting ? "wait" : "pointer",
            }}
          >
            {submitting === "approve" ? "approving…" : "Approve (⌘↵)"}
          </button>
        </div>
      </div>
    </div>
  );
}
