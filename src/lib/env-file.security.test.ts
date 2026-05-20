import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { updateEnvFile } from "./env-file";

let cwd: string;
let envFile: string;
let restoreCwd: () => void;

beforeEach(async () => {
  cwd = await fs.mkdtemp(path.join(os.tmpdir(), "envfile-sec-"));
  envFile = path.join(cwd, ".env.local");
  const original = process.cwd();
  process.chdir(cwd);
  restoreCwd = () => process.chdir(original);
});

afterEach(async () => {
  restoreCwd();
  await fs.rm(cwd, { recursive: true, force: true });
});

describe("updateEnvFile newline injection guard", () => {
  it("rejects values containing \\n (prevents extra env-line injection)", async () => {
    await expect(
      updateEnvFile({
        ANTHROPIC_API_KEY:
          "sk-real\nGOOGLE_REDIRECT_URI=http://evil.example/cb",
      }),
    ).rejects.toThrow(/newline|NUL/);
    // The file should NOT have been written.
    await expect(fs.stat(envFile)).rejects.toThrow();
  });

  it("rejects values containing \\r", async () => {
    await expect(
      updateEnvFile({ GITHUB_TOKEN: "ghp_x\rFOO=bar" }),
    ).rejects.toThrow(/newline|NUL/);
  });

  it("rejects values containing \\0", async () => {
    await expect(
      updateEnvFile({ GITHUB_TOKEN: "ghp_x\0bad" }),
    ).rejects.toThrow(/newline|NUL/);
  });

  it("still accepts ordinary values", async () => {
    await expect(
      updateEnvFile({ ANTHROPIC_API_KEY: "sk-fine-value" }),
    ).resolves.toBeUndefined();
    const body = await fs.readFile(envFile, "utf8");
    expect(body).toContain("ANTHROPIC_API_KEY=sk-fine-value");
  });
});
