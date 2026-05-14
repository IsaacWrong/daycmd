import "@testing-library/jest-dom/vitest";
import os from "node:os";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Tests that touch the filesystem mkdtemp inside os.tmpdir(). Point VAULT_PATH
// there so the vault-path safety guard treats those temp dirs as inside-vault.
process.env.VAULT_PATH = process.env.VAULT_PATH || os.tmpdir();

afterEach(() => {
  cleanup();
});
