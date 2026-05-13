"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFocusMode, useTod, TodFrame } from "@/components/redesign/TodFrame";
import { usePoll } from "@/lib/hooks";
import { Section, type SourceAccent } from "@/components/redesign/Section";
import { Sparkline } from "@/components/redesign/Sparkline";

type ProjectRow = {
  name: string;
  status: string | null;
  archived: boolean;
  started: string | null;
  repo: string | null;
  url: string | null;
  next: string | null;
  weeklyHours: number;
  totalHours: number;
  lastLogDate: string | null;
  logCount: number;
  stats: {
    weeklyCommits: number;
    openPRs: number;
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
    commitsWeekTotal: number;
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
  const { data, error } = usePoll<Overview>("/api/projects/overview", 60_000);
  const [showArchived, setShowArchived] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("weeklyHours");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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
            return r.stats?.weeklyCommits ?? 0;
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

        <Section eyebrow="overview" title="All projects">
          <div
            className="grid gap-3 mb-6"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}
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
              label="Commits / wk"
              value={String(totals?.commitsWeekTotal ?? 0)}
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

        <Section eyebrow="detail" title="Projects">
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
                  <Th label="Commits / wk" k="commits" sortKey={sortKey} sortDir={sortDir} onClick={setSort} align="right" />
                  <Th label="Last log" k="lastLog" sortKey={sortKey} sortDir={sortDir} onClick={setSort} align="right" />
                  <th style={{ padding: "8px 10px", textAlign: "right" }}>
                    <span className="t-eyebrow">activity</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const accent = statusAccent(p.status);
                  const commits = p.stats?.weeklyCommits ?? 0;
                  const spark = [2, 0, 4, 3, 1, 5, 9].map(
                    (v) => v * (commits / 12 + 0.1),
                  );
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
                        {p.stats?.weeklyCommits ?? "—"}
                      </td>
                      <td
                        className="t-mono text-fg-soft"
                        style={{ padding: "10px 10px", textAlign: "right", fontSize: 11 }}
                      >
                        {p.lastLogDate ?? "—"}
                      </td>
                      <td style={{ padding: "10px 10px", textAlign: "right" }}>
                        <Sparkline data={spark} w={56} h={14} tone={`var(--c-${accent})`} />
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
