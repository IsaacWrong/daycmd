import { describe, expect, it } from "vitest";
import { parseDraft } from "./TaskList";

describe("parseDraft", () => {
  it("returns just the text when no modifiers are present", () => {
    expect(parseDraft("Buy milk")).toEqual({ text: "Buy milk" });
  });

  it("extracts an ISO due date via the 📅 prefix", () => {
    expect(parseDraft("Ship invoice 📅 2026-05-15")).toEqual({
      text: "Ship invoice",
      due: "2026-05-15",
    });
  });

  it("extracts an ISO due date via the due: prefix", () => {
    expect(parseDraft("Call vendor due:2026-05-20")).toEqual({
      text: "Call vendor",
      due: "2026-05-20",
    });
  });

  it("resolves 'today' to the local ISO date", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(parseDraft("Plan today")).toMatchObject({ text: "Plan", due: today });
  });

  it("extracts a priority bang and strips it from the text", () => {
    expect(parseDraft("Ship release !high")).toEqual({
      text: "Ship release",
      priority: "high",
    });
    expect(parseDraft("Quick win !low")).toMatchObject({ priority: "low" });
    expect(parseDraft("urgent !highest now")).toMatchObject({ priority: "highest" });
  });

  it("normalises priority aliases", () => {
    expect(parseDraft("a !hi").priority).toBe("high");
    expect(parseDraft("a !med").priority).toBe("medium");
  });

  it("extracts a @file destination", () => {
    expect(parseDraft("Pay invoice @Inbox")).toEqual({
      text: "Pay invoice",
      file: "Inbox",
    });
  });

  it("combines due date, priority, and file in any order", () => {
    expect(parseDraft("!high @Personal 📅 2026-05-15 Polish deck")).toMatchObject({
      text: "Polish deck",
      priority: "high",
      file: "Personal",
      due: "2026-05-15",
    });
  });

  it("ignores invalid priority words", () => {
    expect(parseDraft("Plan trip !urgent").priority).toBeUndefined();
  });
});
