"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { MailOverlay } from "./MailOverlay";

type Ctx = {
  openInbox: () => void;
  openThread: (threadId: string) => void;
  close: () => void;
};

const MailOverlayCtx = createContext<Ctx | null>(null);

export function MailOverlayProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  const api = useMemo<Ctx>(
    () => ({
      openInbox: () => {
        setThreadId(null);
        setOpen(true);
      },
      openThread: (id) => {
        setThreadId(id);
        setOpen(true);
      },
      close: () => setOpen(false),
    }),
    [],
  );

  const onClose = useCallback(() => setOpen(false), []);

  return (
    <MailOverlayCtx.Provider value={api}>
      {children}
      <MailOverlay open={open} onClose={onClose} initialThreadId={threadId} />
    </MailOverlayCtx.Provider>
  );
}

export function useMailOverlay(): Ctx {
  const ctx = useContext(MailOverlayCtx);
  if (!ctx) throw new Error("useMailOverlay must be used inside MailOverlayProvider");
  return ctx;
}
