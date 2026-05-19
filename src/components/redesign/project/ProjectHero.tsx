"use client";

import { Fragment } from "react";
import { usePoll } from "@/lib/hooks";
import { Sparkline } from "../Sparkline";

type NarrativeResp = { narrative: string | null; cached?: boolean; error?: string };

type ProjectDTO = {
  name: string;
  weeklyHours: number;
  frontmatter: {
    description?: string;
    subtitle?: string;
    status?: string;
  };
};

type Stripe = {
  mrr: number;
  mrrDelta: string;
  subscribers: number;
  subscribersDelta: string;
  mrrTrend: number[];
};

type Analytics = {
  dau: number;
  dauDelta: string;
  retentionD7: number;
  crashFree: number;
  dauTrend: number[];
};

export function ProjectHero({ name }: { name: string }) {
  const project = usePoll<ProjectDTO>(
    `/api/projects/${encodeURIComponent(name)}`,
    60_000,
  ).data;
  const stripe = usePoll<Stripe>(
    `/api/projects/${encodeURIComponent(name)}/stripe`,
    5 * 60_000,
  ).data;
  const analytics = usePoll<Analytics>(
    `/api/projects/${encodeURIComponent(name)}/analytics`,
    5 * 60_000,
  ).data;
  const narrative = usePoll<NarrativeResp>(
    `/api/micro/project-narrative?name=${encodeURIComponent(name)}`,
    6 * 3600_000,
  ).data;

  const subtitle =
    project?.frontmatter.subtitle ??
    project?.frontmatter.description ??
    "—";
  const weekHours = project?.weeklyHours ?? 0;

  const cells: Array<{
    source?: string;
    label: string;
    value: string;
    delta?: string;
    tone: string;
    trend?: number[];
  }> = [
    stripe && {
      source: "stripe",
      label: "MRR",
      value: `$${stripe.mrr.toLocaleString()}`,
      delta: stripe.mrrDelta,
      tone: "var(--c-good)",
      trend: stripe.mrrTrend,
    },
    stripe && {
      source: "stripe",
      label: "Subscribers",
      value: String(stripe.subscribers),
      delta: stripe.subscribersDelta,
      tone: "var(--c-good)",
    },
    analytics && {
      source: "analytics",
      label: "DAU",
      value: String(analytics.dau),
      delta: analytics.dauDelta,
      tone: "var(--c-calendar)",
      trend: analytics.dauTrend,
    },
    analytics && {
      source: "analytics",
      label: "Retention D7",
      value: `${analytics.retentionD7}%`,
      tone: "var(--c-calendar)",
    },
    analytics && {
      source: "analytics",
      label: "Crash-free",
      value: `${analytics.crashFree}%`,
      tone: "var(--c-tasks)",
    },
    {
      label: "Week hours",
      value: `${weekHours.toFixed(1)}h`,
      tone: "var(--c-agent)",
    },
  ].filter(Boolean) as typeof cells;

  return (
    <div className="dimmable focus-keep" style={{ padding: "26px 48px 18px" }}>
      <div className="flex items-end gap-7">
        <div className="flex-1">
          <div className="t-eyebrow mb-2">Project</div>
          <h1
            className="m-0 flex items-center"
            style={{
              fontSize: 40,
              fontWeight: 500,
              letterSpacing: "-0.03em",
              lineHeight: 1.0,
              gap: 16,
            }}
          >
            <span
              className="src-dot src-good"
              style={{ width: 14, height: 14 }}
            />
            {name}
          </h1>
          <div
            className="text-fg-soft mt-2.5"
            style={{ fontSize: 14, letterSpacing: "-0.005em" }}
          >
            {subtitle}
          </div>
        </div>

        <div
          className="flex items-stretch flex-nowrap"
          style={{
            borderTop: "1px solid var(--rule)",
            borderBottom: "1px solid var(--rule)",
            padding: "14px 0",
          }}
        >
          {cells.map((c, i) => (
            <Fragment key={`${c.source ?? ""}${c.label}`}>
              {i > 0 && (
                <div
                  style={{
                    width: 1,
                    background: "var(--rule)",
                    margin: "0 18px",
                    flexShrink: 0,
                  }}
                />
              )}
              <div style={{ minWidth: 0, whiteSpace: "nowrap" }}>
                <div
                  className="t-eyebrow mb-1.5 flex items-center gap-1.5"
                >
                  {c.source && (
                    <span style={{ fontSize: 9, color: "var(--fg-soft)", opacity: 0.7 }}>
                      {c.source}
                    </span>
                  )}
                  {c.source && <span style={{ opacity: 0.4 }}>·</span>}
                  <span>{c.label}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="t-num font-medium"
                    style={{
                      fontSize: 22,
                      letterSpacing: "-0.02em",
                      color: c.tone,
                    }}
                  >
                    {c.value}
                  </span>
                  {c.delta && (
                    <span
                      className="t-mono t-num"
                      style={{ fontSize: 11, color: "var(--c-good)" }}
                    >
                      {c.delta}
                    </span>
                  )}
                </div>
                {c.trend && (
                  <div className="mt-1">
                    <Sparkline data={c.trend} w={80} h={14} tone={c.tone} />
                  </div>
                )}
              </div>
            </Fragment>
          ))}
        </div>
      </div>
      {narrative?.narrative && (
        <div
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: "1px solid var(--rule)",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <span
            style={{
              color: "var(--c-agent)",
              fontSize: 13,
              lineHeight: 1.4,
              flexShrink: 0,
            }}
          >
            ✦
          </span>
          <p
            className="text-fg-soft"
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              letterSpacing: "-0.003em",
              margin: 0,
            }}
          >
            {narrative.narrative}
          </p>
        </div>
      )}
    </div>
  );
}
