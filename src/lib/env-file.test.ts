import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  getEnvStatus,
  SECRET_KEYS,
  updateEnvFile,
  validateVaultPath,
} from "./env-file";

let cwd: string;
let envFile: string;
let restoreCwd: () => void;

beforeEach(async () => {
  cwd = await fs.mkdtemp(path.join(os.tmpdir(), "envfile-"));
  envFile = path.join(cwd, ".env.local");
  const original = process.cwd();
  process.chdir(cwd);
  restoreCwd = () => process.chdir(original);
});

afterEach(async () => {
  restoreCwd();
  await fs.rm(cwd, { recursive: true, force: true });
});

describe("SECRET_KEYS", () => {
  it("classifies the well-known secret env vars", () => {
    expect(SECRET_KEYS.has("ANTHROPIC_API_KEY")).toBe(true);
    expect(SECRET_KEYS.has("GITHUB_TOKEN")).toBe(true);
    expect(SECRET_KEYS.has("GOOGLE_CLIENT_SECRET")).toBe(true);
    expect(SECRET_KEYS.has("VAULT_PATH")).toBe(false);
  });
});

describe("updateEnvFile", () => {
  it("writes new keys when .env.local does not exist", async () => {
    await updateEnvFile({ VAULT_PATH: "/tmp/vault", ANTHROPIC_API_KEY: "sk-abc" });
    const body = await fs.readFile(envFile, "utf8");
    expect(body).toContain("VAULT_PATH=/tmp/vault");
    expect(body).toContain("ANTHROPIC_API_KEY=sk-abc");
    expect(body.endsWith("\n")).toBe(true);
  });

  it("preserves existing comments and unrelated lines", async () => {
    await fs.writeFile(
      envFile,
      "# pinned\nOTHER=keep\nVAULT_PATH=/old\n",
      "utf8",
    );
    await updateEnvFile({ VAULT_PATH: "/new" });
    const body = await fs.readFile(envFile, "utf8");
    expect(body).toContain("# pinned");
    expect(body).toContain("OTHER=keep");
    expect(body).toContain("VAULT_PATH=/new");
    expect(body).not.toContain("/old");
  });

  it("clears a key when the update value is an empty string", async () => {
    await fs.writeFile(envFile, "ANTHROPIC_API_KEY=sk-old\nOTHER=x\n", "utf8");
    await updateEnvFile({ ANTHROPIC_API_KEY: "" });
    const body = await fs.readFile(envFile, "utf8");
    expect(body).not.toContain("ANTHROPIC_API_KEY");
    expect(body).toContain("OTHER=x");
  });

  it("quotes values containing whitespace or special characters", async () => {
    await updateEnvFile({ VAULT_PATH: "/Users/me/My Vault" });
    const body = await fs.readFile(envFile, "utf8");
    expect(body).toContain('VAULT_PATH="/Users/me/My Vault"');
  });
});

describe("validateVaultPath", () => {
  it("rejects an empty path", async () => {
    expect(await validateVaultPath("   ")).toEqual({
      ok: false,
      reason: "path is empty",
    });
  });

  it("rejects a relative path", async () => {
    const res = await validateVaultPath("./vault");
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/absolute/);
  });

  it("rejects a path that does not exist on disk", async () => {
    const res = await validateVaultPath(path.join(cwd, "missing"));
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/not found/);
  });

  it("rejects a path that exists but is a file", async () => {
    const filePath = path.join(cwd, "file.md");
    await fs.writeFile(filePath, "hi");
    const res = await validateVaultPath(filePath);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/not a directory/);
  });

  it("accepts a directory that contains .obsidian/", async () => {
    await fs.mkdir(path.join(cwd, ".obsidian"), { recursive: true });
    expect(await validateVaultPath(cwd)).toEqual({ ok: true });
  });

  it("accepts a directory that contains a known vault marker folder", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "vault-marker-"));
    await fs.mkdir(path.join(root, "Tasks"));
    expect(await validateVaultPath(root)).toEqual({ ok: true });
    await fs.rm(root, { recursive: true, force: true });
  });

  it("rejects a directory that looks empty", async () => {
    const empty = await fs.mkdtemp(path.join(os.tmpdir(), "empty-"));
    const res = await validateVaultPath(empty);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/doesn't look like/);
    await fs.rm(empty, { recursive: true, force: true });
  });
});

describe("getEnvStatus", () => {
  const originals: Record<string, string | undefined> = {};
  function setEnv(key: string, value: string | undefined) {
    if (!(key in originals)) originals[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  afterEach(() => {
    for (const [k, v] of Object.entries(originals)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    for (const k of Object.keys(originals)) delete originals[k];
  });

  it("reports ready=true when vault dir exists and Anthropic key is set", async () => {
    setEnv("VAULT_PATH", cwd);
    setEnv("ANTHROPIC_API_KEY", "sk-abc");
    setEnv("GITHUB_TOKEN", "ghp_x");
    setEnv("GOOGLE_CLIENT_ID", "id");
    setEnv("GOOGLE_CLIENT_SECRET", "secret");
    const s = await getEnvStatus();
    expect(s.ready).toBe(true);
    expect(s.vaultPath.valid).toBe(true);
    expect(s.anthropicKey.present).toBe(true);
    expect(s.githubToken.present).toBe(true);
    expect(s.googleClient.present).toBe(true);
  });

  it("flags an invalid vault path when the directory is missing", async () => {
    setEnv("VAULT_PATH", path.join(cwd, "does-not-exist"));
    setEnv("ANTHROPIC_API_KEY", "sk");
    const s = await getEnvStatus();
    expect(s.vaultPath.present).toBe(true);
    expect(s.vaultPath.valid).toBe(false);
    expect(s.vaultPath.reason).toMatch(/not found/);
    expect(s.ready).toBe(false);
  });

  it("flags a vault path that points at a file rather than a directory", async () => {
    const filePath = path.join(cwd, "notdir.md");
    await fs.writeFile(filePath, "hi");
    setEnv("VAULT_PATH", filePath);
    setEnv("ANTHROPIC_API_KEY", "sk");
    const s = await getEnvStatus();
    expect(s.vaultPath.valid).toBe(false);
    expect(s.vaultPath.reason).toMatch(/not a directory/);
  });

  it("ready=false when no Anthropic key is set", async () => {
    setEnv("VAULT_PATH", cwd);
    setEnv("ANTHROPIC_API_KEY", "");
    const s = await getEnvStatus();
    expect(s.ready).toBe(false);
    expect(s.anthropicKey.present).toBe(false);
  });
});
