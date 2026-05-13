"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TodFrame, useFocusMode, useTod } from "@/components/redesign/TodFrame";

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
  padding: "8px 12px",
  fontSize: 13.5,
  color: "var(--fg)",
  fontFamily: "inherit",
  outline: "none",
  letterSpacing: "-0.005em",
  width: "100%",
};

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
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
      {label}
    </span>
  );
}

export default function SetupPage() {
  const tod = useTod();
  const [focus] = useFocusMode();
  const [status, setStatus] = useState<EnvStatus | null>(null);
  const [vaultPath, setVaultPath] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [googleId, setGoogleId] = useState("");
  const [googleSecret, setGoogleSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then(setStatus);
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    setErr(null);
    try {
      const body: Record<string, string> = {};
      if (vaultPath.trim()) body.VAULT_PATH = vaultPath.trim();
      if (anthropicKey.trim()) body.ANTHROPIC_API_KEY = anthropicKey.trim();
      if (githubToken.trim()) body.GITHUB_TOKEN = githubToken.trim();
      if (googleId.trim()) body.GOOGLE_CLIENT_ID = googleId.trim();
      if (googleSecret.trim()) body.GOOGLE_CLIENT_SECRET = googleSecret.trim();
      if (Object.keys(body).length === 0) {
        setErr("Nothing to save — fill at least one field.");
        return;
      }
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; status?: EnvStatus };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? `HTTP ${res.status}`);
        return;
      }
      if (j.status) setStatus(j.status);
      setSaved(true);
      // Don't clear the fields — user may want to copy values.
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
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
            className="t-mono"
            style={{ fontSize: 12, color: "var(--fg-soft)" }}
          >
            Daycmd / <span style={{ color: "var(--fg)" }}>setup</span>
          </div>
        </div>
        <span className="flex-1" />
        {status?.ready ? (
          <Link
            href="/"
            className="t-mono"
            style={{
              fontSize: 11,
              padding: "3px 8px",
              border: "1px solid var(--rule)",
              borderRadius: 4,
              color: "var(--c-good)",
              textDecoration: "none",
            }}
          >
            ready → go to dashboard
          </Link>
        ) : null}
      </div>

      <main
        className="scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "32px 48px 64px",
          maxWidth: 760,
          width: "100%",
          margin: "0 auto",
        }}
      >
        <div className="mb-9">
          <div className="t-eyebrow mb-2">First-run setup</div>
          <h1
            className="m-0"
            style={{ fontSize: 40, fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1 }}
          >
            Wire up your accounts
          </h1>
          <p
            className="text-fg-soft mt-2.5"
            style={{ fontSize: 14, letterSpacing: "-0.005em" }}
          >
            Fill what you have. Daycmd will write these to{" "}
            <code className="t-mono">.env.local</code>. Restart{" "}
            <code className="t-mono">npm run dev</code> after saving — Next caches{" "}
            <code className="t-mono">process.env</code> at boot.
          </p>
        </div>

        {status && (
          <div className="mb-8 flex flex-wrap items-center gap-2">
            <Pill ok={status.vaultPath.valid} label="vault" />
            <Pill ok={status.anthropicKey.present} label="anthropic" />
            <Pill ok={status.githubToken.present} label="github" />
            <Pill ok={status.googleClient.present} label="google" />
            <span className="flex-1" />
            <span
              className="t-mono"
              style={{
                fontSize: 11,
                color: status.ready ? "var(--c-good)" : "var(--c-error)",
              }}
            >
              {status.ready ? "ready to run" : "missing required keys"}
            </span>
          </div>
        )}

        <section className="mb-7">
          <div className="t-eyebrow mb-2" style={{ color: "var(--c-tasks)" }}>
            Required
          </div>
          <hr className="hr-rule mb-3.5" />

          <div className="mb-4">
            <label
              className="block text-[13px] mb-1.5"
              style={{ letterSpacing: "-0.005em" }}
            >
              Vault path
            </label>
            <input
              type="text"
              value={vaultPath}
              onChange={(e) => setVaultPath(e.target.value)}
              placeholder="/Users/you/Documents/Your Vault"
              style={FIELD_STYLE}
            />
            <p className="t-mono text-[11px] text-fg-soft mt-1.5">
              Absolute path to your Obsidian vault. To kick the tires, use the
              bundled sample at{" "}
              <code>{`${typeof window !== "undefined" ? "" : ""}`}/path/to/daycmd/examples/sample-vault</code>.
              {status?.vaultPath.present && !status.vaultPath.valid && (
                <span style={{ color: "var(--c-error)" }}>
                  {" "}
                  · current value: {status.vaultPath.reason ?? "invalid"}
                </span>
              )}
            </p>
          </div>

          <div>
            <label
              className="block text-[13px] mb-1.5"
              style={{ letterSpacing: "-0.005em" }}
            >
              Anthropic API key
            </label>
            <input
              type="password"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder="sk-ant-api03-…"
              style={FIELD_STYLE}
            />
            <p className="t-mono text-[11px] text-fg-soft mt-1.5">
              From{" "}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--c-agent)" }}
              >
                console.anthropic.com → API Keys
              </a>
              . Required for the agent + KB compile/lint.
            </p>
          </div>
        </section>

        <section className="mb-7">
          <div className="t-eyebrow mb-2" style={{ color: "var(--c-fg-soft)" }}>
            Optional integrations
          </div>
          <hr className="hr-rule mb-3.5" />

          <div className="mb-4">
            <label
              className="block text-[13px] mb-1.5"
              style={{ letterSpacing: "-0.005em" }}
            >
              GitHub token
            </label>
            <input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_…"
              style={FIELD_STYLE}
            />
            <p className="t-mono text-[11px] text-fg-soft mt-1.5">
              Classic PAT w/ scopes <code>repo</code>, <code>notifications</code>,{" "}
              <code>read:user</code>. Powers GitHub section, ship streak, heatmap.{" "}
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--c-github)" }}
              >
                create one
              </a>
              .
            </p>
          </div>

          <div className="mb-4">
            <label
              className="block text-[13px] mb-1.5"
              style={{ letterSpacing: "-0.005em" }}
            >
              Google client ID
            </label>
            <input
              type="text"
              value={googleId}
              onChange={(e) => setGoogleId(e.target.value)}
              placeholder="123456789-abc….apps.googleusercontent.com"
              style={FIELD_STYLE}
            />
          </div>

          <div>
            <label
              className="block text-[13px] mb-1.5"
              style={{ letterSpacing: "-0.005em" }}
            >
              Google client secret
            </label>
            <input
              type="password"
              value={googleSecret}
              onChange={(e) => setGoogleSecret(e.target.value)}
              placeholder="GOCSPX-…"
              style={FIELD_STYLE}
            />
            <p className="t-mono text-[11px] text-fg-soft mt-1.5">
              OAuth web client. Redirect URI{" "}
              <code>http://localhost:3000/api/auth/google/callback</code>.{" "}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--c-calendar)" }}
              >
                console.cloud.google.com → Credentials
              </a>
              . After saving + restarting, click <em>Connect Google</em> in{" "}
              <Link href="/settings" style={{ color: "var(--c-calendar)" }}>
                /settings
              </Link>{" "}
              to authorize.
            </p>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="t-mono"
            style={{
              padding: "9px 16px",
              background: "var(--c-agent)",
              color: "white",
              border: 0,
              borderRadius: 6,
              fontSize: 12.5,
              cursor: saving ? "wait" : "pointer",
              letterSpacing: "-0.005em",
            }}
          >
            {saving ? "Saving…" : "Save to .env.local"}
          </button>
          {saved && (
            <span
              className="t-mono"
              style={{ fontSize: 11, color: "var(--c-good)" }}
            >
              saved · restart <code>npm run dev</code> to pick up the changes
            </span>
          )}
          {err && (
            <span
              className="t-mono"
              style={{ fontSize: 11, color: "var(--c-error)" }}
            >
              {err}
            </span>
          )}
        </div>
      </main>
    </TodFrame>
  );
}
