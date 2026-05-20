"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFocusMode, useTod, TodFrame } from "@/components/redesign/TodFrame";
import { usePoll } from "@/lib/hooks";
import { Section, type SourceAccent } from "@/components/redesign/Section";
import { Sparkline } from "@/components/redesign/Sparkline";
import { apiFetch } from "@/lib/fetch-client";

type ProjectRow = {
  name: string;
  status: string | null;
  archived: boolean;
  started: string | null;
  repo: string | null;
  repoAutoLinked?: boolean;
  url: string | null;
  next: string | null;
  weeklyHours: number;
  totalHours: number;
  lastLogDate: string | null;
  logCount: number;
  stats: {
    recentCommits: number;
    windowDays: number;
    openPRs: number;
    dailyTrend: number[];
    lastCommit: { date: string; message: string; url: string } | null;
  } | null;
};

type Overview = {
  totals: {
    totalCount: number;
    activeCount: number;
    archivedCount: number;
    weeklyHoursTotal: number;
    totalHoursAllTime: number;
    commits30dTotal: number;
    openPRsTotal: number;
    byStatus: Record<string, number>;
  };
  projects: ProjectRow[];
};

function statusAccent(status: string | null): SourceAccent {
  const s = (status ?? "").toLowerCase();
  if (s === "shipping" || s.startsWith("shipping")) return "good";
  if (s === "building") return "tasks";
  if (s === "idea") return "calendar";
  if (s === "on hold") return "agent";
  return "github";
}

function StatTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        border: "1px solid var(--rule)",
        borderRadius: 12,
        background: "oklch(from var(--bg) l c h / 0.4)",
      }}
    >
      <div className="t-eyebrow mb-1.5">{label}</div>
      <div
        className="t-num font-medium"
        style={{ fontSize: 26, color: tone ?? "var(--fg)", letterSpacing: "-0.02em" }}
      >
        {value}
      </div>
      {sub && (
        <div className="t-mono text-[10px] text-fg-soft mt-1">{sub}</div>
      )}
    </div>
  );
}

type SortKey = "name" | "status" | "weeklyHours" | "totalHours" | "commits" | "lastLog";

export default function ProjectsOverviewPage() {
  const tod = useTod();
  const [focus] = useFocusMode();
  const { data, error, refresh } = usePoll<Overview>("/api/projects/overview", 60_000);
  const [showArchived, setShowArchived] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("weeklyHours");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: "",
    status: "idea",
    repo: "",
    url: "",
    next: "",
  });
  const [busy, setBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    setAddError(null);
    try {
      const res = await apiFetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          status: form.status || undefined,
          repo: form.repo.trim() || undefined,
          url: form.url.trim() || undefined,
          next: form.next.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `Failed (${res.status})`);
      }
      setForm({ name: "", status: "idea", repo: "", url: "", next: "" });
      setAdding(false);
      await refresh();
    } catch (err) {
      setAddError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const visible = useMemo(() => {
    const rows = (data?.projects ?? []).filter(
      (p) => showArchived || !p.archived,
    );
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const get = (r: ProjectRow): string | number => {
        switch (sortKey) {
          case "name":
            return r.name.toLowerCase();
          case "status":
            return (r.status ?? "").toLowerCase();
          case "weeklyHours":
            return r.weeklyHours;
          case "totalHours":
            return r.totalHours;
          case "commits":
            return r.stats?.recentCommits ?? 0;
          case "lastLog":
            return r.lastLogDate ?? "";
        }
      };
      const av = get(a);
      const bv = get(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [data, showArchived, sortKey, sortDir]);

  function setSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "name" || k === "status" ? "asc" : "desc");
    }
  }

  const totals = data?.totals;
  const statusEntries = Object.entries(totals?.byStatus ?? {}).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <TodFrame tod={tod} focus={focus}>
      <div
        className="dimmable flex items-center gap-[22px]"
        style={{ padding: "22px 48px 18px", borderBottom: "1px solid var(--rule)" }}
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
            <span style={{ color: "var(--fg)" }}>projects</span>
          </div>
        </div>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => {
            setAdding((v) => !v);
            setAddError(null);
          }}
          className="t-mono"
          style={{
            fontSize: 11,
            padding: "4px 10px",
            border: "1px solid var(--rule)",
            borderRadius: 6,
            background: "transparent",
            color: "var(--fg)",
            cursor: "pointer",
          }}
        >
          {adding ? "cancel" : "+ new project"}
        </button>
        <label className="flex items-center gap-2 t-mono" style={{ fontSize: 11, color: "var(--fg-soft)" }}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          show archived
        </label>
      </div>

      <div style={{ padding: "28px 48px 40px", flex: 1, minHeight: 0, overflowY: "auto" }}>
        {error && (
          <p className="text-[12px] mb-4" style={{ color: "var(--c-error)" }}>
            {error}
          </p>
        )}

        {adding && (
          <form
            onSubmit={submitAdd}
            className="mb-6"
            style={{
              padding: 16,
              border: "1px solid var(--rule)",
              borderRadius: 12,
              background: "oklch(from var(--bg) l c h / 0.4)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            <FormField label="Name *">
              <input
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Daycmd"
                disabled={busy}
                style={fieldStyle}
              />
            </FormField>
            <FormField label="Status">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                disabled={busy}
                style={fieldStyle}
              >
                <option value="idea">idea</option>
                <option value="active">active</option>
                <option value="building">building</option>
                <option value="on hold">on hold</option>
                <option value="shipping">shipping</option>
                <option value="shipped">shipped</option>
              </select>
            </FormField>
            <FormField label="Repo (owner/name)">
              <input
                value={form.repo}
                onChange={(e) => setForm({ ...form, repo: e.target.value })}
                placeholder="leave blank to auto-link"
                disabled={busy}
                style={fieldStyle}
              />
            </FormField>
            <FormField label="URL">
              <input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://"
                disabled={busy}
                style={fieldStyle}
              />
            </FormField>
            <FormField label="Next">
              <input
                value={form.next}
                onChange={(e) => setForm({ ...form, next: e.target.value })}
                placeholder="First milestone"
                disabled={busy}
                style={fieldStyle}
              />
            </FormField>
            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                gap: 12,
                alignItems: "center",
              }}
            >
              <button
                type="submit"
                disabled={busy || !form.name.trim()}
                className="t-mono"
                style={{
                  fontSize: 12,
                  padding: "6px 14px",
                  border: "1px solid var(--rule)",
                  borderRadius: 6,
                  background: "oklch(from var(--bg) l c h / 0.6)",
                  color: "var(--fg)",
                  cursor: busy ? "default" : "pointer",
                  opacity: busy || !form.name.trim() ? 0.5 : 1,
                }}
              >
                {busy ? "creating…" : "create project"}
              </button>
              {addError && (
                <span className="text-[12px]" style={{ color: "var(--c-error)" }}>
                  {addError}
                </span>
              )}
            </div>
          </form>
        )}

        <Section eyebrow="overview">
          <div
            className="grid gap-3 mb-6"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              marginTop: 16,
            }}
          >
            <StatTile
              label="Active"
              value={String(totals?.activeCount ?? 0)}
              sub={`${totals?.totalCount ?? 0} total · ${totals?.archivedCount ?? 0} archived`}
            />
            <StatTile
              label="Weekly hours"
              value={`${(totals?.weeklyHoursTotal ?? 0).toFixed(1)}h`}
              sub="across active projects"
              tone="var(--c-agent)"
            />
            <StatTile
              label="Total hours"
              value={`${(totals?.totalHoursAllTime ?? 0).toFixed(0)}h`}
              sub="all-time logged"
              tone="var(--c-obsidian)"
            />
            <StatTile
              label="Commits / 30d"
              value={String(totals?.commits30dTotal ?? 0)}
              sub={`${totals?.openPRsTotal ?? 0} open PRs`}
              tone="var(--c-github)"
            />
          </div>

          {statusEntries.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {statusEntries.map(([status, count]) => {
                const accent = statusAccent(status);
                return (
                  <span
                    key={status}
                    className="inline-flex items-center gap-2"
                    style={{
                      fontSize: 12,
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: "1px solid var(--rule)",
                      background: "oklch(from var(--bg) l c h / 0.4)",
                    }}
                  >
                    <span className={`src-dot src-${accent}`} style={{ width: 6, height: 6 }} />
                    <span style={{ color: "var(--fg)" }}>{status}</span>
                    <span className="t-mono t-num text-fg-soft" style={{ fontSize: 11 }}>
                      {count}
                    </span>
                  </span>
                );
              })}
            </div>
          )}
        </Section>

        <Section eyebrow="detail">
          <div style={{ overflowX: "auto" }}>
            <table
              className="w-full"
              style={{ borderCollapse: "collapse", fontSize: 13 }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid var(--rule)" }}>
                  <Th label="Project" k="name" sortKey={sortKey} sortDir={sortDir} onClick={setSort} />
                  <Th label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onClick={setSort} />
                  <Th label="Weekly h" k="weeklyHours" sortKey={sortKey} sortDir={sortDir} onClick={setSort} align="right" />
                  <Th label="Total h" k="totalHours" sortKey={sortKey} sortDir={sortDir} onClick={setSort} align="right" />
                  <Th label="Commits / 30d" k="commits" sortKey={sortKey} sortDir={sortDir} onClick={setSort} align="right" />
                  <Th label="Last log" k="lastLog" sortKey={sortKey} sortDir={sortDir} onClick={setSort} align="right" />
                  <th style={{ padding: "8px 10px", textAlign: "right" }}>
                    <span className="t-eyebrow">activity</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const accent = statusAccent(p.status);
                  const trend = p.stats?.dailyTrend ?? [];
                  const spark = trend.length > 0 ? trend : [0, 0, 0, 0, 0, 0, 0];
                  return (
                    <tr
                      key={p.name}
                      style={{ borderBottom: "1px solid var(--rule)" }}
                    >
                      <td style={{ padding: "10px 10px" }}>
                        <Link
                          href={`/projects/${encodeURIComponent(p.name)}`}
                          className="inline-flex items-center gap-2 hover:opacity-80"
                        >
                          <span
                            className={`src-dot src-${accent}`}
                            style={{ width: 6, height: 6 }}
                          />
                          <span style={{ color: "var(--fg)", letterSpacing: "-0.005em" }}>
                            {p.name}
                          </span>
                          {p.archived && (
                            <span
                              className="t-mono text-[10px] text-fg-soft"
                              style={{ marginLeft: 4 }}
                            >
                              archived
                            </span>
                          )}
                          {p.repoAutoLinked && (
                            <span
                              className="t-mono text-[10px]"
                              style={{
                                marginLeft: 4,
                                color: "var(--c-github)",
                                opacity: 0.7,
                              }}
                              title={`Auto-linked to ${p.repo}`}
                            >
                              auto
                            </span>
                          )}
                        </Link>
                      </td>
                      <td style={{ padding: "10px 10px", color: "var(--fg-soft)" }}>
                        {p.status ?? "—"}
                      </td>
                      <td
                        className="t-num"
                        style={{ padding: "10px 10px", textAlign: "right" }}
                      >
                        {p.weeklyHours.toFixed(1)}
                      </td>
                      <td
                        className="t-num text-fg-soft"
                        style={{ padding: "10px 10px", textAlign: "right" }}
                      >
                        {p.totalHours.toFixed(1)}
                      </td>
                      <td
                        className="t-num"
                        style={{ padding: "10px 10px", textAlign: "right", color: "var(--c-github)" }}
                      >
                        {p.stats?.recentCommits ?? "—"}
                      </td>
                      <td
                        className="t-mono text-fg-soft"
                        style={{ padding: "10px 10px", textAlign: "right", fontSize: 11 }}
                      >
                        {p.lastLogDate ?? "—"}
                      </td>
                      <td style={{ padding: "10px 10px", textAlign: "right" }}>
                        <Sparkline
                          data={spark}
                          w={72}
                          h={14}
                          tone={`var(--c-${accent})`}
                          title={`commits last ${spark.length}d: ${spark.join(", ")}`}
                        />
                      </td>
                    </tr>
                  );
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-fg-soft" style={{ padding: "16px 10px", fontSize: 12 }}>
                      No projects to show.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </TodFrame>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "1px solid var(--rule)",
  borderRadius: 6,
  padding: "6px 8px",
  color: "var(--fg)",
  outline: 0,
  fontSize: 13,
};

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="t-eyebrow" style={{ color: "var(--fg-soft)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function Th({
  label,
  k,
  sortKey,
  sortDir,
  onClick,
  align,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === k;
  return (
    <th
      style={{
        padding: "8px 10px",
        textAlign: align ?? "left",
        cursor: "pointer",
        userSelect: "none",
      }}
      onClick={() => onClick(k)}
    >
      <span
        className="t-eyebrow"
        style={{ color: active ? "var(--fg)" : "var(--fg-soft)" }}
      >
        {label}
        {active && (
          <span style={{ marginLeft: 4, opacity: 0.7 }}>
            {sortDir === "asc" ? "▲" : "▼"}
          </span>
        )}
      </span>
    </th>
  );
}
