import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { editTask } from "./tasks-writer";

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "taskedit-"));
  file = path.join(dir, "Inbox.md");
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

async function seed(lines: string[]): Promise<void> {
  await fs.writeFile(file, lines.join("\n") + "\n", "utf8");
}

async function readLines(): Promise<string[]> {
  return (await fs.readFile(file, "utf8")).split("\n");
}

describe("editTask", () => {
  it("rewrites a task line in place, preserving the checkbox marker", async () => {
    await seed(["# Tasks", "", "- [ ] Buy milk", "- [ ] Other"]);

    const res = await editTask({
      file,
      line: 2,
      originalText: "Buy milk",
      text: "Buy oat milk",
      due: "2026-05-20",
      priority: "high",
    });

    expect(res).toEqual({
      ok: true,
      line: 2,
      raw: "- [ ] Buy oat milk ⏫ 📅 2026-05-20",
    });
    const lines = await readLines();
    expect(lines[2]).toBe("- [ ] Buy oat milk ⏫ 📅 2026-05-20");
    expect(lines[3]).toBe("- [ ] Other");
  });

  it("keeps a [x] marker on edit so done state is not lost", async () => {
    await seed(["- [x] Ship release ✅ 2026-05-10"]);
    const res = await editTask({
      file,
      line: 0,
      text: "Ship release notes",
    });
    expect(res.ok).toBe(true);
    const lines = await readLines();
    expect(lines[0]).toBe("- [x] Ship release notes");
  });

  it("returns 409 when originalText no longer matches", async () => {
    await seed(["- [ ] Buy milk"]);
    const res = await editTask({
      file,
      line: 0,
      originalText: "Stale text",
      text: "Buy oat milk",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(409);
  });

  it("rejects edits targeting a non-task line", async () => {
    await seed(["# Tasks", "Some prose"]);
    const res = await editTask({ file, line: 1, text: "x" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(409);
  });

  it("returns 404 when the file does not exist", async () => {
    const res = await editTask({
      file: path.join(dir, "missing.md"),
      line: 0,
      text: "x",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(404);
  });

  it("rejects an out-of-range line index", async () => {
    await seed(["- [ ] only line"]);
    const res = await editTask({ file, line: 99, text: "x" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(409);
  });
});
