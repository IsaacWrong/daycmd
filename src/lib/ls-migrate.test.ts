import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrateKey, migratePrefix } from "./ls-migrate";

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
});

describe("migrateKey", () => {
  it("moves the value from oldKey to newKey when newKey is empty", () => {
    localStorage.setItem("old", "value");
    migrateKey("old", "new");
    expect(localStorage.getItem("new")).toBe("value");
    expect(localStorage.getItem("old")).toBeNull();
  });

  it("does nothing when oldKey does not exist", () => {
    migrateKey("old", "new");
    expect(localStorage.getItem("new")).toBeNull();
  });

  it("preserves newKey if it already has a value, but still clears oldKey", () => {
    localStorage.setItem("old", "old-value");
    localStorage.setItem("new", "kept");
    migrateKey("old", "new");
    expect(localStorage.getItem("new")).toBe("kept");
    expect(localStorage.getItem("old")).toBeNull();
  });

  it("is idempotent on repeat calls", () => {
    localStorage.setItem("old", "value");
    migrateKey("old", "new");
    migrateKey("old", "new");
    expect(localStorage.getItem("new")).toBe("value");
  });
});

describe("migratePrefix", () => {
  it("moves every matching key to the new prefix and removes the old ones", () => {
    localStorage.setItem("ai-os.thread.alpha", "a");
    localStorage.setItem("ai-os.thread.beta", "b");
    localStorage.setItem("unrelated", "z");
    migratePrefix("ai-os.thread.", "daycmd.thread.");
    expect(localStorage.getItem("daycmd.thread.alpha")).toBe("a");
    expect(localStorage.getItem("daycmd.thread.beta")).toBe("b");
    expect(localStorage.getItem("ai-os.thread.alpha")).toBeNull();
    expect(localStorage.getItem("ai-os.thread.beta")).toBeNull();
    expect(localStorage.getItem("unrelated")).toBe("z");
  });

  it("does not overwrite a destination that already exists", () => {
    localStorage.setItem("old.k", "from-old");
    localStorage.setItem("new.k", "already-here");
    migratePrefix("old.", "new.");
    expect(localStorage.getItem("new.k")).toBe("already-here");
    expect(localStorage.getItem("old.k")).toBeNull();
  });

  it("is a no-op when no keys match", () => {
    localStorage.setItem("a", "1");
    migratePrefix("zzz.", "yyy.");
    expect(localStorage.getItem("a")).toBe("1");
    expect(localStorage.length).toBe(1);
  });
});
