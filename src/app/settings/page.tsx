"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Settings = {
  budgetDailyUsd: number;
  budgetAlertPct: number;
  defaultCategory: string;
};

type GoogleStatus = { configured: boolean; connected: boolean };

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [categories, setCategories] = useState<string[]>(["Personal"]);
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings);
    fetch("/api/kb")
      .then((r) => r.json())
      .then((j: { categories: Array<{ name: string }> }) =>
        setCategories((j.categories ?? []).map((c) => c.name)),
      );
    fetch("/api/auth/google/status")
      .then((r) => r.json())
      .then(setGoogle);
  }, []);

  async function save(patch: Partial<Settings>) {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const next = (await res.json()) as Settings;
    setSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }

  async function disconnectGoogle() {
    if (!confirm("Disconnect Google? Will need to reauth Gmail + Calendar.")) return;
    await fetch("/api/auth/google/status", { method: "DELETE" });
    setGoogle({ configured: google?.configured ?? false, connected: false });
  }

  if (!settings) {
    return (
      <main className="flex-1 px-8 py-10 max-w-3xl mx-auto w-full">
        <p className="text-zinc-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex-1 px-8 py-10 max-w-3xl mx-auto w-full">
      <header className="mb-10 flex items-baseline justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <Link href="/" className="text-sm text-sky-400 hover:text-sky-300">
          ← Back to dashboard
        </Link>
      </header>

      <div className="space-y-8">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400 mb-3">
            Budget
          </h2>
          <p className="text-xs text-zinc-500 mb-4">
            Daily Anthropic API spend cap (USD). Set 0 for no limit. Agent calls
            hard-fail past the cap.
          </p>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm text-zinc-300 w-32">Daily cap</span>
            <span className="text-zinc-500">$</span>
            <input
              type="number"
              min={0}
              step={1}
              value={settings.budgetDailyUsd}
              onChange={(e) =>
                save({ budgetDailyUsd: Number(e.target.value) })
              }
              className="w-24 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-sm text-zinc-100"
            />
            <span className="text-xs text-zinc-600">0 = unlimited</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-300 w-32">Warn at</span>
            <input
              type="number"
              min={0}
              max={100}
              step={5}
              value={Math.round(settings.budgetAlertPct * 100)}
              onChange={(e) =>
                save({ budgetAlertPct: Number(e.target.value) / 100 })
              }
              className="w-20 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-sm text-zinc-100"
            />
            <span className="text-xs text-zinc-600">% of cap</span>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400 mb-3">
            Defaults
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-300 w-32">Default category</span>
            <select
              value={settings.defaultCategory}
              onChange={(e) => save({ defaultCategory: e.target.value })}
              className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-sm text-zinc-100"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400 mb-3">
            Integrations
          </h2>
          <div className="text-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-300">Google (Gmail + Calendar)</span>
              <span className="flex items-center gap-2">
                <span
                  className={
                    "text-xs " +
                    (google?.connected
                      ? "text-emerald-400"
                      : google?.configured
                        ? "text-amber-400"
                        : "text-zinc-500")
                  }
                >
                  {google?.connected
                    ? "Connected"
                    : google?.configured
                      ? "Not connected"
                      : "Not configured"}
                </span>
                {google?.connected && (
                  <button
                    onClick={disconnectGoogle}
                    className="text-xs px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                  >
                    Disconnect
                  </button>
                )}
                {google?.configured && !google?.connected && (
                  <a
                    href="/api/auth/google"
                    className="text-xs px-2 py-0.5 rounded bg-zinc-100 text-zinc-900"
                  >
                    Connect
                  </a>
                )}
              </span>
            </div>
            <p className="text-xs text-zinc-600">
              Scopes: gmail.readonly, gmail.modify, gmail.send, calendar,
              calendar.events. After enabling new calendar/task features,
              disconnect and reconnect to grant write scopes.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400 mb-3">
            Models per skill
          </h2>
          <p className="text-xs text-zinc-500 mb-2">
            Configured in <code>src/lib/skills-defs.ts</code> (file-based for now).
            Sonnet 4.6 for routine, Opus 4.7 for synthesis.
          </p>
          <ul className="text-xs text-zinc-400 space-y-1 font-mono">
            <li>Morning Brief · Triage · Plan · Stale · Reflect · Capture → claude-sonnet-4-6 / medium</li>
            <li>Weekly Review → claude-opus-4-7 / high</li>
            <li>Research Topic → claude-opus-4-7 / xhigh</li>
            <li>Free-form chat → claude-opus-4-7 / high</li>
            <li>KB Compile · Lint · Automations → claude-sonnet-4-6 / medium-high</li>
          </ul>
        </section>

        {saved && (
          <p className="text-xs text-emerald-400">Saved.</p>
        )}
      </div>
    </main>
  );
}
