import { afterEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { TodFrame, todForHour, type Tod } from "./TodFrame";

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
