import type { CalEvent } from "@/lib/calendar";

export type CalendarView = "day" | "week" | "month";

export type EventDraft = {
  // Existing event (for edit) or null (for new)
  event: CalEvent | null;
  // Optional defaults for create
  initial?: {
    start?: string;
    end?: string;
    allDay?: boolean;
  };
};
