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
let projectsDir: string;
let projects: typeof import("./projects");

async function seedProject(name: string, fm: Record<string, unknown>, body = ""): Promise<void> {
  const lines = ["---"];
  for (const [k, v] of Object.entries(fm)) {
    lines.push(`${k}: ${JSON.stringify(v)}`);
  }
  lines.push("---", "", body);
  await fs.writeFile(path.join(projectsDir, `${name}.md`), lines.join("\n"), "utf8");
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "projects-"));
  holder.vault = dir;
  projectsDir = path.join(dir, "Projects");
  await fs.mkdir(projectsDir, { recursive: true });
  vi.resetModules();
  projects = await import("./projects");
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("listProjects", () => {
  it("only returns markdown files with type: project frontmatter", async () => {
    await seedProject("alpha", { type: "project", status: "building" });
    await seedProject("note", { type: "note" });
    const list = await projects.listProjects();
    expect(list.map((p) => p.name)).toEqual(["alpha"]);
    expect(list[0].frontmatter.status).toBe("building");
  });

  it("listActiveProjects skips archived projects", async () => {
    await seedProject("alpha", { type: "project", repo: "user/alpha" });
    await seedProject("beta", { type: "project", repo: "user/beta", archived: true });
    await seedProject("gamma", { type: "project" });
    const active = await projects.listActiveProjects();
    expect(active.map((p) => p.name).sort()).toEqual(["alpha", "gamma"]);
  });
});

describe("updateFrontmatter / setNext / archiveProject", () => {
  it("patches existing frontmatter while preserving the body", async () => {
    await seedProject(
      "alpha",
      { type: "project", status: "idea" },
      "# Alpha\n\nIntro body.",
    );
    const updated = await projects.updateFrontmatter("alpha", { status: "building" });
    expect(updated.frontmatter.status).toBe("building");
    expect(updated.frontmatter.type).toBe("project");
    expect(updated.body).toContain("Intro body.");
  });

  it("setNext writes the next pointer", async () => {
    await seedProject("alpha", { type: "project" });
    const p = await projects.setNext("alpha", "Ship v0.1");
    expect(p.frontmatter.next).toBe("Ship v0.1");
  });

  it("archiveProject sets the archived flag", async () => {
    await seedProject("alpha", { type: "project" });
    const p = await projects.archiveProject("alpha");
    expect(p.frontmatter.archived).toBe(true);
  });
});

describe("appendIdea / appendLogEntry / appendUnfiledIdea", () => {
  it("appendIdea creates an Ideas section when missing", async () => {
    await seedProject("alpha", { type: "project" }, "# Alpha\n");
    const fixed = new Date("2026-05-13T15:00:00Z");
    const p = await projects.appendIdea("alpha", "Try server-sent events", fixed);
    expect(p.body).toMatch(/## Ideas/);
    expect(p.body).toMatch(/Try server-sent events/);
  });

  it("appendLogEntry adds an entry under Log and recomputes weekly_hours", async () => {
    await seedProject("alpha", { type: "project" }, "# Alpha\n\n## Log\n");
    const p = await projects.appendLogEntry("alpha", {
      date: new Date().toISOString().slice(0, 10),
      start: "09:00",
      end: "10:30",
      minutes: 90,
    });
    expect(p.body).toMatch(/## Log/);
    expect(p.body).toMatch(/09:00–10:30 \(90m\)/);
    expect(p.frontmatter.weekly_hours).toBeCloseTo(1.5, 2);
  });

  it("appendUnfiledIdea creates Inbox.md on first use", async () => {
    const fixed = new Date("2026-05-13T15:00:00Z");
    const result = await projects.appendUnfiledIdea("Quick capture", fixed);
    expect(result).toBe(path.join(dir, "Inbox.md"));
    const body = await fs.readFile(result, "utf8");
    expect(body).toMatch(/# Inbox/);
    expect(body).toMatch(/Quick capture/);
  });
});
