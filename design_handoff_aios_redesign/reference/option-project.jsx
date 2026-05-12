// PROJECT VIEW · trail
// Agent is the workspace (right column).
// Left holds project-scoped tasks, this-repo GitHub, activity.
// Hero band carries Stripe + analytics numbers.

function OptionProject({ tod = "afternoon", focus = false, onToggleFocus, projectKey = "trail" }) {
  const M = window.MOCK;
  const P = M.projectDetail[projectKey];
  if (!P) return null;

  return (
    <TodFrame tod={tod} focus={focus} dataLabel={`Project · ${P.name}`}>
      <ProjectMasthead M={M} P={P} tod={tod} />
      <ProjectHero P={P} />

      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "440px 1fr",
        gap: 40,
        padding: "8px 48px 28px",
        minHeight: 0,
      }}>
        <ProjectLeft P={P} />
        <AgentWorkspace P={P} focus={focus} onToggleFocus={onToggleFocus} />
      </div>
    </TodFrame>
  );
}

// ────────────────────────────────────────────────────────────────
// Masthead — same shape as Almanac with a breadcrumb + back arrow
// ────────────────────────────────────────────────────────────────
function ProjectMasthead({ M, P, tod }) {
  return (
    <div className="dimmable" style={{
      display: "flex", alignItems: "center", gap: 22,
      padding: "22px 48px 18px",
      borderBottom: "1px solid var(--rule)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 8,
          background: "linear-gradient(135deg, var(--c-agent), var(--c-tasks) 80%, var(--c-github))",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: "white", fontWeight: 600, fontSize: 14,
          boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 0.20)",
        }}>◉</span>
        <div className="t-mono" style={{ fontSize: 12, color: "var(--fg-soft)", display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap" }}>
          <span style={{ cursor: "pointer" }}>← AI OS</span>
          <span style={{ opacity: 0.5 }}>/</span>
          <span style={{ cursor: "pointer" }}>projects</span>
          <span style={{ opacity: 0.5 }}>/</span>
          <span style={{ color: "var(--fg)" }}>{P.name}</span>
        </div>
      </div>

      <span style={{ flex: 1 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, whiteSpace: "nowrap" }}>
        <span className={`src-dot src-${P.accent}`} style={{ marginRight: 0 }} />
        <span style={{ color: "var(--fg)" }}>{P.status}</span>
        <span className="t-mono" style={{ color: "var(--fg-soft)" }}>· {P.eta}</span>
      </div>
      <span style={{ width: 1, height: 14, background: "var(--rule)" }} />
      <span className="t-mono" style={{ fontSize: 12, color: "var(--fg-soft)", whiteSpace: "nowrap" }}>
        ship streak {P.shipStreak}d
      </span>
      <span style={{ width: 1, height: 14, background: "var(--rule)" }} />
      <span className="t-mono" style={{ fontSize: 12, color: "var(--fg-soft)", cursor: "pointer" }}>
        settings
      </span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Hero — project name + tagline + numbers row (Stripe + analytics)
// ────────────────────────────────────────────────────────────────
function ProjectHero({ P }) {
  return (
    <div className="dimmable focus-keep" style={{ padding: "26px 48px 18px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 28 }}>
        <div style={{ flex: 1 }}>
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>Project</div>
          <h1 style={{
            margin: 0,
            fontSize: 40,
            fontWeight: 500,
            letterSpacing: "-0.03em",
            lineHeight: 1.0,
            display: "flex", alignItems: "center", gap: 16,
          }}>
            <span className={`src-dot src-${P.accent}`} style={{ marginRight: 0, width: 14, height: 14 }} />
            {P.name}
          </h1>
          <div style={{ color: "var(--fg-soft)", fontSize: 14, marginTop: 10, letterSpacing: "-0.005em" }}>
            {P.subtitle}
          </div>
        </div>

        <HeroStats P={P} />
      </div>
    </div>
  );
}

function HeroStats({ P }) {
  const cells = [
    { label: "MRR",          value: `$${P.stripe.mrr.toLocaleString()}`, delta: P.stripe.mrrDelta, tone: "var(--c-good, oklch(0.65 0.13 150))", trend: P.stripe.mrrTrend, source: "stripe" },
    { label: "Subscribers",  value: P.stripe.subscribers,               delta: P.stripe.subscribersDelta, tone: "var(--c-good, oklch(0.65 0.13 150))", source: "stripe" },
    { label: "DAU",          value: P.analytics.dau,                    delta: P.analytics.dauDelta, tone: "var(--c-calendar)", trend: P.analytics.dauTrend, source: "analytics" },
    { label: "Retention D7", value: `${P.analytics.retentionD7}%`,      tone: "var(--c-calendar)", source: "analytics" },
    { label: "Crash-free",   value: `${P.analytics.crashFree}%`,        tone: "var(--c-tasks)" },
    { label: "Week hours",   value: `${P.weekHours}h`,                  tone: "var(--c-agent)" },
  ];
  return (
    <div style={{
      display: "flex",
      alignItems: "stretch",
      flexWrap: "nowrap",
      borderTop: "1px solid var(--rule)",
      borderBottom: "1px solid var(--rule)",
      padding: "14px 0",
    }}>
      {cells.map((c, i) => (
        <React.Fragment key={c.label}>
          {i > 0 && <div style={{ width: 1, background: "var(--rule)", margin: "0 18px", flexShrink: 0 }} />}
          <div style={{ minWidth: 0, whiteSpace: "nowrap" }}>
            <div className="t-eyebrow" style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              {c.source && <span style={{ fontSize: 9, color: "var(--fg-soft)", opacity: 0.7 }}>{c.source}</span>}
              {!c.source && c.label}
              {c.source && <span style={{ opacity: 0.4 }}>·</span>}
              {c.source && <span>{c.label}</span>}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span className="t-num" style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", color: c.tone }}>{c.value}</span>
              {c.delta && <span className="t-mono t-num" style={{ fontSize: 11, color: "oklch(0.65 0.13 150)" }}>{c.delta}</span>}
            </div>
            {c.trend && (
              <div style={{ marginTop: 4 }}>
                <Sparkline data={c.trend} w={80} h={14} tone={c.tone} />
              </div>
            )}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// LEFT — Tasks · GitHub · Activity
// ────────────────────────────────────────────────────────────────
function ProjectLeft({ P }) {
  return (
    <aside className="dimmable scroll" style={{
      overflowY: "auto", paddingRight: 18,
      borderRight: "1px solid var(--rule)",
    }}>
      <PSection title="Tasks" count={P.tasks.filter(t => !t.done).length} accent="tasks">
        {P.tasks.map(t => <TaskRow key={t.id} t={t} />)}
      </PSection>

      <PSection title="GitHub" accent="github" right={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: P.github.ci === "passing" ? "oklch(0.65 0.13 150)" : "var(--c-error)" }} />
          <span className="t-mono" style={{ fontSize: 10, color: "var(--fg-soft)" }}>
            CI {P.github.ci} · {P.github.openPRs} PR · {P.github.openIssues} issues
          </span>
        </span>
      }>
        <div className="t-mono" style={{ fontSize: 9, color: "var(--c-github)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.08em" }}>Pulls</div>
        {P.github.pulls.map(pr => (
          <div key={pr.num} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 13 }}>
            <Glyph.Branch s={12} c="var(--c-github)" />
            <span className="t-mono" style={{ color: "var(--fg-soft)", fontSize: 11 }}>#{pr.num}</span>
            <span style={{ flex: 1, letterSpacing: "-0.005em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pr.title}</span>
            {pr.status === "review-requested" && <span className="t-mono" style={{ fontSize: 10, color: "var(--c-github)" }}>review</span>}
            {pr.status === "yours-checks-failing" && <span className="t-mono" style={{ fontSize: 10, color: "var(--c-error)" }}>failing</span>}
            <span className="t-mono t-num" style={{ fontSize: 10, color: "var(--fg-soft)", width: 30, textAlign: "right" }}>{pr.ago}</span>
          </div>
        ))}

        <div className="t-mono" style={{ fontSize: 9, marginTop: 12, marginBottom: 5, color: "var(--fg-soft)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Issues</div>
        {P.github.issues.map(it => (
          <div key={it.num} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 99, border: "1.4px solid var(--c-good, oklch(0.65 0.13 150))", flexShrink: 0 }} />
            <span className="t-mono" style={{ color: "var(--fg-soft)", fontSize: 11 }}>#{it.num}</span>
            <span style={{ flex: 1, letterSpacing: "-0.005em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</span>
            {it.labels.map(l => (
              <span key={l} className="t-mono" style={{
                fontSize: 10,
                color: l === "P0" ? "var(--c-error)" : "var(--fg-soft)",
                letterSpacing: "0.04em",
              }}>{l}</span>
            ))}
            <span className="t-mono t-num" style={{ fontSize: 10, color: "var(--fg-soft)", width: 26, textAlign: "right" }}>{it.ago}</span>
          </div>
        ))}

        <div className="t-mono" style={{ fontSize: 9, marginTop: 12, marginBottom: 5, color: "var(--fg-soft)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Commits</div>
        {P.github.commits.map(c => (
          <div key={c.sha} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12.5 }}>
            <span className="t-mono" style={{ color: "var(--fg-soft)", fontSize: 10 }}>{c.sha.slice(0, 7)}</span>
            <span style={{ flex: 1, letterSpacing: "-0.005em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.msg}</span>
            <span className="t-mono" style={{ fontSize: 10, color: "var(--fg-soft)" }}>{c.author}</span>
            <span className="t-mono t-num" style={{ fontSize: 10, color: "var(--fg-soft)", width: 26, textAlign: "right" }}>{c.ago}</span>
          </div>
        ))}
      </PSection>

      <PSection title="Activity">
        {P.activity.map((a, i) => (
          <ActivityRow key={i} a={a} />
        ))}
      </PSection>
    </aside>
  );
}

function ActivityRow({ a }) {
  const tone = {
    github:    "var(--c-github)",
    stripe:    "oklch(0.65 0.13 150)",
    agent:     "var(--c-agent)",
    analytics: "var(--c-calendar)",
  }[a.kind] || "var(--fg-soft)";
  const glyph = {
    github:    <Glyph.Branch   s={11} c={tone} />,
    stripe:    <span className="t-mono" style={{ color: tone, fontSize: 11, fontWeight: 600 }}>$</span>,
    agent:     <span style={{ color: tone, fontSize: 11 }}>✦</span>,
    analytics: <Glyph.Spark    s={11} c={tone} />,
  }[a.kind];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", fontSize: 12.5 }}>
      <span style={{ width: 14, display: "inline-flex", justifyContent: "center" }}>{glyph}</span>
      <span style={{ flex: 1, color: "var(--fg-soft)", letterSpacing: "-0.005em" }}>
        <span style={{ color: "var(--fg)" }}>{a.text}</span>
      </span>
      <span className="t-mono t-num" style={{ fontSize: 10, color: "var(--fg-soft)" }}>{a.ago}</span>
    </div>
  );
}

function PSection({ title, count, accent, right, children }) {
  return (
    <section style={{ marginBottom: 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {accent && <span className={`src-dot src-${accent}`} style={{ marginRight: 0, width: 6, height: 6 }} />}
        <span className="t-eyebrow">{title}</span>
        {typeof count === "number" && <span className="t-mono t-num" style={{ fontSize: 10, color: "var(--fg-soft)" }}>{count}</span>}
        <span style={{ flex: 1 }} />
        {right}
      </div>
      <hr className="hr" style={{ marginBottom: 10 }} />
      {children}
    </section>
  );
}

// ────────────────────────────────────────────────────────────────
// RIGHT — Agent workspace (skills + thread + input)
// ────────────────────────────────────────────────────────────────
function AgentWorkspace({ P, focus, onToggleFocus }) {
  return (
    <main className="focus-keep" style={{
      display: "flex", flexDirection: "column",
      paddingLeft: 18,
      minHeight: 0,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span className="src-dot src-agent" style={{ marginRight: 0, width: 6, height: 6 }} />
        <span className="t-eyebrow">Agent · {P.name}</span>
        <span className="t-mono" style={{ fontSize: 10, color: "var(--fg-soft)", marginLeft: 8 }}>claude opus 4.7 · 142 runs in this thread</span>
        <span style={{ flex: 1 }} />
        <button onClick={onToggleFocus} style={{
          background: "transparent", border: 0, padding: "2px 6px",
          color: focus ? "var(--c-agent)" : "var(--fg-soft)",
          fontFamily: "var(--font-sans)", fontSize: 11.5,
          cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
        }}>
          <Glyph.Sun s={11} /> Focus mode {focus ? "on" : "off"}
        </button>
      </div>

      {/* Per-project skills strip — clean text + dividers */}
      <div style={{
        display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap",
        padding: "10px 0",
        borderTop: "1px solid var(--rule)",
        borderBottom: "1px solid var(--rule)",
        marginBottom: 16,
        fontSize: 12,
      }}>
        {P.skills.map((s, i) => (
          <React.Fragment key={s.name}>
            {i > 0 && <span style={{ width: 1, height: 11, background: "var(--rule)", margin: "0 14px", flexShrink: 0 }} />}
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "transparent", border: 0, padding: 0,
              fontFamily: "var(--font-sans)", fontSize: 12,
              color: "var(--fg-soft)",
              cursor: "pointer", letterSpacing: "-0.005em",
              whiteSpace: "nowrap", flexShrink: 0,
            }}>
              {s.name}
              <span className="t-mono" style={{ fontSize: 10, opacity: 0.6 }}>{s.hot}</span>
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Thread (scrolls) */}
      <div className="scroll" style={{
        flex: 1, minHeight: 0, overflowY: "auto",
        paddingRight: 4,
        display: "flex", flexDirection: "column", gap: 18,
      }}>
        {P.thread.map((m, i) => <ThreadMessage key={i} m={m} />)}
      </div>

      {/* Input — only remaining glass surface */}
      <div style={{ marginTop: 14 }}>
        <div className="glass" style={{
          padding: "12px 16px",
          borderRadius: 14,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{
            width: 22, height: 22, borderRadius: 99,
            background: "linear-gradient(135deg, var(--c-agent), oklch(0.65 0.16 35))",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: 11,
          }}>✦</span>
          <input style={{
            flex: 1, background: "transparent", border: 0, outline: 0,
            fontFamily: "var(--font-sans)", fontSize: 14.5, color: "var(--fg)",
            letterSpacing: "-0.005em",
          }} placeholder={`Ask Claude about ${P.name}, or run a skill above…`} />
          <button style={{
            background: "transparent", border: 0, padding: 0,
            color: "var(--fg-soft)", cursor: "pointer",
            display: "inline-flex", alignItems: "center",
          }}><Glyph.Paperclip s={14} /></button>
          <span className="t-mono" style={{ fontSize: 10, color: "var(--fg-soft)", border: "1px solid var(--rule)", borderRadius: 4, padding: "1px 5px" }}>⌘J</span>
        </div>
        <div className="t-mono" style={{ marginTop: 6, fontSize: 10, color: "var(--fg-soft)", display: "flex", justifyContent: "space-between" }}>
          <span>thread auto-logs to <span style={{ color: "var(--fg)" }}>Categories/{P.name}/raw/</span></span>
          <span>$0.34 in this thread</span>
        </div>
      </div>
    </main>
  );
}

function ThreadMessage({ m }) {
  const isYou = m.who === "you";
  return (
    <div>
      <div className="t-mono" style={{
        fontSize: 10,
        color: isYou ? "var(--c-agent)" : "var(--fg-soft)",
        marginBottom: 6,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}>
        {isYou ? "you" : "claude"} · {m.at}
      </div>
      <div style={{
        fontSize: 14.5,
        lineHeight: 1.55,
        color: "var(--fg)",
        letterSpacing: "-0.005em",
        textWrap: "pretty",
      }}>{m.text}</div>

      {m.attachments && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
          {m.attachments.map((a, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              fontSize: 12.5, color: "var(--fg-soft)",
              padding: "6px 10px",
              borderLeft: `2px solid ${a.kind === "pr" ? "var(--c-github)" : "var(--c-error)"}`,
              background: "oklch(from var(--fg) l c h / 0.03)",
              cursor: "pointer",
            }}>
              {a.kind === "pr" ? <Glyph.Branch s={11} c="var(--c-github)" /> : <span style={{ color: "var(--c-error)" }}>●</span>}
              <span style={{ letterSpacing: "-0.005em" }}>{a.label}</span>
              <span style={{ flex: 1 }} />
              <Glyph.Arrow s={11} c="var(--fg-soft)" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

window.OptionProject = OptionProject;
