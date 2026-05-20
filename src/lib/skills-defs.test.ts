import { describe, expect, it } from "vitest";
import {
  MODEL_CHOICES,
  SKILLS,
  isValidModel,
  resolveSkill,
  type SkillOverride,
} from "./skills-defs";

describe("isValidModel", () => {
  it("accepts every id in MODEL_CHOICES", () => {
    for (const c of MODEL_CHOICES) {
      expect(isValidModel(c.id)).toBe(true);
    }
  });

  it("rejects unknown strings", () => {
    expect(isValidModel("gpt-4")).toBe(false);
    expect(isValidModel("")).toBe(false);
    expect(isValidModel("claude")).toBe(false);
  });
});

describe("resolveSkill", () => {
  const brief = SKILLS.find((s) => s.id === "brief")!;

  it("returns the original skill when no overrides exist", () => {
    expect(resolveSkill(brief)).toBe(brief);
    expect(resolveSkill(brief, {})).toBe(brief);
    expect(resolveSkill(brief, { other: { model: "claude-opus-4-7" } })).toBe(
      brief,
    );
  });

  it("merges in a model override", () => {
    const overrides: Record<string, SkillOverride> = {
      brief: { model: "claude-opus-4-7" },
    };
    const out = resolveSkill(brief, overrides);
    expect(out.model).toBe("claude-opus-4-7");
    expect(out.id).toBe(brief.id);
    expect(out.effort).toBe(brief.effort);
    expect(out.maxTokens).toBe(brief.maxTokens);
  });

  it("merges effort + maxTokens overrides independently", () => {
    const out = resolveSkill(brief, {
      brief: { effort: "max", maxTokens: 12000 },
    });
    expect(out.effort).toBe("max");
    expect(out.maxTokens).toBe(12000);
    expect(out.model).toBe(brief.model);
  });

  it("ignores falsy override values rather than clobbering with undefined", () => {
    const out = resolveSkill(brief, {
      brief: { model: undefined, effort: undefined, maxTokens: undefined },
    });
    expect(out.model).toBe(brief.model);
    expect(out.effort).toBe(brief.effort);
    expect(out.maxTokens).toBe(brief.maxTokens);
  });
});

describe("SKILLS catalog", () => {
  it("every skill id is unique", () => {
    const ids = SKILLS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every skill model is a valid MODEL_CHOICES id", () => {
    for (const s of SKILLS) {
      if (s.model) expect(isValidModel(s.model)).toBe(true);
    }
  });
});
