"use client";

import Link from "next/link";
import { usePoll } from "@/lib/hooks";

type ProjectDTO = {
  name: string;
  frontmatter: {
    status?: string;
    next?: string;
    repo?: string;
    url?: string;
  };
};

export function ProjectMasthead({ name }: { name: string }) {
  const { data } = usePoll<ProjectDTO>(
    `/api/projects/${encodeURIComponent(name)}`,
    60_000,
  );
  const status = data?.frontmatter.status ?? "—";
  const next = data?.frontmatter.next;

  return (
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
            ← AI OS
          </Link>
          <span style={{ opacity: 0.5 }}>/</span>
          <span>projects</span>
          <span style={{ opacity: 0.5 }}>/</span>
          <span style={{ color: "var(--fg)" }}>{name}</span>
        </div>
      </div>

      <span className="flex-1" />

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
  );
}
