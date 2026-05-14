import { describe, it, expect } from "vitest";
import { writeRawIngest, writeOutput, wikiWrite, wikiDelete, readWikiPage, categoryPath } from "./kb";
import { VaultPathError } from "./vault-path";

describe("kb path-traversal defense", () => {
  it("rejects a category that escapes the vault", async () => {
    await expect(
      writeRawIngest({ category: "../escape", title: "x", content: "y" }),
    ).rejects.toBeInstanceOf(VaultPathError);

    await expect(
      writeOutput({ category: "../../escape", title: "x", content: "y" }),
    ).rejects.toBeInstanceOf(VaultPathError);
  });

  it("rejects an absolute category", () => {
    expect(() => categoryPath("/etc")).toThrow(VaultPathError);
  });

  it("rejects wiki relPaths that escape the category", async () => {
    await expect(
      wikiWrite("Work", "../../escape.md", "x"),
    ).rejects.toBeInstanceOf(VaultPathError);

    await expect(
      wikiDelete("Work", "../../escape.md"),
    ).rejects.toBeInstanceOf(VaultPathError);

    await expect(
      readWikiPage("Work", "../../escape.md"),
    ).rejects.toBeInstanceOf(VaultPathError);
  });

  it("rejects absolute wiki relPaths", async () => {
    await expect(
      wikiWrite("Work", "/etc/passwd", "x"),
    ).rejects.toBeInstanceOf(VaultPathError);
  });

  it("rejects null-byte injection in relPaths", async () => {
    await expect(
      wikiWrite("Work", "concepts/attention.md\0.evil", "x"),
    ).rejects.toBeInstanceOf(VaultPathError);
  });
});
