import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { VaultPathError } from "./vault-path";

const holder: { vault: string } = { vault: "" };

vi.mock("./config", () => ({
  env: {
    get VAULT_PATH() {
      return holder.vault;
    },
  },
}));

const { appendTask, markTaskDone, editTask } = await import("./tasks-writer");

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "tw-sec-"));
  holder.vault = dir;
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("tasks-writer path-traversal defense", () => {
  it("rejects appendTask with a parent-traversal file", async () => {
    await expect(
      appendTask({ file: "../../etc/passwd", text: "pwn" }),
    ).rejects.toBeInstanceOf(VaultPathError);
  });

  it("rejects appendTask with an absolute file outside the vault", async () => {
    await expect(
      appendTask({ file: "/etc/passwd", text: "pwn" }),
    ).rejects.toBeInstanceOf(VaultPathError);
  });

  it("rejects markTaskDone with a parent-traversal file", async () => {
    await expect(
      markTaskDone({ file: "../../escape", text: "x" }),
    ).rejects.toBeInstanceOf(VaultPathError);
  });

  it("rejects editTask with a parent-traversal file", async () => {
    await expect(
      editTask({ file: "../../escape", line: 0, text: "x" }),
    ).rejects.toBeInstanceOf(VaultPathError);
  });

  it("rejects null-byte injection in file param", async () => {
    await expect(
      appendTask({ file: "Inbox\0../escape", text: "x" }),
    ).rejects.toBeInstanceOf(VaultPathError);
  });

  it("allows a vault-internal Tasks/ filename", async () => {
    const res = await appendTask({ file: "Inbox", text: "ok" });
    expect(res.path).toBe(path.join("Tasks", "Inbox.md"));
    const body = await fs.readFile(path.join(dir, "Tasks", "Inbox.md"), "utf8");
    expect(body).toContain("- [ ] ok");
  });
});
