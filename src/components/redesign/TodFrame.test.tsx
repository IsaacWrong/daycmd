import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook } from "@testing-library/react";
import {
  TodFrame,
  todForHour,
  useFocusMode,
  useTod,
  type Tod,
} from "./TodFrame";

describe("todForHour", () => {
  const cases: Array<[number, Tod]> = [
    [0, "deep"],
    [5, "deep"],
    [6, "dawn"],
    [8, "dawn"],
    [9, "morning"],
    [10, "morning"],
    [11, "noon"],
    [13, "noon"],
    [14, "afternoon"],
    [16, "afternoon"],
    [17, "dusk"],
    [19, "dusk"],
    [20, "night"],
    [22, "night"],
    [23, "deep"],
  ];
  for (const [h, expected] of cases) {
    it(`maps hour ${h} → ${expected}`, () => {
      expect(todForHour(h)).toBe(expected);
    });
  }
});

describe("useTod", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the tod for the current hour on first render", () => {
    vi.setSystemTime(new Date("2026-05-13T08:30:00"));
    const { result } = renderHook(() => useTod());
    expect(result.current).toBe("dawn");
  });

  it("updates when the system clock crosses into a new tod window", () => {
    vi.setSystemTime(new Date("2026-05-13T10:30:00"));
    const { result } = renderHook(() => useTod());
    expect(result.current).toBe("morning");

    vi.setSystemTime(new Date("2026-05-13T12:00:00"));
    act(() => {
      vi.advanceTimersByTime(10 * 60_000);
    });
    expect(result.current).toBe("noon");
  });
});

describe("useFocusMode", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("defaults to false when no value is stored", () => {
    const { result } = renderHook(() => useFocusMode());
    expect(result.current[0]).toBe(false);
  });

  it("reads the persisted '1' value on mount", () => {
    localStorage.setItem("daycmd.focus-mode", "1");
    const { result } = renderHook(() => useFocusMode());
    expect(result.current[0]).toBe(true);
  });

  it("migrates from the legacy ai-os.focus-mode key", () => {
    localStorage.setItem("ai-os.focus-mode", "1");
    const { result } = renderHook(() => useFocusMode());
    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem("ai-os.focus-mode")).toBeNull();
    expect(localStorage.getItem("daycmd.focus-mode")).toBe("1");
  });

  it("toggle flips state and persists '1' / '0'", () => {
    const { result } = renderHook(() => useFocusMode());
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem("daycmd.focus-mode")).toBe("1");
    act(() => result.current[1]());
    expect(result.current[0]).toBe(false);
    expect(localStorage.getItem("daycmd.focus-mode")).toBe("0");
  });

  it("set(value) replaces state explicitly", () => {
    const { result } = renderHook(() => useFocusMode());
    act(() => result.current[2](true));
    expect(result.current[0]).toBe(true);
    act(() => result.current[2](false));
    expect(result.current[0]).toBe(false);
  });
});

describe("TodFrame", () => {
  afterEach(() => {
    document.documentElement.className = "";
  });

  it("syncs the tod class to <html> so portals inherit the palette", () => {
    const { rerender } = render(
      <TodFrame tod="dawn" focus={false}>
        x
      </TodFrame>,
    );
    expect(document.documentElement.classList.contains("tod-dawn")).toBe(true);

    rerender(
      <TodFrame tod="night" focus={false}>
        x
      </TodFrame>,
    );
    expect(document.documentElement.classList.contains("tod-night")).toBe(true);
    expect(document.documentElement.classList.contains("tod-dawn")).toBe(false);
  });

  it("applies focus and tod classes to the frame", () => {
    const { container } = render(
      <TodFrame tod="dusk" focus>
        x
      </TodFrame>,
    );
    const frame = container.querySelector(".daycmd-frame")!;
    expect(frame.classList.contains("tod-dusk")).toBe(true);
    expect(frame.classList.contains("focus")).toBe(true);
  });
});
