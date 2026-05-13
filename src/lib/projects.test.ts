import { describe, expect, it } from "vitest";
import {
  buildTimeEntry,
  computeWeeklyHoursFromBody,
  parseLogEntries,
} from "./projects";

describe("parseLogEntries", () => {
  it("returns an empty list when no Log section exists", () => {
    expect(parseLogEntries("# Project\n\nno log here")).toEqual([]);
  });

  it("parses entries under the Log heading and ignores non-matching lines", () => {
    const body = [
      "## Notes",
      "- random",
      "",
      "## Log",
      "- 2026-05-13 09:00–10:30 (90m)",
      "- prose line that should be skipped",
      "- 2026-05-12 14:00-14:45 (45m)",
      "",
      "## Ideas",
      "- 2099-01-01 00:00–00:30 (30m)",
    ].join("\n");
    expect(parseLogEntries(body)).toEqual([
      { date: "2026-05-13", start: "09:00", end: "10:30", minutes: 90 },
      { date: "2026-05-12", start: "14:00", end: "14:45", minutes: 45 },
    ]);
  });
});

describe("computeWeeklyHoursFromBody", () => {
  it("sums minutes within the last 7 days and rounds to 2 decimals", () => {
    const now = new Date("2026-05-13T12:00:00Z");
    const body = [
      "## Log",
      "- 2026-05-13 09:00–10:30 (90m)", // 1.5h, in window
      "- 2026-05-12 14:00–14:45 (45m)", // 0.75h, in window
      "- 2026-05-01 09:00–11:00 (120m)", // outside window
    ].join("\n");
    expect(computeWeeklyHoursFromBody(body, now)).toBeCloseTo(2.25, 2);
  });

  it("returns 0 when there are no entries", () => {
    expect(computeWeeklyHoursFromBody("# empty")).toBe(0);
  });
});

describe("buildTimeEntry", () => {
  it("computes minutes between ISO timestamps", () => {
    const entry = buildTimeEntry(
      "2026-05-13T09:00:00Z",
      "2026-05-13T10:30:00Z",
    );
    expect(entry.minutes).toBe(90);
    expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(entry.start).toMatch(/^\d{2}:\d{2}$/);
    expect(entry.end).toMatch(/^\d{2}:\d{2}$/);
  });

  it("clamps negative durations to zero", () => {
    const entry = buildTimeEntry(
      "2026-05-13T10:00:00Z",
      "2026-05-13T09:00:00Z",
    );
    expect(entry.minutes).toBe(0);
  });
});
