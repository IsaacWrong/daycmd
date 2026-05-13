import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const holder: { vault: string } = { vault: "" };

vi.mock("./config", () => ({
  env: {
    get VAULT_PATH() {
      return holder.vault;
    },
  },
}));

const { appendTask, markTaskDone } = await import("./tasks-writer");

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "tw-fs-"));
  holder.vault = dir;
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("appendTask", () => {
  it("creates Tasks/Inbox.md and appends a formatted line", async () => {
    const res = await appendTask({
      text: "Buy milk",
      priority: "high",
      due: "2026-05-15",
    });
    expect(res.path).toBe(path.join("Tasks", "Inbox.md"));
    expect(res.line).toBeGreaterThanOrEqual(0);
    const body = await fs.readFile(path.join(dir, "Tasks", "Inbox.md"), "utf8");
    expect(body).toContain("- [ ] Buy milk ⏫ 📅 2026-05-15");
  });

  it("appends to a named file and preserves existing content", async () => {
    const tasksDir = path.join(dir, "Tasks");
    await fs.mkdir(tasksDir, { recursive: true });
    await fs.writeFile(
      path.join(tasksDir, "Work.md"),
      "# Work\n\n- [ ] Existing\n",
      "utf8",
    );
    await appendTask({ file: "Work", text: "New task" });
    const body = await fs.readFile(path.join(tasksDir, "Work.md"), "utf8");
    expect(body).toContain("- [ ] Existing");
    expect(body).toContain("- [ ] New task");
  });

  it("inserts a separating newline when the file does not end with one", async () => {
    const tasksDir = path.join(dir, "Tasks");
    await fs.mkdir(tasksDir, { recursive: true });
    await fs.writeFile(path.join(tasksDir, "Inbox.md"), "- [ ] No trailing nl", "utf8");
    await appendTask({ text: "Second" });
    const body = await fs.readFile(path.join(tasksDir, "Inbox.md"), "utf8");
    expect(body).toMatch(/- \[ \] No trailing nl\n- \[ \] Second\n$/);
  });

  it("emits start and scheduled date markers when provided", async () => {
    await appendTask({
      text: "Review",
      start: "2026-05-12",
      scheduled: "2026-05-13",
    });
    const body = await fs.readFile(path.join(dir, "Tasks", "Inbox.md"), "utf8");
    expect(body).toContain("🛫 2026-05-12");
    expect(body).toContain("⏳ 2026-05-13");
  });
});

describe("markTaskDone", () => {
  async function seed(name: string, lines: string[]): Promise<void> {
    const tasksDir = path.join(dir, "Tasks");
    await fs.mkdir(tasksDir, { recursive: true });
    await fs.writeFile(
      path.join(tasksDir, `${name}.md`),
      lines.join("\n") + "\n",
      "utf8",
    );
  }

  it("flips [ ] to [x] and stamps today on the matched line", async () => {
    await seed("Inbox", ["- [ ] Buy milk", "- [ ] Other"]);
    const res = await markTaskDone({ file: "Inbox", text: "Buy milk" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.matched).toBe(1);
    const body = await fs.readFile(path.join(dir, "Tasks", "Inbox.md"), "utf8");
    expect(body).toMatch(/^- \[x\] Buy milk ✅ \d{4}-\d{2}-\d{2}$/m);
    expect(body).toContain("- [ ] Other");
  });

  it("matches by case-insensitive substring", async () => {
    await seed("Inbox", ["- [ ] Refactor AGENT pipeline"]);
    const res = await markTaskDone({ file: "Inbox", text: "agent pipeline" });
    expect(res.ok).toBe(true);
  });

  it("returns an error when no open task matches", async () => {
    await seed("Inbox", ["- [x] Already done"]);
    const res = await markTaskDone({ file: "Inbox", text: "Already done" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/no open task/);
  });

  it("returns an error when the file cannot be read", async () => {
    const res = await markTaskDone({ file: "Missing", text: "x" });
    expect(res.ok).toBe(false);
  });
});
