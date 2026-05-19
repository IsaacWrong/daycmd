import Anthropic from "@anthropic-ai/sdk";
import { env } from "./config";
import { recordUsage, getTodaySpendUsd } from "./usage";
import { getSettings } from "./settings";
import { readStateSync, writeStateSync } from "./vault-state";
import { logError } from "./errors";

export type MicroCall = {
  source: string;
  prompt: string;
  system?: string;
  model?: string;
  maxTokens?: number;
  schema?: object;
};

export type MicroResult<T> = {
  data: T;
  cached: boolean;
};

type MemEntry = { value: unknown; expires: number };
const mem = new Map<string, MemEntry>();

function memGet<T>(key: string): T | null {
  const e = mem.get(key);
  if (!e) return null;
  if (e.expires < Date.now()) {
    mem.delete(key);
    return null;
  }
  return e.value as T;
}

function memSet(key: string, value: unknown, ttlMs: number): void {
  mem.set(key, { value, expires: Date.now() + ttlMs });
}

type PersistedEntry<T> = { value: T; expires: number };

function vaultKey(source: string, key: string): string {
  const safe = `${source}-${key}`.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120);
  return `micro/${safe}`;
}

export function readPersistedMicro<T>(source: string, key: string): T | null {
  const stored = readStateSync<PersistedEntry<T>>(vaultKey(source, key));
  if (!stored) return null;
  if (stored.expires < Date.now()) return null;
  return stored.value;
}

export function writePersistedMicro<T>(
  source: string,
  key: string,
  value: T,
  ttlMs: number,
): void {
  try {
    writeStateSync(vaultKey(source, key), {
      value,
      expires: Date.now() + ttlMs,
    });
  } catch {}
}

function extractText(message: Anthropic.Message): string {
  let out = "";
  for (const block of message.content) {
    if (block.type === "text") out += block.text;
  }
  return out;
}

function parseJsonLoose<T>(text: string): T | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {}
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1]) as T;
    } catch {}
  }
  const first = trimmed.indexOf("{");
  const firstArr = trimmed.indexOf("[");
  const start =
    first === -1 ? firstArr : firstArr === -1 ? first : Math.min(first, firstArr);
  if (start === -1) return null;
  const last = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
  if (last <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, last + 1)) as T;
  } catch {
    return null;
  }
}

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export async function microCall<T>(opts: MicroCall): Promise<T> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }
  const settings = getSettings();
  if (settings.budgetDailyUsd > 0) {
    const spent = getTodaySpendUsd();
    if (spent >= settings.budgetDailyUsd) {
      throw new Error(
        `Daily budget cap hit ($${spent.toFixed(2)} / $${settings.budgetDailyUsd}).`,
      );
    }
  }

  const model = opts.model ?? DEFAULT_MODEL;
  const maxTokens = opts.maxTokens ?? 800;
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const systemPrompt =
    opts.system ??
    "You produce concise JSON responses for a personal dashboard. Reply with JSON only, no prose, no code fences.";

  try {
    const message = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: opts.prompt }],
    });

    recordUsage({
      source: `micro:${opts.source}`,
      model,
      input_tokens: message.usage.input_tokens ?? 0,
      output_tokens: message.usage.output_tokens ?? 0,
      cache_read_tokens: message.usage.cache_read_input_tokens ?? 0,
      cache_write_tokens: message.usage.cache_creation_input_tokens ?? 0,
    });

    const text = extractText(message);
    const parsed = parseJsonLoose<T>(text);
    if (parsed === null) {
      throw new Error(`micro: failed to parse JSON from model. Raw: ${text.slice(0, 200)}`);
    }
    return parsed;
  } catch (e) {
    logError(`micro:${opts.source}`, (e as Error).message);
    throw e;
  }
}

export async function microCached<T>(
  opts: MicroCall & { cacheKey: string; ttlMs: number; persist?: boolean },
): Promise<MicroResult<T>> {
  const memKey = `${opts.source}:${opts.cacheKey}`;
  const memHit = memGet<T>(memKey);
  if (memHit !== null) return { data: memHit, cached: true };

  if (opts.persist) {
    const persisted = readPersistedMicro<T>(opts.source, opts.cacheKey);
    if (persisted !== null) {
      memSet(memKey, persisted, opts.ttlMs);
      return { data: persisted, cached: true };
    }
  }

  const fresh = await microCall<T>(opts);
  memSet(memKey, fresh, opts.ttlMs);
  if (opts.persist) writePersistedMicro<T>(opts.source, opts.cacheKey, fresh, opts.ttlMs);
  return { data: fresh, cached: false };
}

export function clearMicroCache(): void {
  mem.clear();
}
