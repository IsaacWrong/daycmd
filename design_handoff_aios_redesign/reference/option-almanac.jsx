// OPTION C · ALMANAC — v2 (tightened)
// Editorial 3-column layout with a stats spine on the left.

function OptionAlmanac({ tod = "afternoon", focus = false, onToggleFocus }) {
  const M = window.MOCK;
  const maxProd = Math.max(...M.usage.productivity);

  return (
    <TodFrame tod={tod} focus={focus} dataLabel="Almanac">
      {/* ── Masthead ───────────────────────────────────────── */}
      <Masthead M={M} tod={tod} />

      {/* ── 3 columns ──────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "300px 1fr 320px",
        gap: 40,
        padding: "20px 48px 116px",
        minHeight: 0,
      }}>
        <LeftSpine M={M} maxProd={maxProd} />
        <CenterColumn M={M} />
        <RightStreams M={M} />
      </div>

      {/* ── Skill strip + Agent bar ──────────────────────── */}
      <AgentDock M={M} focus={focus} onToggleFocus={onToggleFocus} />
    </TodFrame>
  );
}

// ─────────────────────────────────────────────────────────────────
// Masthead — cleaner, useful metadata
// ─────────────────────────────────────────────────────────────────
function Masthead({ M, tod }) {
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
        <div>
          <div style={{ fontSize: 19, fontWeight: 500, letterSpacing: "-0.015em", lineHeight: 1.15 }}>
            {greetingFor(tod, M.user.name)}.
          </div>
          <div className="t-mono" style={{ fontSize: 11, color: "var(--fg-soft)", marginTop: 2 }}>
            {M.today.full} · Week 19 · Day {M.streaks.shipDays} of ship streak
          </div>
        </div>
      </div>

      <span style={{ flex: 1 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, whiteSpace: "nowrap" }}>
        <span className="src-dot src-agent" style={{ marginRight: 0 }} />
        <span style={{ color: "var(--fg)" }}>AI OS</span>
        <span className="t-mono" style={{ color: "var(--fg-soft)" }}>318 runs</span>
      </div>
      <span style={{ width: 1, height: 14, background: "var(--rule)" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, whiteSpace: "nowrap" }}>
        <TodGlyph tod={tod} />
        <span className="t-mono t-num" style={{ color: "var(--fg-soft)" }}>
          {M.weather.temp}° · H{M.weather.high} L{M.weather.low}
        </span>
      </div>
      <span style={{ width: 1, height: 14, background: "var(--rule)" }} />
      <span className="t-mono" style={{ fontSize: 12, color: "var(--fg-soft)", cursor: "pointer" }}>
        settings
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// LEFT SPINE — Focus · numbers · streaks · heatmap · projects
// ─────────────────────────────────────────────────────────────────
function LeftSpine({ M, maxProd }) {
  return (
    <aside className="scroll" style={{
      overflowY: "auto",
      paddingRight: 18,
      borderRight: "1px solid var(--rule)",
    }}>
      <FocusTile M={M} />

      <SectionMini title="Today in numbers">
        <NumberRow label="Tokens"        value={`${(M.usage.todayTokens / 1000).toFixed(1)}k`} delta="+12%" tone="var(--c-agent)" spark={M.usage.tokensByHour} />
        <NumberRow label="Tasks closed"  value="3" sub="of 7 due"  tone="var(--c-tasks)" />
        <NumberRow label="Commits"       value="2" sub="1 repo"    tone="var(--c-github)" delta="−1" deltaTone="dim" />
        <NumberRow label="Inbox cleared" value="11" sub="of 17"    tone="var(--c-gmail)" />
        <NumberRow label="Note words"    value="142" sub="written" tone="var(--c-obsidian)" />
      </SectionMini>

      <SectionMini title="Streaks">
        <StreakBar label="Daily note" value={M.streaks.dailyNote} unit="d" pct={Math.min(M.streaks.dailyNote / 30, 1)} tone="var(--c-obsidian)" />
        <StreakBar label="Ship" value={M.streaks.shipDays} unit="d" pct={Math.min(M.streaks.shipDays / 30, 1)} tone="oklch(0.65 0.13 150)" />
        <StreakBar label="No-snooze" value={6} unit="d" pct={6 / 14} tone="var(--c-agent)" />
      </SectionMini>

      <SectionMini title="Last 14 days · hours">
        <Heatmap data={M.usage.productivity} maxProd={maxProd} />
      </SectionMini>

      <SectionMini title="Projects">
        {M.projects.map(p => <ProjectRow key={p.name} p={p} />)}
      </SectionMini>
    </aside>
  );
}

function FocusTile({ M }) {
  const pct = M.streaks.pomodorosToday / M.streaks.pomodorosGoal;
  return (
    <section style={{ marginBottom: 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span className="t-eyebrow" style={{ color: "var(--c-tasks)" }}>● Focus</span>
        <span style={{ flex: 1 }} />
        <span className="t-mono t-num" style={{ fontSize: 11, color: "var(--fg-soft)" }}>
          {M.streaks.pomodorosToday}/{M.streaks.pomodorosGoal} pomodoros
        </span>
      </div>
      <hr className="hr" style={{ marginBottom: 14 }} />

      <div style={{ marginBottom: 10 }}>
        <div className="t-mono" style={{ fontSize: 10, color: "var(--fg-soft)", marginBottom: 4 }}>WORKING ON</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="src-dot src-tasks" style={{ marginRight: 0 }} />
          <span style={{ fontSize: 15, fontWeight: 500, letterSpacing: "-0.01em" }}>ai-os</span>
          <span className="t-mono" style={{ fontSize: 11, color: "var(--fg-soft)" }}>· redesign sweep</span>
        </div>
      </div>

      {/* Pomodoro pips */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {Array.from({ length: M.streaks.pomodorosGoal }, (_, i) => (
          <div key={i} style={{
            flex: 1, height: 5, borderRadius: 99,
            background: i < M.streaks.pomodorosToday
              ? "var(--c-tasks)"
              : "oklch(from var(--fg) l c h / 0.10)",
          }} />
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button style={{
          flex: 1, cursor: "pointer",
          padding: "9px 12px", fontSize: 12.5, fontWeight: 500,
          background: "var(--c-tasks)", color: "white",
          border: 0, borderRadius: 6,
          fontFamily: "var(--font-sans)",
          letterSpacing: "-0.005em",
        }}>
          ▶ Start 25:00
        </button>
        <button style={{
          cursor: "pointer", fontSize: 12,
          padding: "9px 12px",
          background: "transparent",
          color: "var(--fg-soft)",
          border: 0,
          fontFamily: "var(--font-sans)",
        }}>
          Change…
        </button>
      </div>
    </section>
  );
}

function Heatmap({ data, maxProd }) {
  const weekdays = ["S", "M", "T", "W", "T", "F", "S"];
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
        {weekdays.map((d, i) => (
          <div key={i} className="t-mono" style={{ fontSize: 9, color: "var(--fg-soft)", textAlign: "center" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {data.map((v, i) => (
          <div key={i} title={`${v.toFixed(1)}h`} style={{
            height: 22, borderRadius: 4,
            background: v === 0
              ? "oklch(from var(--fg) l c h / 0.05)"
              : `oklch(from var(--c-tasks) l c h / ${0.12 + (v / maxProd) * 0.55})`,
            border: i === data.length - 1 ? "1px solid oklch(from var(--c-tasks) l c h / 0.5)" : "none",
          }} />
        ))}
      </div>
      <div className="t-mono" style={{ fontSize: 10, color: "var(--fg-soft)", marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Apr 29</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {[0.1, 0.25, 0.45, 0.7].map((a, i) => (
            <span key={i} style={{ width: 8, height: 8, borderRadius: 2, background: `oklch(from var(--c-tasks) l c h / ${a})` }} />
          ))}
        </span>
        <span>today</span>
      </div>
    </div>
  );
}

function ProjectRow({ p }) {
  const week = [2, 0, 4, 3, 1, 5, 9].map(v => v * (p.commits7 / 12 + 0.1));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", fontSize: 13 }}>
      <span className={`src-dot src-${p.accent}`} style={{ marginRight: 0, width: 6, height: 6 }} />
      <span style={{ flex: 1, letterSpacing: "-0.005em" }}>{p.name}</span>
      <Sparkline data={week} w={42} h={14} tone={`var(--c-${p.accent})`} />
      <span className="t-mono t-num" style={{ fontSize: 10, color: "var(--fg-soft)", width: 26, textAlign: "right" }}>{p.weekHours}h</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CENTER COLUMN — Hero + Today + Daily note
// ─────────────────────────────────────────────────────────────────
function CenterColumn({ M }) {
  return (
    <main className="scroll" style={{ overflowY: "auto", paddingRight: 8 }}>
      {/* Hero */}
      <div className="focus-keep" style={{ marginBottom: 28 }}>
        <div className="t-eyebrow" style={{ marginBottom: 10 }}>Now · ends {M.nowBlock.until} · {M.nowBlock.endsIn} left</div>
        <h2 style={{
          margin: "0 0 18px",
          fontSize: 36,
          fontWeight: 500,
          letterSpacing: "-0.025em",
          lineHeight: 1.08,
        }}>
          {M.nowBlock.title}
        </h2>
        <DayStrip M={M} />
      </div>

      <div className="dimmable">
        <Section eyebrow="Today" title="Tasks" count={M.tasks.filter(t => !t.done).length} accent="tasks"
          right={<span className="t-mono" style={{ fontSize: 11, color: "var(--fg-soft)" }}>4 due · 2 later</span>}>
          {M.tasks.slice(0, 5).map(t => <TaskRow key={t.id} t={t} />)}
        </Section>

        <Section eyebrow="Notes" title="Daily" accent="obsidian"
          right={<span className="t-mono" style={{ fontSize: 11, color: "var(--fg-soft)" }}>{M.dailyNote.path} · {M.dailyNote.wordCount} words</span>}>
          <DailyNotePreview lines={M.dailyNote.lines} />
        </Section>
      </div>
    </main>
  );
}

// Horizontal "next ~10 hours" strip with event blocks
function DayStrip({ M }) {
  // Layout: 09 → 22, mark current at ~14:00.
  const startH = 9, endH = 22;
  const span = endH - startH;
  const nowH = 14 + 18 / 60;
  const nowPct = ((nowH - startH) / span) * 100;

  // Hardcoded blocks for visual rhythm
  const blocks = [
    { startH: 9,   endH: 11,    color: "good",    label: "Standup + review" },
    { startH: 12.5,endH: 14.25, color: "tasks",   label: "Deep work — AI OS" },
    { startH: 15.75,endH: 16.25,color: "calendar",label: "1:1 Maya" },
    { startH: 17,  endH: 17.75, color: "good",    label: "Run" },
    { startH: 19.5,endH: 21,    color: "agent",   label: "Dinner — Lila" },
  ];

  return (
    <div>
      <div style={{
        position: "relative",
        height: 36,
        borderRadius: 8,
        background: "oklch(from var(--fg) l c h / 0.04)",
        border: "1px solid var(--rule)",
        overflow: "hidden",
      }}>
        {/* Hour ticks */}
        {Array.from({ length: span + 1 }, (_, i) => (
          <div key={i} style={{
            position: "absolute", top: 0, bottom: 0,
            left: `${(i / span) * 100}%`,
            width: 1,
            background: i % 3 === 0 ? "oklch(from var(--fg) l c h / 0.08)" : "transparent",
          }} />
        ))}

        {/* Event blocks */}
        {blocks.map((b, i) => {
          const left = ((b.startH - startH) / span) * 100;
          const width = ((b.endH - b.startH) / span) * 100;
          return (
            <div key={i} title={b.label} style={{
              position: "absolute",
              top: 6, bottom: 6,
              left: `${left}%`,
              width: `calc(${width}% - 2px)`,
              borderRadius: 4,
              background: `oklch(from var(--c-${b.color}) l c h / 0.30)`,
              borderLeft: `2px solid var(--c-${b.color})`,
              padding: "0 6px",
              display: "flex", alignItems: "center",
              fontSize: 10.5,
              color: "var(--fg)",
              fontWeight: 500,
              letterSpacing: "-0.005em",
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}>{b.label}</div>
          );
        })}

        {/* Now marker */}
        <div style={{
          position: "absolute", top: -3, bottom: -3,
          left: `${nowPct}%`,
          width: 2,
          background: "var(--fg)",
          boxShadow: "0 0 0 3px var(--bg-a)",
        }} />
        <div style={{
          position: "absolute", top: -8,
          left: `calc(${nowPct}% - 4px)`,
          width: 10, height: 10, borderRadius: 99,
          background: "var(--fg)",
          boxShadow: "0 0 0 3px var(--bg-a)",
        }} />
      </div>
      <div className="t-mono" style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "var(--fg-soft)" }}>
        <span>9a</span><span>12p</span><span>3p</span><span>6p</span><span>9p</span>
      </div>
    </div>
  );
}

function DailyNotePreview({ lines }) {
  return (
    <div style={{ paddingLeft: 18, borderLeft: "2px solid var(--rule)" }}>
      {lines.slice(0, 9).map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <div key={i} className="t-mono" style={{ fontSize: 11, color: "var(--fg-soft)", marginTop: i === 0 ? 0 : 12, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {line.slice(3)}
            </div>
          );
        }
        if (line === "") return <div key={i} style={{ height: 6 }} />;
        return (
          <div key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--fg-soft)", letterSpacing: "-0.003em" }}>
            {line}
          </div>
        );
      })}
      <div style={{
        marginTop: 12, paddingTop: 12,
        borderTop: "1px dashed var(--rule)",
        fontSize: 12, color: "var(--fg-soft)",
        display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
      }}>
        Continue writing <Glyph.Arrow s={11} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// RIGHT — Inbox · GitHub · Knowledge · Errors
// ─────────────────────────────────────────────────────────────────
function RightStreams({ M }) {
  return (
    <aside className="dimmable scroll" style={{
      overflowY: "auto",
      paddingLeft: 18,
      borderLeft: "1px solid var(--rule)",
    }}>
      <SectionMini title="Calendar" count={M.calendar.length} accent="calendar">
        {M.calendar.slice(0, 5).map((e, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 12.5 }}>
            <span className="t-mono" style={{ width: 50, color: "var(--fg-soft)", fontSize: 11 }}>{e.time}</span>
            <span className={`src-dot src-${e.color}`} style={{ marginRight: 0, width: 6, height: 6 }} />
            <span style={{ flex: 1, letterSpacing: "-0.005em" }}>{e.label}</span>
          </div>
        ))}
      </SectionMini>

      <SectionMini title="Inbox" count={M.gmail.filter(m => m.unread).length} accent="gmail">
        {M.gmail.slice(0, 5).map((m, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 12.5 }}>
            <span style={{ width: 5, height: 5, borderRadius: 99, background: m.unread ? "var(--c-gmail)" : "transparent", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: m.unread ? "var(--fg)" : "var(--fg-soft)", fontWeight: m.unread ? 500 : 400, fontSize: 12, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.from}</div>
              <div style={{ color: "var(--fg-soft)", fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.005em" }}>{m.subject}</div>
            </div>
            {m.important && <Glyph.Star s={10} c="var(--c-gmail)" fill="var(--c-gmail)" />}
          </div>
        ))}
      </SectionMini>

      <SectionMini title="GitHub" count={M.github.reviewRequested.length + M.github.yourOpen.length} accent="github">
        <div className="t-mono" style={{ fontSize: 9, color: "var(--c-github)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.08em" }}>Review requested</div>
        {M.github.reviewRequested.map(pr => (
          <div key={pr.num} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", fontSize: 12.5 }}>
            <Glyph.Branch s={11} c="var(--c-github)" />
            <span className="t-mono" style={{ color: "var(--fg-soft)", fontSize: 10 }}>#{pr.num}</span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.005em" }}>{pr.title}</span>
          </div>
        ))}
        <div className="t-mono" style={{ fontSize: 9, marginTop: 12, marginBottom: 5, color: "var(--fg-soft)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Yours</div>
        {M.github.yourOpen.map(pr => (
          <div key={pr.num} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", fontSize: 12.5 }}>
            <Glyph.Branch s={11} c="var(--c-github)" />
            <span className="t-mono" style={{ color: "var(--fg-soft)", fontSize: 10 }}>#{pr.num}</span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.005em" }}>{pr.title}</span>
            <span title={pr.checks} style={{ width: 6, height: 6, borderRadius: 99, background: pr.checks === "passing" ? "oklch(0.65 0.13 150)" : "var(--c-error)" }} />
          </div>
        ))}
      </SectionMini>

      <SectionMini title="Knowledge" accent="agent">
        <KbRow path="AI OS / wiki / index" meta="compiled 2h" />
        <KbRow path="Research / output / agentic memory" meta="1d" />
        <KbRow path="Trail / raw / 2026-05-11-onboarding" meta="1d" />
        <KbRow path="Personal / wiki / books-2026" meta="3d" />
      </SectionMini>

      <SectionMini title="Errors" count={M.errors.length} accent="error">
        {M.errors.map((e, i) => (
          <div key={i} style={{ padding: "5px 0", fontSize: 12, lineHeight: 1.45 }}>
            <span className="t-mono" style={{ color: "var(--c-error)", fontSize: 11 }}>{e.tool}</span>
            <span className="t-mono" style={{ float: "right", color: "var(--fg-soft)", fontSize: 11 }}>{e.ago}</span>
            <div style={{ color: "var(--fg-soft)", fontSize: 11.5, marginTop: 2 }}>{e.msg}</div>
          </div>
        ))}
      </SectionMini>
    </aside>
  );
}

function KbRow({ path, meta }) {
  const parts = path.split(" / ");
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6, padding: "5px 0", fontSize: 12 }}>
      <Glyph.Note s={11} c="var(--c-agent)" />
      <span style={{ flex: 1, letterSpacing: "-0.005em" }}>
        <span style={{ color: "var(--fg-soft)" }}>{parts.slice(0, -1).join(" / ")} / </span>
        <span style={{ color: "var(--fg)" }}>{parts[parts.length - 1]}</span>
      </span>
      <span className="t-mono" style={{ fontSize: 10, color: "var(--fg-soft)" }}>{meta}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// AGENT DOCK — skill strip + bar
// ─────────────────────────────────────────────────────────────────
function AgentDock({ M, focus, onToggleFocus }) {
  return (
    <div className="focus-keep" style={{
      position: "absolute",
      left: 48, right: 48, bottom: 22,
      zIndex: 5,
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      {/* Skill chips — plain text + dividers, no pills */}
      <div style={{
        display: "flex", gap: 0, justifyContent: "center", alignItems: "center",
        opacity: focus ? 1 : 0.85,
        transition: "opacity 320ms ease",
        fontSize: 12,
      }}>
        {M.skills.map((s, i) => (
          <React.Fragment key={s.name}>
            {i > 0 && <span style={{ width: 1, height: 11, background: "var(--rule)", margin: "0 14px" }} />}
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "transparent", border: 0, padding: 0,
              fontFamily: "var(--font-sans)", fontSize: 12,
              color: focus ? "var(--fg)" : "var(--fg-soft)",
              cursor: "pointer", letterSpacing: "-0.005em",
            }}>
              {s.name}
              <span className="t-mono" style={{ fontSize: 10, color: "var(--fg-soft)", opacity: 0.7 }}>{s.hot}</span>
            </button>
          </React.Fragment>
        ))}
      </div>

      <AgentBar variant="wide" category="AI OS" focus={focus} onToggleFocus={onToggleFocus} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Shared mini primitives
// ─────────────────────────────────────────────────────────────────
function SectionMini({ title, count, accent, children }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {accent && <span className={`src-dot src-${accent}`} style={{ marginRight: 0, width: 6, height: 6 }} />}
        <span className="t-eyebrow">{title}</span>
        {typeof count === "number" && <span className="t-mono t-num" style={{ fontSize: 10, color: "var(--fg-soft)", marginLeft: "auto" }}>{count}</span>}
      </div>
      <hr className="hr" style={{ marginBottom: 10 }} />
      {children}
    </section>
  );
}

function NumberRow({ label, value, sub, delta, deltaTone, tone, spark }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
      <span style={{ flex: 1, fontSize: 12.5, color: "var(--fg-soft)" }}>{label}</span>
      <span className="t-num" style={{ fontSize: 15, fontWeight: 500, color: tone, letterSpacing: "-0.01em" }}>{value}</span>
      {sub && <span className="t-mono" style={{ fontSize: 10, color: "var(--fg-soft)", width: 48, textAlign: "right" }}>{sub}</span>}
      {delta && (
        <span className="t-mono t-num" style={{
          fontSize: 10,
          color: deltaTone === "dim" ? "var(--fg-soft)" : "oklch(0.65 0.13 150)",
          width: 34, textAlign: "right",
        }}>{delta}</span>
      )}
      {spark && <Sparkline data={spark} w={36} h={14} tone={tone} />}
    </div>
  );
}

function StreakBar({ label, value, unit, pct, tone }) {
  return (
    <div style={{ padding: "6px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ flex: 1, fontSize: 12.5, color: "var(--fg-soft)" }}>{label}</span>
        <span className="t-num" style={{ fontSize: 14, fontWeight: 500, color: tone }}>{value}</span>
        <span className="t-mono" style={{ marginLeft: 4, fontSize: 10, color: "var(--fg-soft)" }}>{unit}</span>
      </div>
      <div style={{ height: 3, borderRadius: 99, background: "oklch(from var(--fg) l c h / 0.08)", overflow: "hidden" }}>
        <div style={{ width: `${pct * 100}%`, height: "100%", background: tone, borderRadius: 99 }} />
      </div>
    </div>
  );
}

window.OptionAlmanac = OptionAlmanac;
