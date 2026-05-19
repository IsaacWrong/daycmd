"use client";

import Link from "next/link";
import { usePoll } from "@/lib/hooks";
import { ProjectTimer } from "./ProjectTimer";

type ProjectDTO = {
  name: string;
  frontmatter: {
    status?: string;
    next?: string;
    repo?: string;
    url?: string;
  };
};

type BlockersResp = { line: string | null; cached?: boolean; error?: string };

export function ProjectMasthead({ name }: { name: string }) {
  const { data } = usePoll<ProjectDTO>(
    `/api/projects/${encodeURIComponent(name)}`,
    60_000,
  );
  const blockers = usePoll<BlockersResp>(
    `/api/micro/project-blockers?name=${encodeURIComponent(name)}`,
    30 * 60_000,
  ).data;
  const status = data?.frontmatter.status ?? "—";
  const next = data?.frontmatter.next;

  return (
    <div
      className="dimmable"
      style={{
        padding: "22px 48px 14px",
        borderBottom: "1px solid var(--rule)",
      }}
    >
      <div className="flex items-center gap-[22px]">
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
            <Link href="/projects" className="hover:text-fg">
              projects
            </Link>
            <span style={{ opacity: 0.5 }}>/</span>
            <span style={{ color: "var(--fg)" }}>{name}</span>
          </div>
        </div>

        <span className="flex-1" />

        <ProjectTimer name={name} />
        <span
          style={{ width: 1, height: 14, background: "var(--rule)", flexShrink: 0 }}
        />

        <div
          className="flex items-center gap-2"
          style={{ fontSize: 12, whiteSpace: "nowrap" }}
        >
          <span className="src-dot src-good" />
          <span style={{ color: "var(--fg)" }}>{status}</span>
          {next && (
            <span className="t-mono text-fg-soft" style={{ marginLeft: 4 }}>
              · {next}
            </span>
          )}
        </div>
        <span
          style={{ width: 1, height: 14, background: "var(--rule)", flexShrink: 0 }}
        />
        <Link
          href="/settings"
          className="t-mono text-fg-soft hover:text-fg"
          style={{ fontSize: 12, whiteSpace: "nowrap" }}
        >
          settings
        </Link>
      </div>

      {blockers?.line && (
        <div
          style={{
            marginTop: 10,
            paddingLeft: 42,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ color: "var(--c-agent)", fontSize: 12 }}>✦</span>
          <span
            className="text-fg-soft"
            style={{
              fontSize: 12,
              letterSpacing: "-0.003em",
              lineHeight: 1.4,
            }}
          >
            {blockers.line}
          </span>
        </div>
      )}
    </div>
  );
}
