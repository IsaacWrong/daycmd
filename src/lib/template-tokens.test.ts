import { describe, expect, it } from "vitest";
import { renderTemplate } from "./template-tokens";

const D = new Date(2026, 4, 13, 9, 7, 3); // 2026-05-13 09:07:03 local

describe("renderTemplate", () => {
  it("substitutes bare {{date}} and {{time}}", () => {
    expect(renderTemplate("D={{date}} T={{time}}", D)).toBe("D=2026-05-13 T=09:07");
  });

  it("supports moment-style date formats", () => {
    expect(renderTemplate("{{date:YYYY-MM-DD}}", D)).toBe("2026-05-13");
    expect(renderTemplate("{{date:dddd}}", D)).toBe("Wednesday");
    expect(renderTemplate("{{date:MMM D}}", D)).toBe("May 13");
  });

  it("preserves bracket literals untouched", () => {
    expect(renderTemplate("{{date:[Week of] YYYY-MM-DD}}", D)).toBe(
      "Week of 2026-05-13",
    );
  });

  it("substitutes {{title}} with the supplied option, else falls back to ISO date", () => {
    expect(renderTemplate("# {{title}}", D, { title: "Daily" })).toBe("# Daily");
    expect(renderTemplate("# {{title}}", D)).toBe("# 2026-05-13");
  });

  it("formats time tokens", () => {
    expect(renderTemplate("{{time:HH:mm:ss}}", D)).toBe("09:07:03");
    expect(renderTemplate("{{time:h:mm A}}", D)).toBe("9:07 AM");
  });
});
