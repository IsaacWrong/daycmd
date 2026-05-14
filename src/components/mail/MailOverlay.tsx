"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Overlay } from "@/components/ui/Overlay";
import {
  archiveThread,
  starThread,
  trashThread,
  useLabels,
  useLabelThreads,
  useSearchThreads,
} from "@/lib/gmail-client";
import type { LabelInfo } from "@/lib/gmail";
import { ThreadList } from "./ThreadList";
import { ThreadView } from "./ThreadView";
import { DraftsList } from "./DraftsList";
import { ComposeView } from "./ComposeView";
import { TriagePanel } from "./TriagePanel";

type Props = {
  open: boolean;
  onClose: () => void;
  initialThreadId?: string | null;
};

type View =
  | { kind: "inbox"; threadId: string | null }
  | { kind: "label"; labelId: string; threadId: string | null }
  | { kind: "search"; query: string; threadId: string | null }
  | { kind: "drafts"; draftId: string | null }
  | { kind: "compose"; draftId: string | null };

function isThreadListView(v: View): boolean {
  return (
    v.kind === "inbox" ||
    v.kind === "label" ||
    v.kind === "search" ||
    v.kind === "compose"
  );
}

export function MailOverlay({ open, onClose, initialThreadId }: Props) {
  const titleId = useId();
  const [view, setView] = useState<View>(() =>
    initialThreadId
      ? { kind: "inbox", threadId: initialThreadId }
      : { kind: "inbox", threadId: null },
  );

  useEffect(() => {
    if (open) {
      setView(
        initialThreadId
          ? { kind: "inbox", threadId: initialThreadId }
          : { kind: "inbox", threadId: null },
      );
    }
  }, [open, initialThreadId]);

  const [triageOpen, setTriageOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  const activeLabelId = view.kind === "label" ? view.labelId : null;
  const activeQuery = view.kind === "search" ? view.query : null;
  const labelRes = useLabelThreads(activeQuery ? null : activeLabelId);
  const searchRes = useSearchThreads(activeQuery);
  const data = activeQuery ? searchRes.data : labelRes.data;
  const threads = data && "threads" in data ? data.threads : [];

  const { data: labelsData } = useLabels();
  const userLabels = useMemo<LabelInfo[]>(
    () =>
      labelsData && "labels" in labelsData
        ? labelsData.labels.filter((l) => l.type === "user")
        : [],
    [labelsData],
  );

  const [labelMenuOpen, setLabelMenuOpen] = useState(false);
  const labelMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!labelMenuOpen) return;
    function onClick(e: MouseEvent) {
      if (!labelMenuRef.current?.contains(e.target as Node)) {
        setLabelMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [labelMenuOpen]);

  const activeLabelName =
    view.kind === "label"
      ? userLabels.find((l) => l.id === view.labelId)?.name ?? "Label"
      : null;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (
        view.kind !== "inbox" &&
        view.kind !== "label" &&
        view.kind !== "search"
      ) {
        if (e.key === "c") {
          e.preventDefault();
          setView({ kind: "compose", draftId: null });
        }
        return;
      }
      const selectedId = view.threadId;
      const idx = threads.findIndex((t) => t.id === selectedId);
      const setSelected = (id: string | null) => {
        if (view.kind === "label") setView({ ...view, threadId: id });
        else if (view.kind === "search") setView({ ...view, threadId: id });
        else setView({ kind: "inbox", threadId: id });
      };
      const move = (delta: number) => {
        if (threads.length === 0) return;
        if (idx === -1) {
          setSelected(threads[0].id);
          return;
        }
        const next = Math.max(0, Math.min(threads.length - 1, idx + delta));
        setSelected(threads[next].id);
      };

      if (e.key === "j") {
        e.preventDefault();
        move(1);
      } else if (e.key === "k") {
        e.preventDefault();
        move(-1);
      } else if (e.key === "e" && selectedId) {
        e.preventDefault();
        void archiveThread(selectedId).then(() => {
          if (idx >= 0 && idx + 1 < threads.length) {
            setSelected(threads[idx + 1].id);
          } else {
            setSelected(null);
          }
        });
      } else if (e.key === "#" && selectedId) {
        e.preventDefault();
        void trashThread(selectedId).then(() => {
          if (idx >= 0 && idx + 1 < threads.length) {
            setSelected(threads[idx + 1].id);
          } else {
            setSelected(null);
          }
        });
      } else if (e.key === "s" && selectedId) {
        e.preventDefault();
        const t = threads.find((x) => x.id === selectedId);
        if (t) void starThread(selectedId, !t.starred);
      } else if (e.key === "c") {
        e.preventDefault();
        setView({ kind: "compose", draftId: null });
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, threads, view]);

  return (
    <Overlay open={open} onClose={onClose} labelledBy={titleId}>
      <div
        className="flex flex-col glass-card"
        style={{
          margin: 24,
          flex: 1,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <header
          className="flex items-center gap-3 px-5"
          style={{
            height: 56,
            borderBottom: "1px solid var(--rule)",
            flexShrink: 0,
          }}
        >
          <button onClick={onClose} aria-label="Close" className="cal-icon-btn" style={{ marginLeft: -6 }}>
            ✕
          </button>

          <div
            className="flex items-center"
            style={{ border: "1px solid var(--rule)", borderRadius: 8, padding: 2, marginLeft: 6 }}
          >
            <button
              onClick={() => setView({ kind: "inbox", threadId: null })}
              className="cal-seg-btn"
              data-active={view.kind === "inbox"}
            >
              Inbox
            </button>
            <button
              onClick={() => setView({ kind: "drafts", draftId: null })}
              className="cal-seg-btn"
              data-active={view.kind === "drafts"}
            >
              Drafts
            </button>
          </div>

          <div ref={labelMenuRef} style={{ position: "relative" }}>
            <button
              onClick={() => setLabelMenuOpen((v) => !v)}
              className="cal-pill"
              data-active={view.kind === "label"}
            >
              {activeLabelName ?? "Labels"} ▾
            </button>
            {labelMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  minWidth: 220,
                  maxHeight: 360,
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
                {userLabels.length === 0 && (
                  <div className="text-fg-soft text-[12px] p-2">
                    No user labels in Gmail.
                  </div>
                )}
                {userLabels.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => {
                      setView({ kind: "label", labelId: l.id, threadId: null });
                      setLabelMenuOpen(false);
                    }}
                    className="mail-label-menu-item"
                    data-active={view.kind === "label" && view.labelId === l.id}
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
                    {l.unread > 0 && (
                      <span className="t-mono text-[10px] text-fg-soft">
                        {l.unread}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setView({ kind: "compose", draftId: null })}
            className="cal-primary-btn"
            style={{ marginLeft: 6 }}
          >
            + Compose
          </button>

          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const q = searchInput.trim();
                if (q) {
                  setView({ kind: "search", query: q, threadId: null });
                } else {
                  setView({ kind: "inbox", threadId: null });
                }
              } else if (e.key === "Escape") {
                setSearchInput("");
                setView({ kind: "inbox", threadId: null });
              }
            }}
            placeholder="Search mail…"
            className="cal-input"
            style={{
              marginLeft: 10,
              width: 280,
              height: 30,
              padding: "0 10px",
              fontSize: 12.5,
            }}
          />
          {view.kind === "search" && (
            <button
              onClick={() => {
                setSearchInput("");
                setView({ kind: "inbox", threadId: null });
              }}
              className="cal-icon-btn"
              title="Clear search"
            >
              ✕
            </button>
          )}

          <span className="flex-1" />

          <button
            onClick={() => setTriageOpen(true)}
            className="cal-pill"
            data-active={triageOpen}
            title="AI Triage"
          >
            ✨ Triage
          </button>
        </header>

        <div className="flex-1 min-h-0 flex">
          <div
            style={{
              width: 380,
              borderRight: "1px solid var(--rule)",
              overflowY: "auto",
              flexShrink: 0,
            }}
            className="scroll"
          >
            {isThreadListView(view) ? (
              <ThreadList
                labelId={view.kind === "label" ? view.labelId : null}
                query={view.kind === "search" ? view.query : null}
                selectedId={
                  view.kind === "inbox" ||
                  view.kind === "label" ||
                  view.kind === "search"
                    ? view.threadId
                    : null
                }
                onSelect={(id) => {
                  if (view.kind === "label") {
                    setView({ kind: "label", labelId: view.labelId, threadId: id });
                  } else if (view.kind === "search") {
                    setView({ kind: "search", query: view.query, threadId: id });
                  } else {
                    setView({ kind: "inbox", threadId: id });
                  }
                }}
              />
            ) : view.kind === "drafts" ? (
              <DraftsList
                selectedId={view.draftId}
                onSelect={(id) => setView({ kind: "drafts", draftId: id })}
              />
            ) : (
              <ThreadList
                labelId={null}
                selectedId={null}
                onSelect={(id) => setView({ kind: "inbox", threadId: id })}
              />
            )}
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            {triageOpen && (
              <TriagePanel onClose={() => setTriageOpen(false)} />
            )}
            {!triageOpen &&
              (view.kind === "inbox" || view.kind === "label" || view.kind === "search") &&
              view.threadId && (
                <ThreadView
                  threadId={view.threadId}
                  onClose={() => {
                    if (view.kind === "label") {
                      setView({ kind: "label", labelId: view.labelId, threadId: null });
                    } else if (view.kind === "search") {
                      setView({ kind: "search", query: view.query, threadId: null });
                    } else {
                      setView({ kind: "inbox", threadId: null });
                    }
                  }}
                />
              )}
            {!triageOpen &&
              (view.kind === "inbox" || view.kind === "label" || view.kind === "search") &&
              !view.threadId && (
                <div className="flex-1 flex items-center justify-center text-fg-soft text-[13px]">
                  {view.kind === "search"
                    ? `Search results for "${view.query}"`
                    : "Select a thread."}
                </div>
              )}
            {!triageOpen && view.kind === "drafts" && view.draftId && (
              <ComposeView
                key={view.draftId}
                draftId={view.draftId}
                onClose={() => setView({ kind: "drafts", draftId: null })}
                onSent={() => setView({ kind: "inbox", threadId: null })}
              />
            )}
            {!triageOpen && view.kind === "drafts" && !view.draftId && (
              <div className="flex-1 flex items-center justify-center text-fg-soft text-[13px]">
                Select a draft.
              </div>
            )}
            {!triageOpen && view.kind === "compose" && (
              <ComposeView
                key={view.draftId ?? "new"}
                draftId={view.draftId}
                onClose={() => setView({ kind: "inbox", threadId: null })}
                onSent={() => setView({ kind: "inbox", threadId: null })}
              />
            )}
          </div>
        </div>
      </div>
    </Overlay>
  );
}
