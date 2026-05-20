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

let dir: string;
let mod: typeof import("./vault-write");

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "vault-write-"));
  holder.vault = dir;
  vi.resetModules();
  mod = await import("./vault-write");
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("vaultWrite", () => {
  it("writes string contents and reads them back", async () => {
    const p = path.join(dir, "note.md");
    await mod.vaultWrite(p, "hello world");
    const back = await fs.readFile(p, "utf8");
    expect(back).toBe("hello world");
  });

  it("creates parent directories if missing", async () => {
    const p = path.join(dir, "deep", "nested", "note.md");
    await mod.vaultWrite(p, "nested");
    const back = await fs.readFile(p, "utf8");
    expect(back).toBe("nested");
  });

  it("accepts Buffer contents", async () => {
    const p = path.join(dir, "buf.md");
    await mod.vaultWrite(p, Buffer.from("buf contents"));
    expect(await fs.readFile(p, "utf8")).toBe("buf contents");
  });

  it("rejects paths outside the vault root", async () => {
    const outside = path.join(os.tmpdir(), "escape.md");
    await expect(mod.vaultWrite(outside, "nope")).rejects.toThrow(
      /escapes vault root/,
    );
  });

  it("cleans up the tmp file if rename throws", async () => {
    const p = path.join(dir, "rename-fail.md");
    const realRename = fs.rename;
    const spy = vi
      .spyOn(fs, "rename")
      .mockImplementationOnce(async () => {
        throw new Error("simulated rename failure");
      });

    await expect(mod.vaultWrite(p, "data")).rejects.toThrow(
      "simulated rename failure",
    );
    spy.mockRestore();

    // Destination should not exist (rename never succeeded).
    await expect(fs.access(p)).rejects.toThrow();

    // No leftover .tmp- file in the vault root.
    const entries = await fs.readdir(dir);
    const leftover = entries.filter((e) => e.includes(".tmp-"));
    expect(leftover).toEqual([]);

    // Sanity: rename actually works after we restore it.
    expect(realRename).toBe(fs.rename);
  });

  it("overwrites existing files atomically", async () => {
    const p = path.join(dir, "exists.md");
    await fs.writeFile(p, "old", "utf8");
    await mod.vaultWrite(p, "new");
    expect(await fs.readFile(p, "utf8")).toBe("new");
  });
});

describe("vaultAppend", () => {
  it("creates the file when missing", async () => {
    const p = path.join(dir, "log.md");
    await mod.vaultAppend(p, "line one\n");
    expect(await fs.readFile(p, "utf8")).toBe("line one\n");
  });

  it("appends to existing contents", async () => {
    const p = path.join(dir, "log.md");
    await fs.writeFile(p, "line one\n", "utf8");
    await mod.vaultAppend(p, "line two\n");
    expect(await fs.readFile(p, "utf8")).toBe("line one\nline two\n");
  });
});

describe("trashBeforeOverwrite", () => {
  it("copies prior content to the trash dir", async () => {
    const p = path.join(dir, "daily-2026-05-20.md");
    await fs.writeFile(p, "original content", "utf8");
    const trashPath = await mod.trashBeforeOverwrite(p);
    expect(trashPath).not.toBeNull();
    expect(trashPath!).toContain(path.join(".daycmd", "trash"));
    expect(trashPath!).toContain("daily-2026-05-20.md");
    const trashed = await fs.readFile(trashPath!, "utf8");
    expect(trashed).toBe("original content");
  });

  it("returns null and creates no trash entry for new files", async () => {
    const p = path.join(dir, "brand-new.md");
    const result = await mod.trashBeforeOverwrite(p);
    expect(result).toBeNull();
    // Trash dir may or may not exist; if it does, it should be empty.
    const trashDir = path.join(dir, ".daycmd", "trash");
    try {
      const entries = await fs.readdir(trashDir);
      expect(entries).toEqual([]);
    } catch {
      // Dir not created — also fine.
    }
  });

  it("uses an ISO timestamp with portable dashes (no colons)", async () => {
    const p = path.join(dir, "page.md");
    await fs.writeFile(p, "x", "utf8");
    const trashPath = await mod.trashBeforeOverwrite(p);
    expect(trashPath).not.toBeNull();
    const base = path.basename(trashPath!);
    expect(base).not.toContain(":");
    expect(base).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z--page\.md$/);
  });
});

describe("vaultDelete", () => {
  it("preserves contents in trash before unlinking", async () => {
    const p = path.join(dir, "wiki-page.md");
    await fs.writeFile(p, "important wiki", "utf8");
    await mod.vaultDelete(p);
    await expect(fs.access(p)).rejects.toThrow();
    const trashDir = path.join(dir, ".daycmd", "trash");
    const entries = await fs.readdir(trashDir);
    expect(entries.length).toBe(1);
    const restored = await fs.readFile(path.join(trashDir, entries[0]), "utf8");
    expect(restored).toBe("important wiki");
  });

  it("is a no-op when the file does not exist", async () => {
    const p = path.join(dir, "nothing-here.md");
    await expect(mod.vaultDelete(p)).resolves.toBeUndefined();
  });
});

describe("sweepTrash", () => {
  it("removes only entries older than maxAgeMs", async () => {
    // Seed the trash dir manually with two files; backdate one.
    const trashDir = path.join(dir, ".daycmd", "trash");
    await fs.mkdir(trashDir, { recursive: true });
    const oldFile = path.join(trashDir, "old.md");
    const newFile = path.join(trashDir, "new.md");
    await fs.writeFile(oldFile, "old", "utf8");
    await fs.writeFile(newFile, "new", "utf8");
    const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await fs.utimes(oldFile, longAgo, longAgo);

    const res = await mod.sweepTrash(14 * 24 * 60 * 60 * 1000);
    expect(res.removed).toBe(1);
    await expect(fs.access(oldFile)).rejects.toThrow();
    await expect(fs.access(newFile)).resolves.toBeUndefined();
  });

  it("returns { removed: 0 } when the trash dir does not exist", async () => {
    const res = await mod.sweepTrash(1);
    expect(res).toEqual({ removed: 0 });
  });
});
