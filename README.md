# AI OS

Personal dashboard for daily admin + side-project ops. Local-only Next.js app, designed as a new-tab landing page.

Aggregates:

- **Obsidian** — tasks from `Tasks/` folder, daily note (read + write)
- **Gmail + Google Calendar** — inbox triage, upcoming events
- **GitHub** — review-requested PRs, your open PRs, assigned issues, unread notifications
- **Agent panel** — Claude Opus 4.7 with tools (read your tasks, write to daily note, etc.), streaming + prompt caching, skill quick-buttons (Morning Brief, Triage Inbox, Plan Today, Weekly Review)
- **Automations** — cron-scheduled agent runs, live status + recent runs, usage + cost
- **Usage tracking** — per-day and 7-day token totals + cost estimate, persisted in SQLite

## Stack

Next.js 16, React 19, TypeScript, Tailwind v4, SQLite (better-sqlite3), `@anthropic-ai/sdk`, `googleapis`, `octokit`, `node-cron`, `gray-matter`, `date-fns`, `zod`.

## Setup

```bash
git clone <this-repo>
cd ai-os
npm install
cp .env.local.example .env.local
# fill in VAULT_PATH, optionally GITHUB_TOKEN, GOOGLE_*, ANTHROPIC_API_KEY
npm run dev
```

Visit `http://localhost:3000`.

### Required

- `VAULT_PATH` — absolute path to your Obsidian vault. Tasks read from `<VAULT_PATH>/Tasks/*.md`. Daily note at `<VAULT_PATH>/Daily/YYYY-MM-DD.md`.

### Optional (each feed degrades gracefully if not configured)

- `GITHUB_TOKEN` — classic PAT, scopes: `repo`, `notifications`, `read:user`
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` — OAuth client, redirect `http://localhost:3000/api/auth/google/callback`. Click "Connect Google" in the UI to authorize.
- `ANTHROPIC_API_KEY` — required for the agent panel + automations

## Architecture notes

- All feeds use direct API libs (not MCP) for daemon-style reads
- OAuth tokens, automations, runs, and usage all persist in `data/ai-os.db` (gitignored)
- Scheduler boots via `instrumentation.ts` (`node-cron`), reloads on automation create/update/delete
- Obsidian Tasks plugin format supported: `- [ ]` checkboxes with emoji metadata (`📅` due, `🛫` start, `⏳` scheduled, `✅` done, `❌` cancelled, `⏫` priority, `🔁` recurrence)
- Daily note edits debounce-save every 600ms; external Obsidian edits are picked up on next poll (30s)
