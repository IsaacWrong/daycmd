// Shared atoms used across all three options.
// Icons are simple generic glyphs (envelope, branch, calendar grid) — not brand marks.

const { useState, useEffect, useRef } = React;

// ─── Time-of-day frame ───────────────────────────────────────────
function TodFrame({ tod = "afternoon", focus = false, dataLabel, children, style }) {
  return (
    <div
      className={`aios-frame tod-${tod} ${focus ? "focus" : ""}`}
      data-screen-label={dataLabel}
      style={style}
    >
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <div className="grain" />
      <div className="surface">{children}</div>
    </div>
  );
}

// ─── Generic SVG glyphs (no brand marks) ─────────────────────────
const Glyph = {
  Envelope: ({ s = 14, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.4">
      <rect x="1.6" y="3.4" width="12.8" height="9.2" rx="1.6" />
      <path d="M2 4l6 4.4 6-4.4" />
    </svg>
  ),
  Branch: ({ s = 14, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.4">
      <circle cx="4" cy="3.5" r="1.5" /><circle cx="4" cy="12.5" r="1.5" /><circle cx="12" cy="6.5" r="1.5" />
      <path d="M4 5v6M4 9c0-2 2-3 4-3h2" />
    </svg>
  ),
  Calendar: ({ s = 14, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.4">
      <rect x="2" y="3.5" width="12" height="10.5" rx="1.6" />
      <path d="M2 6.5h12M5 2v3M11 2v3" />
    </svg>
  ),
  Check: ({ s = 14, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="12" height="12" rx="3" />
    </svg>
  ),
  Note: ({ s = 14, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.4">
      <path d="M3.4 2.4h6L13 6v7.4a.6.6 0 0 1-.6.6H3.4a.6.6 0 0 1-.6-.6V3a.6.6 0 0 1 .6-.6z" />
      <path d="M9.4 2.4V6H13" /><path d="M5.6 9h5M5.6 11h3" />
    </svg>
  ),
  Spark: ({ s = 14, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v3M8 11v3M2 8h3M11 8h3M3.8 3.8l2.1 2.1M10.1 10.1l2.1 2.1M3.8 12.2l2.1-2.1M10.1 5.9l2.1-2.1" />
    </svg>
  ),
  Sun: ({ s = 14, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.4">
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" strokeLinecap="round" />
    </svg>
  ),
  Cmd: ({ s = 12, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.4">
      <path d="M5 5h6v6H5z" />
      <path d="M5 5a2 2 0 1 1-2 2h2zM11 5a2 2 0 1 0 2 2h-2zM5 11a2 2 0 1 1-2-2h2zM11 11a2 2 0 1 0 2-2h-2z" />
    </svg>
  ),
  Arrow: ({ s = 12, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  ),
  Plus: ({ s = 12, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  ),
  Paperclip: ({ s = 12, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.5 7.5L7 12a3 3 0 1 1-4.2-4.2l5.4-5.4a2 2 0 0 1 2.8 2.8L5.6 10.6a1 1 0 1 1-1.4-1.4l4.8-4.8" />
    </svg>
  ),
  Star: ({ s = 12, c = "currentColor", fill = "none" }) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill={fill} stroke={c} strokeWidth="1.4" strokeLinejoin="round">
      <path d="M8 1.8l1.95 4 4.4.64-3.18 3.1.75 4.38L8 11.85 4.08 13.92l.75-4.38L1.65 6.44l4.4-.64z" />
    </svg>
  ),
};

// ─── Sparkline ───────────────────────────────────────────────────
function Sparkline({ data, w = 60, h = 18, tone = "var(--fg)" }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data, 1);
  const stepX = w / (data.length - 1 || 1);
  const pts = data.map((v, i) => [i * stepX, h - (v / max) * h * 0.9 - 1]);
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join("");
  const area = `${path} L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} style={{ "--c-tone": tone, display: "block" }}>
      <path d={area} className="spark-fill" />
      <path d={path} className="spark-stroke" />
    </svg>
  );
}

// ─── Time-of-day glyph ──────────────────────────────────────────
function TodGlyph({ tod }) {
  const map = {
    dawn: "🌅", morning: "🌤", noon: "☀", afternoon: "🌤",
    dusk: "🌇", night: "🌙", deep: "🌙",
  };
  return <span style={{ fontSize: 14, opacity: 0.85 }}>{map[tod] || "🌤"}</span>;
}

// ─── Greeting (time-of-day aware) ───────────────────────────────
function greetingFor(tod, name) {
  const verb = ({
    dawn: "Morning", morning: "Morning", noon: "Afternoon",
    afternoon: "Afternoon", dusk: "Evening", night: "Evening", deep: "Up late",
  })[tod] || "Hi";
  return `${verb}, ${name}`;
}

// ─── Agent Bar (Raycast-style) ──────────────────────────────────
// variant: "pill" (Aurora), "hero" (Atrium), "wide" (Almanac)
function AgentBar({ variant = "pill", category = "AI OS", focus = false, onToggleFocus }) {
  if (variant === "hero") return <AgentHero category={category} focus={focus} onToggleFocus={onToggleFocus} />;

  const radius = variant === "wide" ? 18 : 999;
  return (
    <div
      className={variant === "wide" ? "glass" : "glass-pill"}
      style={{
        borderRadius: radius,
        boxShadow: "0 18px 40px -20px oklch(0.20 0.02 260 / 0.35), 0 2px 8px -2px oklch(0.20 0.02 260 / 0.10)",
      }}
    >
      <div className="agent-bar" style={{ padding: variant === "wide" ? "12px 18px" : "10px 16px", height: variant === "wide" ? 60 : 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 26, height: 26, borderRadius: 999,
            background: "linear-gradient(135deg, var(--c-agent), oklch(0.65 0.16 35))",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: 12, fontWeight: 600,
            boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 0.25)",
          }}>✦</span>
          <span className="chip" style={{ borderColor: "transparent", background: "transparent", color: "var(--fg)", padding: 0, fontWeight: 500, fontSize: 13 }}>
            {category}
            <span style={{ opacity: 0.5, marginLeft: 4 }}>▾</span>
          </span>
        </div>
        <div style={{ width: 1, height: 22, background: "var(--rule)" }} />
        <input placeholder={`Ask anything, or run a skill…`} defaultValue="" />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button title="Attach" style={iconBtn}><Glyph.Paperclip /></button>
          <button title="Focus mode" onClick={onToggleFocus} style={{ ...iconBtn, color: focus ? "var(--c-agent)" : undefined }}><Glyph.Sun /></button>
          <span className="kbd">⌘J</span>
        </div>
      </div>
    </div>
  );
}

function AgentHero({ category, focus, onToggleFocus }) {
  return (
    <div className="glass" style={{
      padding: 22,
      borderRadius: 28,
      boxShadow: "0 30px 80px -30px oklch(0.20 0.02 260 / 0.35), 0 4px 16px -4px oklch(0.20 0.02 260 / 0.10)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span className="t-eyebrow">Agent · {category}</span>
        <span style={{ flex: 1 }} />
        <span className="chip">claude opus 4.7</span>
        <button onClick={onToggleFocus} className="chip" style={{ cursor: "pointer", color: focus ? "var(--c-agent)" : "var(--fg-soft)" }}>
          <Glyph.Sun s={11} /> Focus
        </button>
      </div>

      {/* Last exchange peek */}
      <div style={{ fontSize: 14, color: "var(--fg-soft)", marginBottom: 6, lineHeight: 1.5 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--c-agent)" }}>you · 11:42</span> &nbsp; Triage inbox, skip newsletters, flag anything from Anthropic.
      </div>
      <div style={{ fontSize: 14, color: "var(--fg)", marginBottom: 18, lineHeight: 1.55 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-soft)" }}>claude · 11:42</span> &nbsp; 6 unread. Flagged the API quota email and Maya's reply about Friday. Archived 4 newsletters. Want me to draft the reply to Maya?
      </div>

      {/* Input row */}
      <div className="glass-pill" style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{
          width: 24, height: 24, borderRadius: 999,
          background: "linear-gradient(135deg, var(--c-agent), oklch(0.65 0.16 35))",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "white", fontSize: 11,
        }}>✦</span>
        <input style={{
          flex: 1, background: "transparent", border: 0, outline: 0,
          fontFamily: "var(--font-sans)", fontSize: 15, color: "var(--fg)",
        }} placeholder="Reply, run a skill, or paste a link…" />
        <button style={iconBtn}><Glyph.Paperclip /></button>
        <span className="kbd">⌘J</span>
      </div>
    </div>
  );
}

const iconBtn = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 26, height: 26, borderRadius: 8,
  border: 0, background: "transparent",
  color: "var(--fg-soft)", cursor: "pointer",
};

// ─── Section heading (no card, just a labeled rule) ─────────────
function Section({ eyebrow, title, count, accent, right, style, children }) {
  return (
    <section style={{ marginBottom: 28, ...style }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
        {accent && <span className={`src-dot src-${accent}`} style={{ marginRight: 0, transform: "translateY(-2px)" }} />}
        {eyebrow && <span className="t-eyebrow">{eyebrow}</span>}
        {title && <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500, letterSpacing: "-0.005em" }}>{title}</h3>}
        {typeof count === "number" && (
          <span className="t-mono t-num" style={{ fontSize: 11, color: "var(--fg-soft)" }}>{count}</span>
        )}
        <span style={{ flex: 1 }} />
        {right}
      </header>
      <hr className="hr" style={{ marginBottom: 14 }} />
      {children}
    </section>
  );
}

// ─── Row primitives ─────────────────────────────────────────────
function TaskRow({ t }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", fontSize: 14 }}>
      <span className={`check ${t.done ? "done" : ""}`} />
      <span className={`src-dot src-${t.source || "tasks"}`} style={{ marginRight: 0 }} />
      <span style={{
        flex: 1,
        textDecoration: t.done ? "line-through" : "none",
        opacity: t.done ? 0.5 : 1,
        letterSpacing: "-0.005em",
      }}>{t.text}</span>
      {t.prio === "high" && (
        <span className="t-mono" style={{ fontSize: 11, color: "var(--c-error)", letterSpacing: "0.04em" }}>
          ⏫ high
        </span>
      )}
      <span className="t-mono t-num" style={{ fontSize: 11, color: "var(--fg-soft)", minWidth: 56, textAlign: "right" }}>{t.due}</span>
    </div>
  );
}

function EventRow({ e }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "9px 0", fontSize: 14 }}>
      <span className="t-mono t-num" style={{ width: 64, color: "var(--fg-soft)", fontSize: 12 }}>{e.time}</span>
      <span className={`src-dot src-${e.color || "calendar"}`} style={{ marginRight: 0 }} />
      <span style={{ flex: 1, letterSpacing: "-0.005em" }}>{e.label}</span>
      <span className="t-mono t-num" style={{ fontSize: 11, color: "var(--fg-soft)" }}>{e.durMin}m</span>
    </div>
  );
}

function MailRow({ m }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", fontSize: 14 }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: m.unread ? "var(--c-gmail)" : "transparent", flexShrink: 0 }} />
      <Glyph.Envelope c="var(--c-gmail)" />
      <span style={{ minWidth: 120, color: m.unread ? "var(--fg)" : "var(--fg-soft)", fontWeight: m.unread ? 500 : 400, fontSize: 13 }}>{m.from}</span>
      <span style={{ flex: 1, color: m.unread ? "var(--fg)" : "var(--fg-soft)", letterSpacing: "-0.005em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.subject}</span>
      {m.important && <Glyph.Star s={11} c="var(--c-gmail)" fill="var(--c-gmail)" />}
      <span className="t-mono t-num" style={{ fontSize: 11, color: "var(--fg-soft)", width: 36, textAlign: "right" }}>{m.min}m</span>
    </div>
  );
}

function PRRow({ pr }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", fontSize: 14 }}>
      <Glyph.Branch c="var(--c-github)" />
      <span className="t-mono" style={{ color: "var(--fg-soft)", fontSize: 12 }}>#{pr.num}</span>
      <span style={{ flex: 1, letterSpacing: "-0.005em" }}>{pr.title}</span>
      <span className="t-mono" style={{ fontSize: 11, color: "var(--fg-soft)" }}>{pr.repo.split("/")[1]}</span>
      <span className="t-mono t-num" style={{ fontSize: 11, color: "var(--fg-soft)", width: 36, textAlign: "right" }}>{pr.ago}</span>
    </div>
  );
}

// ─── Big countdown / time block ─────────────────────────────────
function NowNextHero({ now, next, scale = 1, layout = "row" }) {
  if (layout === "stack") {
    return (
      <div>
        <div className="t-eyebrow" style={{ marginBottom: 8 }}>Now · ends {now.until}</div>
        <h2 style={{ margin: 0, fontSize: 44 * scale, fontWeight: 500, letterSpacing: "-0.025em", lineHeight: 1.05 }}>
          {now.title}
        </h2>
        <div style={{ marginTop: 18, color: "var(--fg-soft)", fontSize: 15 }}>
          Next · <span style={{ color: "var(--fg)" }}>{next.title}</span> · in {next.inMin}m · {next.at}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 28 }}>
      <div style={{ flex: 1 }}>
        <div className="t-eyebrow" style={{ marginBottom: 8 }}>Now · ends {now.until}</div>
        <h2 style={{ margin: 0, fontSize: 36 * scale, fontWeight: 500, letterSpacing: "-0.025em", lineHeight: 1.1 }}>{now.title}</h2>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="t-eyebrow" style={{ marginBottom: 8 }}>Next · in {next.inMin}m</div>
        <div style={{ fontSize: 16, fontWeight: 500, letterSpacing: "-0.01em" }}>{next.title}</div>
        <div style={{ fontSize: 12, color: "var(--fg-soft)", marginTop: 2 }} className="t-mono">{next.at}</div>
      </div>
    </div>
  );
}

// Stats pill (number + label + tiny spark)
function StatPill({ label, value, sub, spark, tone = "var(--fg)" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 0", minWidth: 0 }}>
      <div>
        <div className="t-eyebrow" style={{ marginBottom: 4 }}>{label}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span className="t-num" style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", color: tone }}>{value}</span>
          {sub && <span className="t-mono" style={{ fontSize: 11, color: "var(--fg-soft)" }}>{sub}</span>}
        </div>
      </div>
      {spark && <div style={{ marginLeft: "auto" }}>{spark}</div>}
    </div>
  );
}

// expose
Object.assign(window, {
  TodFrame, Glyph, Sparkline, TodGlyph, AgentBar,
  Section, TaskRow, EventRow, MailRow, PRRow,
  NowNextHero, StatPill, greetingFor,
});
