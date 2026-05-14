"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { usePoll } from "@/lib/hooks";
import type { GhSummary, RepoStats } from "@/lib/github";
import { Branch, Spark } from "../Glyph";
import { SectionMini } from "../Section";
import { TaskList } from "../TaskList";

type ProjectDTO = {
  name: string;
  frontmatter: { repo?: string };
  stats?: RepoStats | null;
};

type ProjectsResp = {
  projects: Array<{
    name: string;
    repo: string | null;
    stats: RepoStats | null;
  }>;
};

type ActivityItem = {
  kind: "github" | "stripe" | "agent" | "analytics";
  text: string;
  at: string;
  url?: string;
};

function ago(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatDistanceToNowStrict(d).replace(
    /\s+(seconds?|minutes?|hours?|days?|months?|years?)/,
    (_m, u: string) => u[0],
  );
}

function ProjectGitHub({ name, repo }: { name: string; repo: string | null }) {
  const gh = usePoll<GhSummary | { error: string }>("/api/github", 60_000).data;
  const projects = usePoll<ProjectsResp>("/api/projects", 60_000).data;
  const stats = projects?.projects.find((p) => p.name === name)?.stats;

  const allPulls =
    gh && !("error" in gh) ? [...gh.authored, ...gh.reviewRequested] : [];
  const pulls = repo
    ? allPulls.filter((p) => p.repo === repo).slice(0, 5)
    : [];

  return (
    <SectionMini
      title="GitHub"
      accent="github"
      right={
        stats ? (
          <span
            className="inline-flex items-center gap-1.5 ml-auto"
            style={{ flexShrink: 0 }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 99,
                background: stats.error ? "var(--c-error)" : "var(--c-good)",
              }}
            />
            <span className="t-mono" style={{ fontSize: 10, color: "var(--fg-soft)" }}>
              {stats.recentCommits} commits · {stats.openPRs} PR
            </span>
          </span>
        ) : null
      }
    >
      {pulls.length > 0 && (
        <>
          <div
            className="t-mono uppercase mb-1.5"
            style={{
              fontSize: 9,
              color: "var(--c-github)",
              letterSpacing: "0.08em",
            }}
          >
            Pulls
          </div>
          {pulls.map((pr) => (
            <a
              key={pr.id}
              href={pr.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 py-1 text-[13px] hover:opacity-80"
            >
              <Branch s={12} c="var(--c-github)" />
              <span
                className="t-mono"
                style={{ color: "var(--fg-soft)", fontSize: 11 }}
              >
                #{pr.number}
              </span>
              <span
                className="flex-1 truncate"
                style={{ letterSpacing: "-0.005em" }}
              >
                {pr.title}
              </span>
              <span className="t-mono" style={{ fontSize: 10, color: "var(--fg-soft)" }}>
                {ago(pr.updatedAt)}
              </span>
            </a>
          ))}
        </>
      )}
      {stats?.lastCommit && (
        <>
          <div
            className="t-mono uppercase mt-3 mb-1.5 text-fg-soft"
            style={{ fontSize: 9, letterSpacing: "0.08em" }}
          >
            Latest commit
          </div>
          <a
            href={stats.lastCommit.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 py-1 text-[12.5px] hover:opacity-80"
          >
            <span className="t-mono" style={{ color: "var(--fg-soft)", fontSize: 10 }}>
              {stats.lastCommit.sha}
            </span>
            <span className="flex-1 truncate" style={{ letterSpacing: "-0.005em" }}>
              {stats.lastCommit.message}
            </span>
            <span className="t-mono" style={{ fontSize: 10, color: "var(--fg-soft)" }}>
              {ago(stats.lastCommit.date)}
            </span>
          </a>
        </>
      )}
      {!repo && (
        <p className="text-[12px] text-fg-soft py-1">
          Set <code>repo:</code> in this project&apos;s frontmatter to wire GitHub.
        </p>
      )}
    </SectionMini>
  );
}

function ActivityRow({ a }: { a: ActivityItem }) {
  const tone =
    a.kind === "github"
      ? "var(--c-github)"
      : a.kind === "stripe"
        ? "var(--c-good)"
        : a.kind === "agent"
          ? "var(--c-agent)"
          : "var(--c-calendar)";
  const glyph =
    a.kind === "github" ? (
      <Branch s={11} c={tone} />
    ) : a.kind === "stripe" ? (
      <span
        className="t-mono"
        style={{ color: tone, fontSize: 11, fontWeight: 600 }}
      >
        $
      </span>
    ) : a.kind === "agent" ? (
      <span style={{ color: tone, fontSize: 11 }}>✦</span>
    ) : (
      <Spark s={11} c={tone} />
    );
  const Inner = (
    <>
      <span
        className="inline-flex justify-center"
        style={{ width: 14, flexShrink: 0 }}
      >
        {glyph}
      </span>
      <span className="flex-1 text-fg" style={{ letterSpacing: "-0.005em" }}>
        {a.text}
      </span>
      <span className="t-mono t-num text-fg-soft" style={{ fontSize: 10 }}>
        {ago(a.at)}
      </span>
    </>
  );
  return a.url ? (
    <a
      href={a.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2.5 py-1 text-[12.5px] hover:opacity-80"
    >
      {Inner}
    </a>
  ) : (
    <div className="flex items-center gap-2.5 py-1 text-[12.5px]">{Inner}</div>
  );
}

export function ProjectLeft({ name }: { name: string }) {
  const project = usePoll<ProjectDTO>(
    `/api/projects/${encodeURIComponent(name)}`,
    60_000,
  ).data;
  const activity = usePoll<{ items: ActivityItem[] }>(
    `/api/projects/${encodeURIComponent(name)}/activity`,
    60_000,
  ).data;
  const repo = project?.frontmatter.repo ?? null;

  return (
    <aside
      className="dimmable scroll"
      style={{
        overflowY: "auto",
        paddingRight: 18,
        borderRight: "1px solid var(--rule)",
      }}
    >
      <TaskList projectFilter={name} />
      <ProjectGitHub name={name} repo={repo} />
      <SectionMini title="Activity">
        {(activity?.items ?? []).map((a, i) => (
          <ActivityRow key={i} a={a} />
        ))}
        {(!activity || activity.items.length === 0) && (
          <p className="text-[12px] text-fg-soft py-1">No activity yet.</p>
        )}
      </SectionMini>
    </aside>
  );
}
