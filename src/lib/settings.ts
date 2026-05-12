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

export type AppSettings = {
  budgetDailyUsd: number; // 0 = no cap
  budgetAlertPct: number; // 0-1, e.g. 0.8 = warn at 80%
  defaultCategory: string;
};

const DEFAULTS: AppSettings = {
  budgetDailyUsd: 0,
  budgetAlertPct: 0.8,
  defaultCategory: "Personal",
};

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
