import { describe, it, expect } from "vitest";
import path from "node:path";
import { safeJoin, VaultPathError } from "./vault-path";

const ROOT = "/tmp/test-vault";

describe("safeJoin", () => {
  it("joins normal vault-relative segments", () => {
    expect(safeJoin(ROOT, "Daily", "2026-05-14.md")).toBe(
      path.join(ROOT, "Daily", "2026-05-14.md"),
    );
  });

  it("joins a single nested segment", () => {
    expect(safeJoin(ROOT, "Categories/Work/wiki/INDEX.md")).toBe(
      path.join(ROOT, "Categories/Work/wiki/INDEX.md"),
    );
  });

  it("rejects parent traversal", () => {
    expect(() => safeJoin(ROOT, "..", "etc", "passwd")).toThrow(VaultPathError);
    expect(() => safeJoin(ROOT, "Daily", "..", "..", "etc")).toThrow(VaultPathError);
    expect(() => safeJoin(ROOT, "Categories/../../escape")).toThrow(VaultPathError);
  });

  it("rejects absolute segments", () => {
    expect(() => safeJoin(ROOT, "/etc/passwd")).toThrow(VaultPathError);
    expect(() => safeJoin(ROOT, "Daily", "/absolute.md")).toThrow(VaultPathError);
  });

  it("rejects null-byte injection", () => {
    expect(() => safeJoin(ROOT, "Daily\0.md")).toThrow(VaultPathError);
  });

  it("allows the root itself", () => {
    expect(safeJoin(ROOT, ".")).toBe(path.resolve(ROOT));
  });

  it("rejects a segment that resolves exactly to the parent", () => {
    expect(() => safeJoin(ROOT, "..")).toThrow(VaultPathError);
  });

  it("permits trailing slashes and current-dir refs that stay inside", () => {
    expect(safeJoin(ROOT, "./Daily/./2026-05-14.md")).toBe(
      path.join(ROOT, "Daily", "2026-05-14.md"),
    );
  });
});
