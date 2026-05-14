import { env } from "./config";
import { db } from "./db";
import { readStateSync, writeStateSync } from "./vault-state";

const SETTINGS_KEY = "settings";

export type AppSettings = {
  budgetDailyUsd: number; // 0 = no cap
  budgetAlertPct: number; // 0-1, e.g. 0.8 = warn at 80%
  defaultCategory: string;
};

export type DiscordSettings = {
  configured: boolean;
  tokenSource: "settings" | "env" | null;
  watchedChannelIds: string[];
  defaultChannelId: string;
};

const DEFAULTS: AppSettings = {
  budgetDailyUsd: 0,
  budgetAlertPct: 0.8,
  defaultCategory: "Personal",
};

// Discord bot token stays in the local DB — it's a secret, not config we want
// flowing through Obsidian Sync to every device.
const DISCORD_TOKEN_DB_KEY = "discord.bot_token";

type StoredSettings = {
  budgetDailyUsd?: number;
  budgetAlertPct?: number;
  defaultCategory?: string;
  discord?: {
    watchedChannelIds?: string[];
    defaultChannelId?: string;
  };
};

function getDbSetting(key: string): string | null {
  const r = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return r?.value ?? null;
}

function setDbSetting(key: string, value: string): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, value);
}

function deleteDbSetting(key: string): void {
  db.prepare("DELETE FROM settings WHERE key = ?").run(key);
}

// One-shot copy of legacy DB-backed settings into the vault. Runs at most once
// per process — subsequent reads see the vault file and short-circuit.
let _migrated = false;
function migrateFromDb(): StoredSettings | null {
  if (_migrated) return null;
  _migrated = true;
  const keys = [
    "budget.daily_usd",
    "budget.alert_pct",
    "default.category",
    "discord.watched_channel_ids",
    "discord.default_channel_id",
  ];
  let any = false;
  const out: StoredSettings = {};
  const budgetDaily = getDbSetting("budget.daily_usd");
  if (budgetDaily !== null) {
    out.budgetDailyUsd = Number(budgetDaily);
    any = true;
  }
  const budgetAlert = getDbSetting("budget.alert_pct");
  if (budgetAlert !== null) {
    out.budgetAlertPct = Number(budgetAlert);
    any = true;
  }
  const defaultCat = getDbSetting("default.category");
  if (defaultCat !== null) {
    out.defaultCategory = defaultCat;
    any = true;
  }
  const watched = getDbSetting("discord.watched_channel_ids");
  const defChan = getDbSetting("discord.default_channel_id");
  if (watched !== null || defChan !== null) {
    out.discord = {
      watchedChannelIds: parseStringList(watched),
      defaultChannelId: (defChan ?? "").trim(),
    };
    any = true;
  }
  if (!any) return null;
  // Best-effort cleanup so the DB stops being a parallel source.
  try {
    for (const k of keys) deleteDbSetting(k);
  } catch {}
  return out;
}

function loadStored(): StoredSettings {
  if (!env.VAULT_PATH) return {};
  const remote = readStateSync<StoredSettings>(SETTINGS_KEY);
  if (remote) return remote;
  const migrated = migrateFromDb();
  if (migrated) {
    try {
      writeStateSync(SETTINGS_KEY, migrated);
    } catch {}
    return migrated;
  }
  return {};
}

function saveStored(patch: (cur: StoredSettings) => StoredSettings): StoredSettings {
  const cur = loadStored();
  const next = patch(cur);
  if (env.VAULT_PATH) writeStateSync(SETTINGS_KEY, next);
  return next;
}

function parseStringList(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return [...new Set(parsed.filter((x): x is string => typeof x === "string"))];
    }
  } catch {}
  return [
    ...new Set(
      value
        .split(/[\n,]/)
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ];
}

export function getSettings(): AppSettings {
  const s = loadStored();
  return {
    budgetDailyUsd: s.budgetDailyUsd ?? DEFAULTS.budgetDailyUsd,
    budgetAlertPct: s.budgetAlertPct ?? DEFAULTS.budgetAlertPct,
    defaultCategory: s.defaultCategory ?? DEFAULTS.defaultCategory,
  };
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  saveStored((cur) => {
    const next = { ...cur };
    if (patch.budgetDailyUsd !== undefined)
      next.budgetDailyUsd = Math.max(0, patch.budgetDailyUsd);
    if (patch.budgetAlertPct !== undefined)
      next.budgetAlertPct = Math.max(0, Math.min(1, patch.budgetAlertPct));
    if (patch.defaultCategory !== undefined) next.defaultCategory = patch.defaultCategory;
    return next;
  });
  return getSettings();
}

export function getDiscordToken(): string {
  return getDbSetting(DISCORD_TOKEN_DB_KEY) ?? env.DISCORD_BOT_TOKEN;
}

export function getDiscordSettings(): DiscordSettings {
  const storedToken = getDbSetting(DISCORD_TOKEN_DB_KEY);
  const envToken = env.DISCORD_BOT_TOKEN;
  const s = loadStored().discord ?? {};
  return {
    configured: !!(storedToken || envToken),
    tokenSource: storedToken ? "settings" : envToken ? "env" : null,
    watchedChannelIds: s.watchedChannelIds ?? [],
    defaultChannelId: (s.defaultChannelId ?? "").trim(),
  };
}

export function updateDiscordSettings(patch: {
  botToken?: string;
  watchedChannelIds?: string[];
  defaultChannelId?: string;
}): DiscordSettings {
  if (patch.botToken !== undefined) {
    const token = patch.botToken.trim();
    if (token) setDbSetting(DISCORD_TOKEN_DB_KEY, token);
  }
  if (patch.watchedChannelIds !== undefined || patch.defaultChannelId !== undefined) {
    saveStored((cur) => {
      const discord = { ...(cur.discord ?? {}) };
      if (patch.watchedChannelIds !== undefined) {
        discord.watchedChannelIds = [
          ...new Set(patch.watchedChannelIds.map((x) => x.trim()).filter(Boolean)),
        ];
      }
      if (patch.defaultChannelId !== undefined) {
        const value = patch.defaultChannelId.trim();
        if (value) discord.defaultChannelId = value;
        else delete discord.defaultChannelId;
      }
      return { ...cur, discord };
    });
  }
  return getDiscordSettings();
}

export function clearDiscordToken(): DiscordSettings {
  deleteDbSetting(DISCORD_TOKEN_DB_KEY);
  return getDiscordSettings();
}
