"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TodFrame, useFocusMode, useTod } from "@/components/redesign/TodFrame";
import { Section } from "@/components/redesign/Section";

type Settings = {
  budgetDailyUsd: number;
  budgetAlertPct: number;
  defaultCategory: string;
};

type GoogleStatus = { configured: boolean; connected: boolean };

type EnvStatus = {
  vaultPath: { present: boolean; valid: boolean; reason?: string };
  anthropicKey: { present: boolean };
  githubToken: { present: boolean };
  googleClient: { present: boolean };
  ready: boolean;
};

const FIELD_STYLE: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--rule)",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 13,
  color: "var(--fg)",
  fontFamily: "inherit",
  outline: "none",
  letterSpacing: "-0.005em",
};

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-4 py-2.5">
      <span className="text-[13px] text-fg-soft" style={{ width: 160 }}>
        {label}
      </span>
      <div className="flex items-center gap-3">{children}</div>
      {hint && <span className="t-mono text-[11px] text-fg-soft">{hint}</span>}
    </div>
  );
}

export default function SettingsPage() {
  const tod = useTod();
  const [focus] = useFocusMode();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [categories, setCategories] = useState<string[]>(["Personal"]);
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [saved, setSaved] = useState(false);
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null);
  const [envForm, setEnvForm] = useState({
    VAULT_PATH: "",
    ANTHROPIC_API_KEY: "",
    GITHUB_TOKEN: "",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
  });
  const [envSaving, setEnvSaving] = useState(false);
  const [envMsg, setEnvMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
    fetch("/api/setup")
      .then((r) => r.json())
      .then(setEnvStatus);
  }, []);

  async function saveEnv() {
    setEnvSaving(true);
    setEnvMsg(null);
    try {
      const body: Record<string, string> = {};
      for (const [k, v] of Object.entries(envForm)) {
        if (v.trim()) body[k] = v.trim();
      }
      if (Object.keys(body).length === 0) {
        setEnvMsg({ ok: false, text: "Nothing to save." });
        return;
      }
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; status?: EnvStatus };
      if (!res.ok || !j.ok) {
        setEnvMsg({ ok: false, text: j.error ?? `HTTP ${res.status}` });
        return;
      }
      if (j.status) setEnvStatus(j.status);
      setEnvForm({
        VAULT_PATH: "",
        ANTHROPIC_API_KEY: "",
        GITHUB_TOKEN: "",
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
      });
      setEnvMsg({ ok: true, text: "saved · restart `npm run dev` to pick up" });
    } catch (e) {
      setEnvMsg({ ok: false, text: (e as Error).message });
    } finally {
      setEnvSaving(false);
    }
  }

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

  return (
    <TodFrame tod={tod} focus={focus}>
      <div
        className="dimmable flex items-center gap-[22px]"
        style={{
          padding: "22px 48px 18px",
          borderBottom: "1px solid var(--rule)",
        }}
      >
        <div className="flex items-center gap-3.5">
          <span
            className="inline-flex items-center justify-center text-white font-semibold"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background:
                "linear-gradient(135deg, var(--c-agent), var(--c-tasks) 80%, var(--c-github))",
              fontSize: 14,
              boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 0.20)",
            }}
          >
            ◉
          </span>
          <div
            className="t-mono flex items-center gap-2.5"
            style={{ fontSize: 12, color: "var(--fg-soft)", whiteSpace: "nowrap" }}
          >
            <Link href="/" className="hover:text-fg">
              ← Daycmd
            </Link>
            <span style={{ opacity: 0.5 }}>/</span>
            <span style={{ color: "var(--fg)" }}>settings</span>
          </div>
        </div>
        <span className="flex-1" />
        {saved && (
          <span
            className="t-mono"
            style={{ fontSize: 11, color: "var(--c-good)" }}
          >
            saved
          </span>
        )}
      </div>

      <main
        className="scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "32px 48px 64px",
          maxWidth: 880,
          width: "100%",
          margin: "0 auto",
        }}
      >
        <div className="mb-9">
          <div className="t-eyebrow mb-2">Settings</div>
          <h1
            className="m-0"
            style={{ fontSize: 40, fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1 }}
          >
            Preferences
          </h1>
          <p className="text-fg-soft mt-2.5" style={{ fontSize: 14, letterSpacing: "-0.005em" }}>
            Budget, integrations, and per-skill model defaults.
          </p>
        </div>

        {!settings ? (
          <p className="text-[13px] text-fg-soft">Loading…</p>
        ) : (
          <>
            <Section eyebrow="Env" title="Keys & tokens" accent="agent">
              <p
                className="text-[12.5px] text-fg-soft mb-3"
                style={{ letterSpacing: "-0.005em" }}
              >
                Edit values in <code className="t-mono">.env.local</code>. Restart{" "}
                <code className="t-mono">npm run dev</code> after saving — Next caches{" "}
                <code className="t-mono">process.env</code> at boot. Existing values stay set unless overridden.
              </p>
              {envStatus && (
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  {[
                    ["vault", envStatus.vaultPath.valid],
                    ["anthropic", envStatus.anthropicKey.present],
                    ["github", envStatus.githubToken.present],
                    ["google", envStatus.googleClient.present],
                  ].map(([label, ok]) => (
                    <span
                      key={label as string}
                      className="t-mono inline-flex items-center gap-1.5"
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 4,
                        border: `1px solid ${ok ? "var(--c-good)" : "var(--rule)"}`,
                        color: ok ? "var(--c-good)" : "var(--fg-soft)",
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 99,
                          background: ok ? "var(--c-good)" : "var(--fg-soft)",
                        }}
                      />
                      {label as string}
                    </span>
                  ))}
                </div>
              )}
              {([
                ["VAULT_PATH", "Vault path", "text", "/Users/you/Documents/Your Vault"],
                ["ANTHROPIC_API_KEY", "Anthropic API key", "password", "sk-ant-api03-…"],
                ["GITHUB_TOKEN", "GitHub token", "password", "ghp_…"],
                ["GOOGLE_CLIENT_ID", "Google client ID", "text", "…apps.googleusercontent.com"],
                ["GOOGLE_CLIENT_SECRET", "Google client secret", "password", "GOCSPX-…"],
              ] as const).map(([k, label, type, ph]) => (
                <Field key={k} label={label}>
                  <input
                    type={type}
                    value={envForm[k]}
                    onChange={(e) =>
                      setEnvForm((s) => ({ ...s, [k]: e.target.value }))
                    }
                    placeholder={ph}
                    style={{ ...FIELD_STYLE, width: 380 }}
                  />
                </Field>
              ))}
              <div className="flex items-center gap-3 mt-3">
                <button
                  type="button"
                  onClick={saveEnv}
                  disabled={envSaving}
                  className="t-mono"
                  style={{
                    padding: "7px 14px",
                    background: "var(--c-agent)",
                    color: "white",
                    border: 0,
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: envSaving ? "wait" : "pointer",
                    letterSpacing: "-0.005em",
                  }}
                >
                  {envSaving ? "Saving…" : "Save to .env.local"}
                </button>
                {envMsg && (
                  <span
                    className="t-mono"
                    style={{
                      fontSize: 11,
                      color: envMsg.ok ? "var(--c-good)" : "var(--c-error)",
                    }}
                  >
                    {envMsg.text}
                  </span>
                )}
              </div>
            </Section>

            <Section eyebrow="Spend" title="Budget" accent="agent">
              <p className="text-[12.5px] text-fg-soft mb-2.5" style={{ letterSpacing: "-0.005em" }}>
                Daily Anthropic API spend cap (USD). Set 0 for no limit. Agent calls hard-fail past the cap.
              </p>
              <Field label="Daily cap" hint="0 = unlimited">
                <span className="text-fg-soft">$</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={settings.budgetDailyUsd}
                  onChange={(e) => save({ budgetDailyUsd: Number(e.target.value) })}
                  style={{ ...FIELD_STYLE, width: 100 }}
                />
              </Field>
              <Field label="Warn at" hint="% of cap">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(settings.budgetAlertPct * 100)}
                  onChange={(e) => save({ budgetAlertPct: Number(e.target.value) / 100 })}
                  style={{ ...FIELD_STYLE, width: 80 }}
                />
              </Field>
            </Section>

            <Section eyebrow="Agent" title="Defaults" accent="tasks">
              <Field label="Default category">
                <select
                  value={settings.defaultCategory}
                  onChange={(e) => save({ defaultCategory: e.target.value })}
                  style={FIELD_STYLE}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
            </Section>

            <Section eyebrow="Auth" title="Integrations" accent="calendar">
              <div
                className="flex items-center justify-between py-2.5"
                style={{ borderBottom: "1px dashed var(--rule)" }}
              >
                <div>
                  <div className="text-[13px]">Google · Gmail + Calendar</div>
                  <div className="t-mono text-[10px] text-fg-soft mt-1">
                    gmail.readonly · gmail.modify · gmail.send · calendar · calendar.events
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="t-mono"
                    style={{
                      fontSize: 11,
                      color: google?.connected
                        ? "var(--c-good)"
                        : google?.configured
                          ? "var(--c-error)"
                          : "var(--fg-soft)",
                    }}
                  >
                    {google?.connected
                      ? "connected"
                      : google?.configured
                        ? "not connected"
                        : "not configured"}
                  </span>
                  {google?.connected && (
                    <button
                      type="button"
                      onClick={disconnectGoogle}
                      className="t-mono"
                      style={{
                        ...FIELD_STYLE,
                        fontSize: 11,
                        padding: "3px 8px",
                        cursor: "pointer",
                        color: "var(--c-error)",
                      }}
                    >
                      disconnect
                    </button>
                  )}
                  {google?.configured && !google?.connected && (
                    <a
                      href="/api/auth/google"
                      className="t-mono"
                      style={{
                        ...FIELD_STYLE,
                        fontSize: 11,
                        padding: "3px 8px",
                        cursor: "pointer",
                        color: "var(--c-agent)",
                      }}
                    >
                      connect
                    </a>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-fg-soft mt-3" style={{ letterSpacing: "-0.005em" }}>
                After enabling new calendar/task features, disconnect and reconnect to grant write scopes.
              </p>
            </Section>

            <Section eyebrow="Models" title="Per-skill defaults" accent="github">
              <p className="text-[12.5px] text-fg-soft mb-3" style={{ letterSpacing: "-0.005em" }}>
                Configured in <code className="t-mono">src/lib/skills-defs.ts</code> (file-based for now). Sonnet 4.6 for routine, Opus 4.7 for synthesis.
              </p>
              <ul className="t-mono space-y-1.5" style={{ fontSize: 11.5, color: "var(--fg-soft)" }}>
                <li>Morning Brief · Triage · Plan · Stale · Reflect · Capture → claude-sonnet-4-6 / medium</li>
                <li>Weekly Review → claude-opus-4-7 / high</li>
                <li>Research Topic → claude-opus-4-7 / xhigh</li>
                <li>Free-form chat → claude-opus-4-7 / high</li>
                <li>KB Compile · Lint · Automations → claude-sonnet-4-6 / medium-high</li>
              </ul>
            </Section>

            <Section eyebrow="Off-dashboard" title="Other surfaces" accent="obsidian">
              <p className="text-[12.5px] text-fg-soft" style={{ letterSpacing: "-0.005em" }}>
                Automation runs, KB compile drift, and idea capture have moved off the home page.
                They&apos;ll get dedicated routes — for now they remain accessible via the agent
                (ask &ldquo;list automations&rdquo; or &ldquo;capture idea&rdquo;).
              </p>
            </Section>
          </>
        )}
      </main>
    </TodFrame>
  );
}
