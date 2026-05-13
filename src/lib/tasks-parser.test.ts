import { describe, expect, it } from "vitest";
import { parseTasks, sortTasks } from "./tasks-parser";

describe("parseTasks", () => {
  it("ignores non-task lines", () => {
    const out = parseTasks("# Heading\nplain text\n- bullet but no checkbox", "Inbox.md");
    expect(out).toHaveLength(0);
  });

  it("parses an open task", () => {
    const [t] = parseTasks("- [ ] Buy milk", "Inbox.md");
    expect(t).toMatchObject({
      text: "Buy milk",
      done: false,
      cancelled: false,
      due: null,
      priority: null,
      file: "Inbox.md",
      line: 0,
    });
    expect(t.id).toBe("Inbox.md:0");
  });

  it("marks done tasks with their completion date and strips emoji from text", () => {
    const [t] = parseTasks("- [x] Ship release ✅ 2026-05-10", "Tasks/Inbox.md");
    expect(t.done).toBe(true);
    expect(t.doneDate).toBe("2026-05-10");
    expect(t.text).toBe("Ship release");
  });

  it("parses due, start, scheduled and recurrence", () => {
    const [t] = parseTasks(
      "- [ ] Weekly review 📅 2026-05-15 🛫 2026-05-12 ⏳ 2026-05-13 🔁 every week",
      "Tasks/Inbox.md",
    );
    expect(t.due).toBe("2026-05-15");
    expect(t.start).toBe("2026-05-12");
    expect(t.scheduled).toBe("2026-05-13");
    expect(t.recurrence).toBe("every week");
    expect(t.text).toBe("Weekly review");
  });

  it("recognises every priority glyph", () => {
    const out = parseTasks(
      [
        "- [ ] critical 🔺",
        "- [ ] hi ⏫",
        "- [ ] med 🔼",
        "- [ ] low 🔽",
        "- [ ] cold ⏬",
      ].join("\n"),
      "Tasks/Inbox.md",
    );
    expect(out.map((t) => t.priority)).toEqual([
      "highest",
      "high",
      "medium",
      "low",
      "lowest",
    ]);
    expect(out.every((t) => !/[🔺⏫🔼🔽⏬]/u.test(t.text))).toBe(true);
  });

  it("marks tasks containing the cancelled glyph", () => {
    const [t] = parseTasks("- [ ] Old plan ❌", "Inbox.md");
    expect(t.cancelled).toBe(true);
  });

  it("preserves the original raw line and 0-indexed line number", () => {
    const content = ["# Today", "", "- [ ] First", "  - [ ] Indented"].join("\n");
    const out = parseTasks(content, "Daily/2026-05-13.md");
    expect(out).toHaveLength(2);
    expect(out[0].line).toBe(2);
    expect(out[0].raw).toBe("- [ ] First");
    expect(out[1].line).toBe(3);
    expect(out[1].text).toBe("Indented");
  });
});

describe("sortTasks", () => {
  const mk = (over: Partial<ReturnType<typeof parseTasks>[number]>) =>
    ({
      id: "x",
      text: "t",
      done: false,
      cancelled: false,
      due: null,
      start: null,
      scheduled: null,
      doneDate: null,
      priority: null,
      recurrence: null,
      file: "f",
      line: 0,
      raw: "",
      ...over,
    }) as ReturnType<typeof parseTasks>[number];

  it("puts open tasks before done tasks", () => {
    const out = sortTasks([mk({ done: true, text: "a" }), mk({ done: false, text: "b" })]);
    expect(out.map((t) => t.text)).toEqual(["b", "a"]);
  });

  it("orders by due date ascending, treating no due date as far future", () => {
    const out = sortTasks([
      mk({ due: null, text: "later" }),
      mk({ due: "2026-05-15", text: "next-week" }),
      mk({ due: "2026-05-10", text: "soon" }),
    ]);
    expect(out.map((t) => t.text)).toEqual(["soon", "next-week", "later"]);
  });

  it("breaks ties by priority", () => {
    const out = sortTasks([
      mk({ due: "2026-05-10", priority: "low", text: "lo" }),
      mk({ due: "2026-05-10", priority: "highest", text: "hi" }),
      mk({ due: "2026-05-10", priority: null, text: "none" }),
    ]);
    expect(out.map((t) => t.text)).toEqual(["hi", "lo", "none"]);
  });
});
