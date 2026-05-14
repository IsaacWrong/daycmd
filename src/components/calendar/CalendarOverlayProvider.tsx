"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { CalEvent } from "@/lib/calendar";
import { CalendarOverlay } from "./CalendarOverlay";
import { parseEventTime } from "./dates";

type OpenArgs = {
  date?: Date;
  eventId?: string;
};

type Ctx = {
  open: (args?: OpenArgs) => void;
  openEvent: (event: CalEvent) => void;
  close: () => void;
};

const CalendarOverlayCtx = createContext<Ctx | null>(null);

export function CalendarOverlayProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [args, setArgs] = useState<OpenArgs>({});

  const api = useMemo<Ctx>(
    () => ({
      open: (a) => {
        setArgs(a ?? {});
        setOpen(true);
      },
      openEvent: (event) => {
        setArgs({ date: new Date(parseEventTime(event.start)), eventId: event.id });
        setOpen(true);
      },
      close: () => setOpen(false),
    }),
    [],
  );

  const onClose = useCallback(() => setOpen(false), []);

  return (
    <CalendarOverlayCtx.Provider value={api}>
      {children}
      <CalendarOverlay
        open={open}
        onClose={onClose}
        initialDate={args.date}
        initialEventId={args.eventId}
      />
    </CalendarOverlayCtx.Provider>
  );
}

export function useCalendarOverlay(): Ctx {
  const ctx = useContext(CalendarOverlayCtx);
  if (!ctx)
    throw new Error("useCalendarOverlay must be used inside CalendarOverlayProvider");
  return ctx;
}
