// Shared mock data for AI OS redesign explorations.
// Picked so each option shows real density without feeling crowded.

window.MOCK = (function () {
  const now = new Date();

  return {
    user: { name: "Isaac", handle: "@isaac" },
    today: { weekday: "Wednesday", date: "May 12", year: 2026, full: "Wednesday, May 12" },

    // Now / Next
    nowBlock: { title: "Deep work — AI OS redesign", endsIn: "1h 12m", until: "3:30 PM" },
    nextBlock: { title: "1:1 with Maya", inMin: 75, at: "3:45 PM", source: "calendar" },

    // Tasks (Obsidian Tasks plugin parsed)
    tasks: [
      { id: 1, text: "Reply to Anthropic re: API quota bump", due: "Today", prio: "high", tag: "personal" },
      { id: 2, text: "Push knowledge-base lint fix", due: "Today", prio: "med", tag: "ai-os", source: "github" },
      { id: 3, text: "Outline Q3 research agenda", due: "Tomorrow", prio: "med", tag: "research" },
      { id: 4, text: "Book flight to PDX", due: "May 15", prio: "low", tag: "personal" },
      { id: 5, text: "Review Trail v0.4 release notes", due: "May 16", prio: "med", tag: "trail" },
      { id: 6, text: "Read 'Reflections on Trusting Trust'", due: "—", prio: "low", tag: "research" },
      { id: 7, text: "Refactor agent panel into drawer", due: "May 18", prio: "low", tag: "ai-os", source: "github", done: true },
    ],

    // Calendar — next 24h
    calendar: [
      { time: "Now",     label: "Deep work — AI OS redesign", durMin: 90, color: "tasks" },
      { time: "3:45 PM", label: "1:1 with Maya",              durMin: 30, color: "calendar" },
      { time: "5:00 PM", label: "Run · 5K",                   durMin: 45, color: "good"  },
      { time: "7:30 PM", label: "Dinner — Lila",              durMin: 90, color: "agent" },
      { time: "Thu 9a", label: "Anthropic dev sync",         durMin: 30, color: "calendar" },
      { time: "Thu 11a", label: "Pairing — Knowledge base",  durMin: 60, color: "github" },
    ],

    // Gmail (inbox triage feed)
    gmail: [
      { from: "Anthropic Console", subject: "Your API usage report — week of May 5", min: 12, unread: true, important: true },
      { from: "Maya Chen",         subject: "Re: AI OS demo Friday?",               min: 47, unread: true },
      { from: "GitHub",            subject: "[IsaacWrong/trail] PR #82 review requested", min: 95, unread: true, source: "github" },
      { from: "Linear",            subject: "Your weekly digest — 7 issues moved",  min: 180, unread: false },
      { from: "Stripe",            subject: "Payout of $1,242.00 sent to your bank", min: 240, unread: false },
      { from: "Obsidian",          subject: "Sync conflict in Daily/2026-05-11.md", min: 320, unread: true, important: true },
    ],

    // GitHub
    github: {
      reviewRequested: [
        { repo: "IsaacWrong/trail",     num: 82,  title: "Refactor offline tile cache",    author: "@mc", ago: "2h" },
        { repo: "IsaacWrong/kestrel",   num: 14,  title: "Add Postgres adapter",            author: "@dani", ago: "5h" },
      ],
      yourOpen: [
        { repo: "IsaacWrong/ai-os",     num: 41,  title: "Drawer-style agent panel",        ago: "1d", checks: "passing" },
        { repo: "IsaacWrong/ai-os",     num: 39,  title: "KB lint: missing frontmatter",    ago: "3d", checks: "failing" },
      ],
      issues: [
        { repo: "IsaacWrong/trail",     num: 117, title: "iOS 18 layout regression in onboarding", ago: "6h" },
      ],
      notifications: 4,
    },

    // Daily note preview
    dailyNote: {
      path: "Daily/2026-05-12.md",
      lines: [
        "## 9:30 — Morning",
        "Slept ok. Coffee + 20m on the lint pass for KB; it lands clean now.",
        "",
        "## 11:00",
        "Pulled in Maya's edits on the agent drawer. The auto-scroll is too eager — needs",
        "an intent check before tailing.",
        "",
        "## Afternoon",
        "Redesign sweep. Want the dashboard to *breathe* more.",
      ],
      wordCount: 142,
    },

    // Projects
    projects: [
      { name: "ai-os",    accent: "tasks",    commits7: 24, openPRs: 2, lastCommit: "12m ago", weekHours: 11.4 },
      { name: "trail",    accent: "good",     commits7: 9,  openPRs: 1, lastCommit: "yesterday", weekHours: 4.2 },
      { name: "kestrel",  accent: "github",   commits7: 4,  openPRs: 1, lastCommit: "2d ago", weekHours: 1.1 },
      { name: "research", accent: "agent",    commits7: 0,  openPRs: 0, lastCommit: "—",       weekHours: 3.6 },
    ],

    // Agent categories
    categories: [
      { name: "Personal",    runs: 142 },
      { name: "AI OS",       runs: 318, active: true },
      { name: "Research",    runs: 51 },
      { name: "Trail",       runs: 27 },
      { name: "Kestrel",     runs: 9 },
      { name: "Sales",       runs: 4 },
    ],

    // Skills (quick-buttons)
    skills: [
      { name: "Morning brief",       hot: "⌘1" },
      { name: "Triage inbox",        hot: "⌘2" },
      { name: "Plan today",          hot: "⌘3" },
      { name: "Weekly review",       hot: "⌘4" },
      { name: "Reflect",             hot: "⌘5" },
      { name: "Stale tasks sweep",   hot: "⌘6" },
    ],

    // Usage / budget
    usage: {
      todayTokens: 47_320,
      todayCost: 1.82,
      weekTokens: 312_540,
      weekCost: 12.46,
      budget: 5.00,
      // 24 hourly buckets for sparkline (last 24h)
      tokensByHour: [120, 80, 60, 30, 20, 10, 10, 220, 1240, 3100, 4800, 2200, 1800, 6200, 5100, 4200, 3800, 6800, 5400, 0, 0, 0, 0, 0],
      // 14 days for the project heatmap
      productivity: [3.4, 4.2, 5.1, 0, 6.0, 4.4, 2.0, 3.8, 5.5, 4.9, 6.2, 7.1, 0, 3.1],
    },

    // Errors
    errors: [
      { tool: "gmail_archive",  msg: "401 — token expired",        ago: "8m"  },
      { tool: "kb_compile",     msg: "Broken wikilink in ai-os/wiki/index.md", ago: "2h" },
      { tool: "calendar_create_event", msg: "rate limited (retry in 30s)", ago: "5h" },
    ],

    // Weather
    weather: { temp: 67, label: "Partly cloudy", high: 72, low: 54, place: "Brooklyn" },

    // Streaks (fun stats)
    streaks: {
      dailyNote: 23,
      shipDays: 11,
      pomodorosToday: 4,
      pomodorosGoal: 6,
    },

    // ─── Per-project deep data ────────────────────────────
    projectDetail: {
      trail: {
        name: "trail",
        subtitle: "Offline-first hiking maps · iOS · TestFlight",
        accent: "good",
        status: "shipping v0.4",
        eta: "3 days to release",
        weekHours: 4.2,
        shipStreak: 11,
        // ── Stripe (placeholder shape, swap real keys later) ──
        stripe: {
          mrr: 1242,
          mrrDelta: "+8.4%",
          subscribers: 184,
          subscribersDelta: "+12",
          churn: 1.8,
          trialsActive: 23,
          // last 14 days MRR
          mrrTrend: [880, 910, 940, 980, 1010, 1020, 1050, 1090, 1110, 1140, 1160, 1180, 1210, 1242],
        },
        // ── Analytics (placeholder shape) ─────────────────
        analytics: {
          dau: 612,
          dauDelta: "+4.1%",
          sessionsPerUser: 3.4,
          retentionD7: 42,
          crashFree: 99.7,
          dauTrend: [420, 450, 470, 510, 530, 510, 540, 570, 580, 590, 600, 605, 610, 612],
        },
        // ── Tasks (project-filtered) ─────────────────────
        tasks: [
          { id: 1, text: "Fix iOS 18 layout regression in onboarding", due: "Today", prio: "high" },
          { id: 2, text: "Review v0.4 release notes",                  due: "May 16", prio: "med" },
          { id: 3, text: "Update App Store screenshots",                due: "May 16", prio: "med" },
          { id: 4, text: "Reply to TestFlight feedback (4)",            due: "—",     prio: "low" },
          { id: 5, text: "Cut the Mapbox dependency",                   due: "—",     prio: "low" },
          { id: 6, text: "Ship rate-limit fix",                         due: "—",     prio: "med", done: true },
        ],
        // ── GitHub (this repo only) ──────────────────────
        github: {
          repo: "IsaacWrong/trail",
          ci: "passing",
          openPRs: 2,
          openIssues: 7,
          pulls: [
            { num: 82, title: "Refactor offline tile cache", author: "@mc",    ago: "2h",  status: "review-requested" },
            { num: 80, title: "iOS 18 onboarding fix",       author: "@isaac", ago: "5h",  status: "yours-checks-failing" },
          ],
          issues: [
            { num: 117, title: "iOS 18 layout regression in onboarding", ago: "6h",  labels: ["bug", "P0"] },
            { num: 112, title: "Map tiles flicker on poor connection",   ago: "2d",  labels: ["bug"] },
          ],
          commits: [
            { sha: "0a7f3b2", msg: "fix: throttle tile prefetch under 3G",   author: "@isaac", ago: "12m" },
            { sha: "9d12c8e", msg: "wip: layout regression repro",            author: "@isaac", ago: "1h"  },
            { sha: "4e51a06", msg: "release v0.3.4 → TestFlight",             author: "@mc",    ago: "1d"  },
          ],
        },
        // ── Activity log (mixed sources) ──────────────────
        activity: [
          { kind: "github",   text: "Pushed 0a7f3b2 to main",                          ago: "12m" },
          { kind: "stripe",   text: "New subscriber · annual · $89.99",                ago: "47m" },
          { kind: "github",   text: "Opened PR #82 — Refactor offline tile cache",     ago: "2h"  },
          { kind: "agent",    text: "Drafted reply to TestFlight feedback (saved)",    ago: "3h"  },
          { kind: "analytics",text: "DAU crossed 600 for first time",                  ago: "8h"  },
          { kind: "github",   text: "Released v0.3.4 → App Store TestFlight",          ago: "1d"  },
          { kind: "stripe",   text: "MRR crossed $1,200",                              ago: "2d"  },
        ],
        // ── Project-scoped skills ─────────────────────────
        skills: [
          { name: "Plan v0.4 release",       hot: "⌘1" },
          { name: "Triage GitHub issues",    hot: "⌘2" },
          { name: "Draft changelog",         hot: "⌘3" },
          { name: "Summarize crash reports", hot: "⌘4" },
          { name: "Reply to TestFlight",     hot: "⌘5" },
          { name: "Status update",           hot: "⌘6" },
        ],
        // ── Agent thread (recent messages) ───────────────
        thread: [
          { who: "you",    at: "1:42 PM", text: "What's actually blocking v0.4?" },
          { who: "claude", at: "1:42 PM", text: "Two things on the critical path. iOS 18 layout regression on the onboarding screen — repro is in PR #80, checks failing on the snapshot tests. And updated App Store screenshots (4 of 8 are stale since the redesigned map screen). Crash reports from TestFlight have been clean since the rate-limit fix landed.", attachments: [
              { kind: "issue", label: "#117 iOS 18 layout regression" },
              { kind: "pr",    label: "#80 onboarding fix (checks failing)" },
          ] },
          { who: "you",    at: "1:43 PM", text: "Pull up the failing snapshot diff" },
          { who: "claude", at: "1:43 PM", text: "OnboardingScreen_iOS18.snap — the safe-area inset on the bottom CTA grew 16pt. Looks like UIScreen.main.bounds is returning the pre-rotation size on this device class. Want me to draft a fix that pins it to the keyWindow's safe-area instead, or open the file in Xcode?" },
        ],
      },
    },
  };
})();
