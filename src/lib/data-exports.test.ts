import { describe, expect, it } from "vitest";
import {
  CATEGORY_SCHEMAS,
  GLOBAL_SCHEMA,
  defaultCategories,
} from "./kb-schemas";
import { SKILLS } from "./skills-defs";

describe("kb-schemas", () => {
  it("ships a non-empty global schema", () => {
    expect(GLOBAL_SCHEMA.length).toBeGreaterThan(200);
    expect(GLOBAL_SCHEMA).toMatch(/Wiki structure/);
  });

  it("provides per-category schemas for every default category", () => {
    for (const c of defaultCategories()) {
      expect(CATEGORY_SCHEMAS[c]).toBeDefined();
      expect(CATEGORY_SCHEMAS[c].length).toBeGreaterThan(20);
    }
  });
});

describe("skills-defs", () => {
  it("exposes a non-empty list of skill definitions with required fields", () => {
    expect(SKILLS.length).toBeGreaterThan(0);
    for (const s of SKILLS) {
      expect(s.id).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.prompt).toBeTruthy();
    }
  });
});
