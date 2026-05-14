"use client";

import { useEffect, useMemo, useState } from "react";
import type { CalEvent, CalendarInfo } from "@/lib/calendar";
import {
  type RangeKey,
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
  useCalendarList,
} from "@/lib/calendar-client";
import type { EventDraft } from "./types";

type Props = {
  draft: EventDraft;
  range: RangeKey;
  onClose: () => void;
};

function toLocalInput(iso: string, allDay: boolean): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  if (allDay) return `${yyyy}-${mm}-${dd}`;
  return `${yyyy}-${mm}-${dd}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(s: string, allDay: boolean): string {
  if (!s) return "";
  if (allDay) return s; // YYYY-MM-DD passes straight to Google date field
  return new Date(s).toISOString();
}

type FormState = {
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string;
  description: string;
  calendarId: string;
};

function initialState(draft: EventDraft): FormState {
  const e = draft.event;
  if (e) {
    return {
      summary: e.summary,
      start: toLocalInput(e.start, e.allDay),
      end: toLocalInput(e.end, e.allDay),
      allDay: e.allDay,
      location: e.location ?? "",
      description: e.description ?? "",
      calendarId: e.calendarId,
    };
  }
  const now = new Date();
  const start = draft.initial?.start
    ? new Date(draft.initial.start)
    : new Date(now.getTime() + (60 - now.getMinutes()) * 60000);
  start.setSeconds(0, 0);
  const end = draft.initial?.end
    ? new Date(draft.initial.end)
    : new Date(start.getTime() + 60 * 60000);
  const allDay = !!draft.initial?.allDay;
  return {
    summary: "",
    start: toLocalInput(start.toISOString(), allDay),
    end: toLocalInput(end.toISOString(), allDay),
    allDay,
    location: "",
    description: "",
    calendarId: "",
  };
}

export function EventEditor({ draft, range, onClose }: Props) {
  const [form, setForm] = useState<FormState>(() => initialState(draft));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: calData } = useCalendarList();
  const calendars: CalendarInfo[] = useMemo(() => {
    if (!calData || !("calendars" in calData)) return [];
    return calData.calendars;
  }, [calData]);

  useEffect(() => {
    setForm(initialState(draft));
    setError(null);
  }, [draft]);

  // Default calendarId once list loads (create flow only).
  useEffect(() => {
    if (form.calendarId || calendars.length === 0) return;
    const primary = calendars.find((c) => c.primary) ?? calendars[0];
    if (primary) setForm((f) => ({ ...f, calendarId: primary.id }));
  }, [calendars, form.calendarId]);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggleAllDay(next: boolean) {
    setForm((f) => {
      // Re-format start/end when switching
      const start = toLocalInput(fromLocalInput(f.start, f.allDay), next);
      const end = toLocalInput(fromLocalInput(f.end, f.allDay), next);
      return { ...f, allDay: next, start, end };
    });
  }

  async function onSave() {
    setError(null);
    if (!form.summary.trim()) {
      setError("Title required");
      return;
    }
    if (!form.start || !form.end) {
      setError("Start and end required");
      return;
    }
    const startIso = fromLocalInput(form.start, form.allDay);
    const endIso = fromLocalInput(form.end, form.allDay);
    if (new Date(endIso).getTime() <= new Date(startIso).getTime() && !form.allDay) {
      setError("End must be after start");
      return;
    }
    setSaving(true);
    try {
      if (draft.event) {
        await updateCalendarEvent(range, draft.event, {
          summary: form.summary,
          start: startIso,
          end: endIso,
          allDay: form.allDay,
          location: form.location || undefined,
          description: form.description || undefined,
        });
      } else {
        const meta = calendars.find((c) => c.id === form.calendarId);
        await createCalendarEvent(
          range,
          {
            calendarId: form.calendarId || undefined,
            summary: form.summary,
            start: startIso,
            end: endIso,
            allDay: form.allDay,
            location: form.location || undefined,
            description: form.description || undefined,
          },
          {
            calendar: meta?.summary ?? "Calendar",
            calendarColor: meta?.color ?? null,
          },
        );
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!draft.event) return;
    if (!confirm(`Delete "${draft.event.summary}"?`)) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteCalendarEvent(range, draft.event);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  const isEdit = !!draft.event;

  return (
    <aside
      style={{
        width: 380,
        borderLeft: "1px solid var(--rule)",
        padding: "16px 18px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
      className="text-[13px]"
    >
      <div className="flex items-center">
        <span className="t-eyebrow">{isEdit ? "Edit event" : "New event"}</span>
        <span className="flex-1" />
        <button onClick={onClose} className="cal-icon-btn" aria-label="Close editor">
          ✕
        </button>
      </div>

      <label className="cal-field">
        <span className="cal-field-label">Title</span>
        <input
          value={form.summary}
          onChange={(e) => set("summary", e.target.value)}
          placeholder="Add title"
          className="cal-input"
          autoFocus
        />
      </label>

      <label className="cal-row">
        <input
          type="checkbox"
          checked={form.allDay}
          onChange={(e) => toggleAllDay(e.target.checked)}
        />
        <span>All day</span>
      </label>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label className="cal-field">
          <span className="cal-field-label">Start</span>
          <input
            type={form.allDay ? "date" : "datetime-local"}
            value={form.start}
            onChange={(e) => set("start", e.target.value)}
            className="cal-input"
          />
        </label>
        <label className="cal-field">
          <span className="cal-field-label">End</span>
          <input
            type={form.allDay ? "date" : "datetime-local"}
            value={form.end}
            onChange={(e) => set("end", e.target.value)}
            className="cal-input"
          />
        </label>
      </div>

      <label className="cal-field">
        <span className="cal-field-label">Location</span>
        <input
          value={form.location}
          onChange={(e) => set("location", e.target.value)}
          placeholder="Optional"
          className="cal-input"
        />
      </label>

      <label className="cal-field">
        <span className="cal-field-label">Description</span>
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Optional"
          className="cal-input"
          rows={4}
          style={{ resize: "vertical" }}
        />
      </label>

      {!isEdit && (
        <label className="cal-field">
          <span className="cal-field-label">Calendar</span>
          <select
            value={form.calendarId}
            onChange={(e) => set("calendarId", e.target.value)}
            className="cal-input"
          >
            {calendars.length === 0 && <option value="">Loading…</option>}
            {calendars
              .filter((c) => c.writable)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.summary}
                </option>
              ))}
          </select>
        </label>
      )}

      {isEdit && (
        <div className="text-fg-soft text-[12px]">
          Calendar: {draft.event?.calendar}
        </div>
      )}

      {error && (
        <div
          className="text-[12px]"
          style={{ color: "var(--c-error, #d33)", whiteSpace: "pre-wrap" }}
        >
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 mt-1">
        {isEdit && (
          <button
            onClick={onDelete}
            disabled={deleting || saving}
            className="cal-danger-btn"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        )}
        <span className="flex-1" />
        <button onClick={onClose} className="cal-pill" disabled={saving || deleting}>
          Cancel
        </button>
        <button onClick={onSave} className="cal-primary-btn" disabled={saving || deleting}>
          {saving ? "Saving…" : isEdit ? "Save" : "Create"}
        </button>
      </div>
    </aside>
  );
}
