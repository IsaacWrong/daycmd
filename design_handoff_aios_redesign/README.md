# Handoff: AI OS — Home + Project view redesign

## Overview

Redesign of [IsaacWrong/ai-os](https://github.com/IsaacWrong/ai-os) — the personal-command-center new-tab page. Replaces the current 4-column Tailwind card grid with a calmer, agent-forward layout that scales from "leave open all day for ambient awareness" to "focused deep work" without changing pages.

Two top-level views in this handoff:

1. **Home · Almanac** — the everything-dashboard you land on when you open the tab. Replaces `src/app/page.tsx` + the dashboard cards under `src/components/*Card.tsx`.
2. **Project view · trail** — what the page becomes when you click into a single project. New route, e.g. `src/app/projects/[name]/page.tsx`. Reuses the chrome from Home but pivots the agent from a bottom bar to a right-column workspace.

## About the design files

The files in `reference/` are **design references prototyped in HTML + inline-JSX/Babel + raw CSS variables** — they show intended look and behavior and ARE NOT meant to be shipped as-is. The task is to **recreate them inside the existing Next.js / React 19 / TypeScript / Tailwind v4 codebase**, using its already-established patterns:

- React components in `src/components/`
- Tailwind v4 for styling (`@theme inline` in `src/app/globals.css`)
- API routes under `src/app/api/`
- The data feeds and types already wired in the current cards

Treat the JSX in `reference/` as a visual spec, not a code template. Port to idiomatic Tailwind classes and proper React/TS components in the target repo.

## Fidelity

**High-fidelity.** Final colors, typography, spacing, sparkline shapes, and copy are all specified below. Recreate pixel-perfectly. Where the reference uses inline styles, port to Tailwind utility classes (or to a small set of CSS-variable-driven utilities) — but keep the visual output identical.

## Aesthetic direction (one-paragraph summary)

Glassy / atmospheric. Single sans family (Geist). **No card containers** — sections are defined by an eyebrow + heading + hairline rule, not boxes. Background is a soft time-of-day gradient with two large blurred color orbs and a subtle SVG grain overlay. Foreground reads like a calm document. Semantic source colors used as small dots, never as fills. The only enclosed surface is the agent input itself (glass with backdrop-blur) — everything else is open layout.

---

## Design tokens

### Typography
- Font family: **Geist** (already in stack — keep the existing `next/font` setup). Weights 300 / 400 / 500 / 600.
- Mono family: **Geist Mono** (weights 400 / 500). Used for: time stamps, numbers (with `font-variant-numeric: tabular-nums`), source-IDs (`@isaac`, `#82`, `0a7f3b2`), eyebrows.
- Feature settings: `font-feature-settings: "ss01", "cv01"` on body.
- Letter spacing: body `-0.005em`; large headings `-0.02em` to `-0.03em`.
- `text-wrap: pretty` on long-form prose (agent messages, daily note).

### Type scale (concrete sizes used)
| Role                      | Size | Weight | LH    | Notes |
|---------------------------|------|--------|-------|-------|
| Hero / project name       | 40px | 500    | 1.0   | -0.03em tracking |
| Section hero (Now block)  | 36px | 500    | 1.08  | -0.025em tracking |
| Masthead greeting         | 19px | 500    | 1.15  | -0.015em tracking |
| Body / row text           | 14px | 400    | 1.5   | -0.005em tracking |
| Compact rows / right col  | 12.5–13px | 400 | 1.45 | |
| Stat number               | 22px | 500    | 1     | -0.02em tracking, tabular-nums |
| Mono meta                 | 10–12px | 400 | 1     | "Geist Mono" |
| Eyebrow (section label)   | 10px | 500    | 1     | uppercase, 0.12em tracking, mono |

### Colors

All foreground/background colors are **time-of-day-aware** via CSS variables. The variables flip when the `.tod-*` class on the page root changes. Time-of-day presets:

| Preset    | Hour range | --bg-a (top) | --bg-b (bottom) | --fg | Use |
|-----------|------------|--------------|------------------|------|-----|
| dawn      | 06–09 | `oklch(0.94 0.04 25)`  | `oklch(0.96 0.03 60)`  | `oklch(0.25 0.02 260)` | light |
| morning   | 09–11 | `oklch(0.97 0.02 220)` | `oklch(0.98 0.02 60)`  | `oklch(0.22 0.02 260)` | light |
| noon      | 11–14 | `oklch(0.97 0.03 230)` | `oklch(0.99 0.01 230)` | `oklch(0.20 0.02 260)` | light |
| afternoon | 14–17 | `oklch(0.95 0.04 60)`  | `oklch(0.97 0.02 230)` | `oklch(0.22 0.02 260)` | light |
| dusk      | 17–20 | `oklch(0.82 0.10 30)`  | `oklch(0.78 0.09 310)` | `oklch(0.20 0.02 280)` | light |
| night     | 20–23 | `oklch(0.20 0.04 260)` | `oklch(0.15 0.05 280)` | `oklch(0.94 0.01 260)` | dark  |
| deep      | 23–06 | `oklch(0.13 0.03 260)` | `oklch(0.10 0.02 260)` | `oklch(0.94 0.01 260)` | dark  |

Derived per-preset:
- `--fg-soft` — secondary text. Roughly `0.45 0.02 260` light / `0.65 0.02 260` dark.
- `--rule` — hairlines. `oklch(from var(--fg) l c h / 0.10)` (light) / `0.10` (dark).
- `--glass` — the agent input surface. Light tinted by `--bg-a` hue at ~55% alpha; dark same at ~40%.
- `--glass-bd` — glass border, very low alpha.
- `--orb-1`, `--orb-2` — the two blurred background orbs.

All values codified in `reference/styles.css` lines 18–24 — port verbatim to Tailwind theme tokens.

### Semantic source palette (constant across themes)
| Source     | Token        | OKLCH                  | Used for |
|------------|--------------|------------------------|----------|
| Gmail      | `--c-gmail`    | `oklch(0.65 0.18 25)`  | inbox dots, envelope glyph, unread markers |
| GitHub     | `--c-github`   | `oklch(0.55 0.18 295)` | PR/issue/commit rows, branch glyph |
| Calendar   | `--c-calendar` | `oklch(0.62 0.18 250)` | calendar event blocks, time strip blocks |
| Tasks      | `--c-tasks`    | `oklch(0.62 0.15 320)` | task dots, pomodoro, heatmap fill |
| Agent      | `--c-agent`    | `oklch(0.70 0.13 50)`  | agent mark, knowledge dots, "you" timestamp |
| Obsidian   | `--c-obsidian` | `oklch(0.55 0.20 290)` | daily-note accent |
| Error      | `--c-error`    | `oklch(0.62 0.17 25)`  | errors, P0 labels, failing checks |
| Good       | `--c-good`     | `oklch(0.65 0.13 150)` | Stripe deltas, passing checks, "ship" streak |

These are used **only as 6–8px dots, single-pixel left borders, or 11–12px monospace text** — never as fills behind text or buttons (except the focus-tile "Start" button).

### Spacing scale
- Page padding: `48px` horizontal (Almanac/Project), `56px` (Aurora reference).
- Inter-section vertical: `24–28px` between sections, `14px` after a section heading before content.
- Row vertical: `6–9px` per row depending on density.
- Column gaps: `36–40px` between Almanac's 3 columns; `40px` between Project's 2 columns.
- Hairline divider margins: `0 14px` (skill strip), `0 18px` (stat dividers), `0` (between sections — full-width `<hr>`).

### Border radius
- Glass input (agent bar): `14–20px`
- Glass agent hero panel: `28px`
- Day-strip event blocks: `4px`
- Heatmap cells: `4px`
- Buttons: `6px`
- Most other elements have no radius — they're text or hairlines.

### Shadows
Only the agent input gets a soft shadow:
- Wide variant: `0 18px 40px -20px oklch(0.20 0.02 260 / 0.35), 0 2px 8px -2px oklch(0.20 0.02 260 / 0.10)`
- Hero variant: `0 30px 80px -30px oklch(0.20 0.02 260 / 0.35), 0 4px 16px -4px oklch(0.20 0.02 260 / 0.10)`

Nothing else casts a shadow.

### Backdrop / atmosphere
- Two blurred color orbs absolutely positioned in the background, `filter: blur(80px)`, ~540–600px each. Orb A top-left, Orb B bottom-right. Colors come from `--orb-1` / `--orb-2`.
- SVG fractal-noise grain overlay at `mix-blend-mode: overlay`, opacity 0.35. Source SVG inlined in `reference/styles.css`. Keep this — it's what makes the gradients feel paper-like instead of generic.

---

## Screens

### 1) Home · Almanac

#### Purpose
Land here when you open the tab. Triage inbox / calendar / PRs / tasks at a glance. Talk to the agent via the bottom bar. Switch into focus mode for deep work.

#### Layout
```
┌─────────────────────────────────────────────────────────────────┐
│  Masthead — greeting + meta · separators · category · weather   │  ~70px
├──────────────┬──────────────────────────────┬───────────────────┤
│              │                              │                   │
│  LEFT SPINE  │       CENTER COLUMN          │    RIGHT STREAMS  │
│  300px       │       flex (≈ 620px)         │    320px          │
│              │                              │                   │
│  Focus tile  │  Now hero + day-strip        │  Calendar         │
│  Numbers     │  Tasks                       │  Inbox            │
│  Streaks     │  Daily note                  │  GitHub           │
│  Heatmap     │                              │  Knowledge        │
│  Projects    │                              │  Errors           │
│              │                              │                   │
├──────────────┴──────────────────────────────┴───────────────────┤
│  Skill chip strip  (centered, hairline-separated text)          │
│  Agent input bar   (glass, wide variant, full-width)            │  ~110px
└─────────────────────────────────────────────────────────────────┘
```

CSS grid: `grid-template-columns: 300px 1fr 320px; gap: 40px; padding: 20px 48px 116px`. The bottom dock is absolutely positioned (`left: 48; right: 48; bottom: 22`).

#### Masthead
- 28×28 rounded-8 gradient mark (linear-gradient 135deg, `--c-agent → --c-tasks → --c-github`, inset 1px white-20 ring), containing the character `◉`.
- Greeting "Afternoon, Isaac." (time-of-day verb + name + period). 19px / 500.
- Meta sub-line in mono: "Wednesday, May 12 · Week 19 · Day 11 of ship streak". 11px, `--fg-soft`.
- Right side, inline + hairline-divided:
  - Agent-color dot + "AI OS" + mono "318 runs"
  - Time-of-day glyph + mono "67° · H72 L54"
  - Mono "settings" (cursor: pointer)
- Bottom border: `1px solid var(--rule)`.

#### Focus tile (left spine, top)
A bespoke section, **the most visually deliberate element on the left**.
- Eyebrow "● Focus" in `--c-tasks` color.
- "WORKING ON" mono label + project dot + "ai-os" + mono "· redesign sweep".
- Pomodoro pips: row of 6 thin pills (4 filled in `--c-tasks`, 2 dim).
- Primary button "▶ Start 25:00" — solid `--c-tasks` background, white text, 9×12 padding, radius 6.
- Secondary text button "Change…" — transparent, `--fg-soft`.

This is the ONLY filled-color button anywhere in the design. It's intentional — it draws the eye to the "focus" affordance.

#### Today in numbers
5 rows: Tokens / Tasks closed / Commits / Inbox cleared / Note words. Each row:
- Left: 12.5px label in `--fg-soft`
- Right: 15px / 500 value in the source-tinted color
- Optional sub (mono 10px, soft)
- Optional delta (mono 10px, green or soft)
- Optional inline 36×14 sparkline

#### Streaks
3 progress bars: Daily note / Ship / No-snooze. Bar height 3px, radius 99, filled width = `value / 30`. Number in source-color, unit ("d") in mono soft.

#### Heatmap
- 7-column grid of weekday letters S M T W T F S (9px mono soft).
- 7-column grid of cells, 22px tall, radius 4. Background opacity scales `(v / max) * 0.55 + 0.12` of `--c-tasks`. Today's cell has a 1px tinted border.
- Bottom legend: "Apr 29" — 4 swatch keys — "today".

#### Projects (left spine, bottom)
4 rows: ai-os / trail / kestrel / research. Each: accent dot + name + small sparkline (per-project) + mono "Xh".

#### Now hero (center top)
- Eyebrow "Now · ends 3:30 PM · 1h 12m left".
- Headline 36px / 500, current activity ("Deep work — AI OS redesign").
- Day-strip below — see next.

#### Day-strip (horizontal timeline)
- 36px tall container with `background: oklch(from var(--fg) l c h / 0.04)`, border `1px solid --rule`, radius 8.
- Hour ticks: vertical hairlines every hour, brighter every 3 hours.
- Event blocks positioned absolutely by start/end hour, height = container − 12, radius 4, background `oklch(from --c-{source} l c h / 0.30)`, 2px left border in `--c-{source}`, 10.5px label.
- **Now marker**: 2px vertical line in `--fg` color, with a 10px circle dot at the top, both surrounded by a 3px solid `--bg-a` ring to "punch out" through the bar.
- Below: mono hour labels "9a 12p 3p 6p 9p".

#### Tasks (center)
Eyebrow + title + count + right-side meta "4 due · 2 later". List of `TaskRow`:
- 14×14 unchecked square (or filled if done) — 1.4px border `--fg-soft`, radius 4.
- Source dot (defaults to `--c-tasks`, GitHub-sourced tasks get `--c-github`).
- Task text, line-through + 0.5 opacity if done.
- Priority "⏫ high" in mono color `--c-error`, 11px, 0.04em tracking — **NO pill background**.
- Mono due date, 11px, 56px wide right-aligned.

#### Daily note (center, bottom)
- Eyebrow "Notes" + title "Daily" + obsidian dot, right meta "Daily/2026-05-12.md · 142 words".
- Body in a left-rule treatment: `padding-left: 18px; border-left: 2px solid var(--rule)`.
- Renders markdown lightly:
  - Lines starting with `## ` become 11px mono uppercase eyebrows (top margin 12).
  - Empty lines become 6px spacers.
  - Other lines: 13.5px / 1.6 lh body in `--fg-soft`.
- Footer: "Continue writing →" with right-arrow glyph, dashed top border.

#### Right column (streams)
4 sections stacked: Calendar / Inbox / GitHub / Knowledge / Errors. Each uses `SectionMini`:
- 8px gap header: optional source dot + eyebrow + optional count (mono 10px far right).
- Hairline rule below header.
- Compact rows (~12.5px text, 4–6px vertical padding).

#### Skill chip strip (bottom, above agent bar)
**Plain text + hairline dividers — no pills.** Centered flex row, 12px text, 6 skills (Morning brief / Triage inbox / Plan today / Weekly review / Reflect / Stale tasks sweep), each with a mono ⌘1–⌘6 hotkey 10px in `--fg-soft`. 14px margin around 1px hairline dividers between items. Whole strip is 0.85 opacity by default, 1.0 in focus mode.

#### Agent input bar (bottom dock, wide variant)
- 60px tall, radius 18, `--glass` background, backdrop-blur 24/saturate 160, 1px `--glass-bd` border.
- 26×26 round avatar with `linear-gradient(135deg, --c-agent, oklch(0.65 0.16 35))`, inner ring, white "✦".
- Inline "AI OS ▾" category label (transparent, 13px / 500).
- 1px × 22px hairline.
- `<input>` placeholder "Ask anything, or run a skill…", 15px, transparent.
- Right side: paperclip icon button, sun icon button (toggles focus mode — turns `--c-agent` when on), mono ⌘J kbd hint (10px, 1px `--glass-bd` border, radius 5).

### 2) Project view · trail

#### Purpose
What you see when you click a project from Home. Everything is scoped to that project — agent, tasks, GitHub, stats. The agent becomes the right-column workspace because you're working *with* it inside this context.

#### Layout
```
┌─────────────────────────────────────────────────────────────────┐
│  Masthead — ← AI OS / projects / trail · status · streak        │  ~70px
├─────────────────────────────────────────────────────────────────┤
│  Hero — "trail" big + subtitle | 6-cell stats row               │  ~140px
├──────────────┬──────────────────────────────────────────────────┤
│              │   AGENT WORKSPACE                                │
│  LEFT        │   header (Agent · trail · 142 runs · focus)      │
│  440px       │   skill strip (project-scoped, hairline)         │
│              │                                                  │
│  Tasks       │   thread (scrolls)                               │
│  GitHub      │                                                  │
│  Activity    │                                                  │
│              │   ┌──────────────────────────────────────────┐   │
│              │   │ glass input (only enclosed surface)       │   │
│              │   └──────────────────────────────────────────┘   │
└──────────────┴──────────────────────────────────────────────────┘
```

Grid: `440px 1fr; gap: 40px; padding: 8px 48px 28px`.

#### Masthead — same chrome as Home, but with a breadcrumb:
- Same gradient mark.
- Replace greeting block with mono breadcrumb: `← AI OS / projects / trail` with `/` separators in 0.5 opacity. `whiteSpace: nowrap` is critical here — wrapped to two lines this looks broken.
- Right side: project accent dot + "shipping v0.4" + mono "· 3 days to release" | mono "ship streak 11d" | mono "settings". All hairline-separated, all `whiteSpace: nowrap`.

#### Hero
- Eyebrow "Project".
- Project name 40px / 500, preceded by a 14px accent dot.
- Subtitle 14px in `--fg-soft`: "Offline-first hiking maps · iOS · TestFlight".
- 6-cell stats row, separated from the name by a top + bottom hairline rule, 14px vertical padding inside.
- Each cell:
  - Eyebrow line: `stripe · MRR` / `stripe · Subscribers` / `analytics · DAU` / etc. The `stripe` or `analytics` prefix is in 9px mono soft + 0.4-opacity middle dot + label.
  - Value 22px / 500 in source-tinted color (Stripe metrics in green, analytics in calendar blue, etc.).
  - Optional delta in mono 11px green.
  - Optional 80×14 sparkline (only MRR + DAU get one).
- `display: flex; flexWrap: nowrap`; 1px-wide vertical hairlines between cells (`margin: 0 18px; flexShrink: 0`); each cell `whiteSpace: nowrap`.

#### Left column

**Tasks** — `SectionMini` titled "Tasks", count, `--c-tasks` dot. Uses the same `TaskRow` as Home. 6 rows in mock.

**GitHub** — three sub-sections inside one SectionMini, separated by 9px mono uppercase subheadings ("Pulls" / "Issues" / "Commits"). Right side of section header shows CI status: 6px dot (green if passing) + mono "CI passing · 2 PR · 7 issues".
- PR rows: branch glyph + mono "#NN" + title + status mono ("review" in `--c-github` or "failing" in `--c-error`) + ago.
- Issue rows: 10×10 circle outline in `--c-good` + mono "#NN" + title + label chips (just colored mono text — "bug", "P0" in `--c-error`) + ago.
- Commit rows: mono short SHA (7 chars) + message + author handle + ago.

**Activity** — mixed-source log. Each row: 14px-wide source glyph centered (branch for github, mono `$` for stripe, ✦ for agent, spark for analytics) + text + mono ago.

#### Right column — Agent workspace

**Header strip**:
- Agent dot + eyebrow "Agent · trail".
- Mono "claude opus 4.7 · 142 runs in this thread".
- Right: focus-mode toggle text button "Focus mode on/off" with sun glyph. `--c-agent` when active.

**Skill strip** — `padding: 10px 0`, top + bottom hairline, marginBottom 16. Same plain-text + hairline-divider treatment as Home but project-scoped:
- Plan v0.4 release · Triage GitHub issues · Draft changelog · Summarize crash reports · Reply to TestFlight · Status update
- Each button `whiteSpace: nowrap; flexShrink: 0`. Dividers `flexShrink: 0`.

**Thread** — `flex: 1; minHeight: 0; overflowY: auto`. 18px gap between messages. Each `ThreadMessage`:
- Timestamp eyebrow: "YOU · 1:42 PM" in `--c-agent` (when you) or "CLAUDE · 1:42 PM" in soft (when claude). 10px mono uppercase 0.04em tracking.
- Message body: 14.5px / 1.55 / `--fg`, `text-wrap: pretty`.
- Optional attachments: stacked 6×10 padded rows with a 2px left border in the appropriate source color (github violet for PR, error red for bug issue), 12.5px text, source glyph, label, right arrow. `background: oklch(from var(--fg) l c h / 0.03)`.

**Input** — the only `.glass` surface in the design.
- `padding: 12px 16px`, radius 14.
- 22×22 round agent avatar with the orange gradient and ✦.
- Transparent `<input>` 14.5px placeholder "Ask Claude about trail, or run a skill above…".
- Paperclip icon button (transparent).
- ⌘J mono kbd (1px `--rule` border, radius 4, 1px 5px padding).
- Footer line under the input: mono 10px between `--fg-soft` and `--fg`:
  - Left: "thread auto-logs to Categories/trail/raw/"
  - Right: "$0.34 in this thread"

---

## Interactions & behavior

| Interaction | Trigger | Behavior |
|---|---|---|
| **Time-of-day shift** | Local clock | Page applies `tod-{dawn,morning,noon,afternoon,dusk,night,deep}` class to the root based on the current hour. Re-evaluate every 10 minutes. CSS variables flip — no JS animation, the gradient just is what it is for that hour. |
| **Focus mode** | Click the sun icon in the agent bar, or "Focus mode on/off" on project view | Toggles `.focus` class on the page root. Everything with class `dimmable` transitions to `opacity: 0.18; filter: blur(0.5px)` over 320ms. Everything with `focus-keep` stays full opacity (and lifts `translateY(-2px)`). The skill chip strip brightens to 1.0 opacity. |
| **Pomodoro start** | Click "▶ Start 25:00" in the Focus tile | Start a 25-minute timer (the existing app needs this added — no pomodoro state today). On completion, increment the pomodoros-today counter; on the 4th, log to the daily note via the existing `append_to_daily_note` tool. |
| **Skill chip click** | Click a skill name or press its hotkey (⌘1–⌘6) | Insert the skill's prompt template into the agent input and submit (or, if you prefer, just pre-fill). Project-view skills are scoped to the active project category. |
| **Agent input submit** | Enter | Send to existing `POST /api/agent` stream. Append message to thread. |
| **⌘J** | Anywhere on the page | Expand the agent bar to the right-side drawer (existing behavior — keep it). Esc to close. |
| **Project click** | Click a project row in the left spine (Almanac) | Navigate to `/projects/{name}`. |
| **Breadcrumb back** | Click `← AI OS` in project masthead | Navigate to `/`. |
| **Task checkbox** | Click | Use the existing `task_done` Obsidian tool to flip the checkbox in the vault. Optimistic UI. |
| **PR / issue / commit row** | Click | Open the GitHub URL in a new tab. |
| **Activity row** | Click | If it's a github/stripe/etc event with a URL, open it. |

## State management

Use the existing data feeds — the redesign doesn't change the API surface. New additions:

- **Focus mode** (boolean) — local component state on the page; can persist in `localStorage`.
- **Current time-of-day preset** (string) — derived from `new Date().getHours()`; recompute on a 10-minute interval.
- **Active project** (slug) — URL param on the project route.
- **Pomodoro session** — new state: `{ active, remainingSec, completedToday }`. Persist in `localStorage`.
- **Agent thread, per project** — already exists per-category; just key by project name.

Per-project data feeds (currently missing from the app, add to mock first):

- **Stripe** — `GET /api/projects/[name]/stripe` returning `{ mrr, mrrDelta, subscribers, subscribersDelta, churn, trialsActive, mrrTrend: number[14] }`. Wire to Stripe API via `stripe` npm package, scoped by a `STRIPE_PROJECT_PREFIX_*` env var per project or by metadata on the Customer object.
- **Analytics** — `GET /api/projects/[name]/analytics` returning `{ dau, dauDelta, sessionsPerUser, retentionD7, crashFree, dauTrend: number[14] }`. Pluggable backend (Plausible / PostHog / app-specific).
- **Activity log** — append-only event feed merging GitHub webhooks, Stripe webhooks, and agent runs. Already partially exists in the agent-run log table; extend.

The mock structure in `reference/data.js` (the `projectDetail.trail` entry) is the **target response shape** for these endpoints — use it as the API contract.

---

## File mapping (current → redesigned)

Replace / refactor these files in the existing repo:

| Current file | Redesigned role | Notes |
|---|---|---|
| `src/app/page.tsx` | Home (Almanac) | Becomes a single page with the new 3-column layout. Pull TasksCard etc. content but render with new chrome. |
| `src/app/projects/[name]/page.tsx` *(new)* | Project view | New route. |
| `src/components/NowNext.tsx` | Now hero | Reuse data fetch; redesign output: eyebrow + 36px headline + day-strip below. |
| `src/components/TasksCard.tsx` | Tasks rows | Drop the card chrome; render `TaskRow` list. Inline checkbox writes back via existing `task_done` API. |
| `src/components/CalendarCard.tsx` | Calendar section (right col) | Compact 5-event list. The day-strip in the hero is a NEW component that derives from the same calendar feed. |
| `src/components/GmailCard.tsx` | Inbox section | Compact rows; envelope glyph + red dot for unread. |
| `src/components/GitHubCard.tsx` | GitHub section (home right col) AND GitHub section (project left col) | The project version filters by repo. |
| `src/components/DailyNoteCard.tsx` | Daily note preview | Drop the editor in the home version, just render a preview; the full editor lives on a dedicated `/daily` route or modal. |
| `src/components/AgentPanel.tsx` | Bottom agent bar (Home) + right-column workspace (Project) | Major refactor. Split into `<AgentBar variant="wide" />` and `<AgentWorkspace projectKey={...} />`. Keep the underlying stream/abort/category-thread logic. |
| `src/components/SkillsPanel.tsx` | Skill strip | Drop the sidebar treatment; render as horizontal hairline-separated text buttons above the agent bar / workspace. |
| `src/components/KnowledgeCard.tsx` | Knowledge section (right col) | Compact list of recent compiled pages + outputs. |
| `src/components/ErrorsCard.tsx` | Errors section (right col) | Compact rows; mono tool name + msg + ago. |
| `src/components/WeatherBadge.tsx` | Masthead weather chip | Keep the geolocation + Open-Meteo logic; render as inline text + glyph, no chip background. |
| `src/components/UsageStrip.tsx` | "Today in numbers" → Tokens row, AND footer of agent input ("$0.34 in this thread") | Re-render with the new visual treatment. |
| `src/components/ProjectsCard.tsx` | Projects list (left spine) | Each row gets a per-project mini sparkline of weekly commits. Click navigates to `/projects/{name}`. |
| `src/components/AutomationsCard.tsx` | Settings page (not on the dashboard) | Move off the home — it's not in the day-to-day surface. |
| *(new)* `src/components/FocusTile.tsx` | Focus tile (left spine, top) | New. Pomodoro + active project + start button. |
| *(new)* `src/components/DayStrip.tsx` | Horizontal day timeline | New. Reads calendar feed; renders absolutely-positioned event blocks + now-marker. |
| *(new)* `src/components/Heatmap.tsx` | 14-day productivity heatmap | New. Reads from a per-day hours-tracked source (deriving from agent run timestamps + git commit timestamps is a reasonable start). |
| *(new)* `src/components/Sparkline.tsx` | Inline sparklines | New. Pure SVG, see `reference/atoms.jsx` `Sparkline()` for the path math. |
| *(new)* `src/components/Activity.tsx` | Mixed-source event log | New. Project-scoped feed merging GitHub / Stripe / agent / analytics events. |
| *(new)* `src/components/TodFrame.tsx` | Time-of-day background wrapper | New. Applies `.tod-*` class + renders the two orbs + the grain overlay. |

### Tailwind v4 conversion notes

The reference uses CSS variables + inline styles for speed. In your repo:

1. Move the time-of-day variable blocks into `src/app/globals.css` under `@theme inline`. Define them as theme tokens so Tailwind utilities like `bg-bg-a` and `text-fg-soft` work.
2. Define the semantic palette (`c-gmail`, `c-github`, etc.) as theme colors so you can write `bg-c-tasks/30` / `text-c-github` / `border-c-error` etc.
3. The OKLCH `oklch(from var(--fg) l c h / 0.10)` relative syntax is well-supported by modern browsers — keep it. Tailwind v4 supports it in arbitrary values: `bg-[oklch(from_var(--fg)_l_c_h/0.10)]`.
4. The grain SVG: keep as a data-URL background in `globals.css` — don't try to inline it everywhere.

---

## Assets

- **Fonts**: Geist + Geist Mono — already in your `next/font` setup. No new fonts.
- **No brand logos / icons** are used. The "glyphs" (envelope, branch, calendar, star, etc.) are all hand-rolled simple SVGs in `reference/atoms.jsx` — port them as a `<Glyph.*>` component module. They are intentionally generic — NOT real Gmail/GitHub/Calendar marks.
- **No imagery** beyond the SVG grain overlay (inlined as a data-URL in CSS).
- **Mock data** in `reference/data.js` is for the prototype only. In production, all of it comes from existing or new API routes — see "File mapping" above.

---

## What is intentionally NOT in this redesign

So you don't try to add them back from the old design:

- **Card containers / borders / background fills around sections** — dropped on purpose. Sections are defined by eyebrow + heading + hairline only.
- **Pill backgrounds on chips, badges, and skill buttons** — dropped. Use colored mono text + hairline dividers instead.
- **Emoji-as-icons** — replaced with simple hand-rolled SVG glyphs. (Obsidian's Tasks plugin still uses emoji in the vault file, but the rendered UI uses glyphs.)
- **Settings on the dashboard** — moved to its own page; the masthead just has a "settings" text link.
- **Automations / Knowledge management UIs on the dashboard** — Knowledge keeps a tiny presence (recent pages list), Automations moves off-dashboard.

---

## Files in this bundle

```
design_handoff_aios_redesign/
├── README.md                       (this file)
└── reference/
    ├── index.html                  Mounts the prototype; loads CDN React + Babel
    ├── styles.css                  All design tokens + atom classes
    ├── data.js                     Mock data — use as the API contract
    ├── atoms.jsx                   Shared widgets (TodFrame, AgentBar, Sparkline, Glyph, TaskRow, EventRow, MailRow, PRRow, NowNextHero, Section, StatPill, greetingFor)
    ├── option-almanac.jsx          Home design
    └── option-project.jsx          Project view (trail example)
```

Open `reference/index.html` in a browser to see the live prototype. It runs entirely client-side, no build step.

---

## Implementation order (suggested)

1. **Tokens first.** Port the time-of-day variables + semantic palette into `globals.css` under `@theme inline`. Verify a single test page renders with the right colors at the right hour.
2. **TodFrame + masthead.** Get the background gradient + orbs + grain working as a layout wrapper. Get the masthead reading cleanly.
3. **Sparkline + Glyph atoms.** Port these as small reusable components — they're used everywhere.
4. **Replace the home page** section by section, starting with the left spine (Focus tile is genuinely new — start there; the rest is a re-render of existing data).
5. **Center column** — Now hero + day-strip is the highest-judgment piece; spend time getting the now-marker punch-through right.
6. **Right column streams** — mostly straight refactors of existing cards.
7. **Bottom agent dock** — refactor `AgentPanel.tsx` into `AgentBar` + the skill strip above it.
8. **Project route** — `/projects/[name]/page.tsx`. The masthead/hero/left column come together quickly; the right-column agent workspace is the new piece. Reuse the agent's stream/category logic.
9. **Wire Stripe + analytics endpoints last** — until then, leave the prototype mock data behind the API. The view doesn't change when real data arrives.

Good luck.
