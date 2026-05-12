import { env } from "./config";
import { db } from "./db";

function getSetting(key: string): string | null {
  const r = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return r?.value ?? null;
}

function setSetting(key: string, value: string): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, value);
}

function deleteSetting(key: string): void {
  db.prepare("DELETE FROM settings WHERE key = ?").run(key);
}

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

const DISCORD_TOKEN_KEY = "discord.bot_token";
const DISCORD_WATCHED_CHANNELS_KEY = "discord.watched_channel_ids";
const DISCORD_DEFAULT_CHANNEL_KEY = "discord.default_channel_id";

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
  return {
    budgetDailyUsd: Number(getSetting("budget.daily_usd") ?? DEFAULTS.budgetDailyUsd),
    budgetAlertPct: Number(getSetting("budget.alert_pct") ?? DEFAULTS.budgetAlertPct),
    defaultCategory: getSetting("default.category") ?? DEFAULTS.defaultCategory,
  };
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  if (patch.budgetDailyUsd !== undefined)
    setSetting("budget.daily_usd", String(Math.max(0, patch.budgetDailyUsd)));
  if (patch.budgetAlertPct !== undefined)
    setSetting(
      "budget.alert_pct",
      String(Math.max(0, Math.min(1, patch.budgetAlertPct))),
    );
  if (patch.defaultCategory !== undefined)
    setSetting("default.category", patch.defaultCategory);
  return getSettings();
}

export function getDiscordToken(): string {
  return getSetting(DISCORD_TOKEN_KEY) ?? env.DISCORD_BOT_TOKEN;
}

export function getDiscordSettings(): DiscordSettings {
  const storedToken = getSetting(DISCORD_TOKEN_KEY);
  const envToken = env.DISCORD_BOT_TOKEN;
  return {
    configured: !!(storedToken || envToken),
    tokenSource: storedToken ? "settings" : envToken ? "env" : null,
    watchedChannelIds: parseStringList(getSetting(DISCORD_WATCHED_CHANNELS_KEY)),
    defaultChannelId: (getSetting(DISCORD_DEFAULT_CHANNEL_KEY) ?? "").trim(),
  };
}

export function updateDiscordSettings(patch: {
  botToken?: string;
  watchedChannelIds?: string[];
  defaultChannelId?: string;
}): DiscordSettings {
  if (patch.botToken !== undefined) {
    const token = patch.botToken.trim();
    if (token) setSetting(DISCORD_TOKEN_KEY, token);
  }
  if (patch.watchedChannelIds !== undefined) {
    setSetting(
      DISCORD_WATCHED_CHANNELS_KEY,
      JSON.stringify(
        [...new Set(patch.watchedChannelIds.map((x) => x.trim()).filter(Boolean))],
      ),
    );
  }
  if (patch.defaultChannelId !== undefined) {
    const value = patch.defaultChannelId.trim();
    if (value) setSetting(DISCORD_DEFAULT_CHANNEL_KEY, value);
    else deleteSetting(DISCORD_DEFAULT_CHANNEL_KEY);
  }
  return getDiscordSettings();
}

export function clearDiscordToken(): DiscordSettings {
  deleteSetting(DISCORD_TOKEN_KEY);
  return getDiscordSettings();
}
