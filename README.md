# AI OS

Personal command center that opens as a new-tab page. Local Next.js app. Aggregates inbox, calendar, tasks, notes, GitHub, and side-project state, and puts a tool-using Claude agent in front of all of it.

Single user. Local-only. Built for me, not for production.

## What it does

### Dashboard cards
- **Now / Next** — current + next calendar block, with countdown
- **Tasks** — Obsidian Tasks plugin parser (📅 due, 🛫 start, ⏫ priority, 🔁 recurrence); inline check-off writes back to the vault
- **Daily Note** — debounced editor (600ms) bound to `<vault>/Daily/YYYY-MM-DD.md`; external Obsidian edits picked up on poll
- **Calendar** — all calendars (primary, shared, subscribed, secondary), next 24h
- **Gmail** — inbox triage feed
- **GitHub** — review-requested PRs, your open PRs, assigned issues, unread notifications
- **Projects** — vault-backed project pages with last commit + weekly commit count + open PR count per linked repo; drop-in idea capture appends to each project's note
- **Knowledge** — recent compiled wiki pages + output deliverables per category
- **Errors** — recent agent/tool errors with sparkline
- **Weather badge** — geolocation → reverse-geocode (BigDataCloud) → Open-Meteo; refreshes every 15 min
- **Usage strip** — today's + 7-day Claude token totals, cost estimate, hard daily budget cap

### Agent panel
- Streaming Claude Opus 4.7 (per-skill override to Sonnet 4.6 / Haiku)
- Per-category threads (Personal, Research, Sales, project names, …) — each category has its own message history + container + raw/ log
- **Drag-drop / paste / picker** for attachments — images, PDFs, text files all routed to proper Anthropic content blocks
- **⌘J drawer** — expand chat to right-side drawer, Esc to close
- **Stop** button mid-stream — abort in-flight runs
- Skill quick-buttons (sidebar): Morning Brief, Triage Inbox, Plan Today, Weekly Review, Quick Capture Route, Stale Tasks Sweep, Reflect, LinkedIn Post, etc.
- Live category refresh — picks up new categories on focus / visibility / 60s

### Tools the agent has
- **Obsidian:** `get_tasks`, `task_create`, `task_done`, `append_to_daily_note`, `read_past_daily_notes`
- **Gmail:** `get_inbox`, `gmail_get_message`, `gmail_archive`, `gmail_mark_read`, `gmail_star`, `gmail_trash`, `gmail_draft_reply`, `gmail_create_draft`, `gmail_send`, `gmail_unsubscribe` (RFC 2369/8058 List-Unsubscribe, requires confirmation)
- **Calendar:** `get_calendar`, `calendar_create_event`, `calendar_reschedule_event`
- **GitHub:** `get_github_summary`
- **Knowledge base:** `kb_query`, `kb_read_wiki_page`, `kb_grep`, `kb_list_outputs`, `kb_ingest`, `kb_write_output`
- **Web:** server-hosted `web_search` + `web_fetch`

### Knowledge base (Karpathy 3-tier)
Per category, the vault holds:
- `raw/` — every agent run auto-logged (prompt + output + tool trace)
- `wiki/` — compiled INDEX + concept + people + source pages (compile is a separate user-triggered pass; lints for broken wikilinks, missing frontmatter raws, filename-mirror drift)
- `output/` — polished deliverables the agent wrote

### Automations
- Cron-scheduled agent runs (`node-cron`) — define in DB, scheduler boots via `instrumentation.ts`, reloads on create/update/delete
- Status + recent runs + cost per automation

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind v4 · SQLite (`better-sqlite3`) · `@anthropic-ai/sdk` · `googleapis` · `octokit` · `node-cron` · `gray-matter` · `date-fns` · `zod`

## Setup

```bash
git clone https://github.com/IsaacWrong/ai-os.git
cd ai-os
npm install
cp .env.local.example .env.local
# fill in VAULT_PATH (required), plus GITHUB_TOKEN / GOOGLE_* / ANTHROPIC_API_KEY as desired
npm run dev
```

Open `http://localhost:3000`. Pin as new-tab page.

### Required env
- `VAULT_PATH` — absolute path to your Obsidian vault. Tasks read from `<VAULT_PATH>/Tasks/*.md`. Daily note at `<VAULT_PATH>/Daily/YYYY-MM-DD.md`. Categories at `<VAULT_PATH>/Categories/<Name>/{raw,wiki,output}/`.

### Optional env (each feed degrades gracefully)
- `GITHUB_TOKEN` — classic PAT, scopes `repo`, `notifications`, `read:user`
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` — OAuth web client, redirect `http://localhost:3000/api/auth/google/callback`. Click "Connect Google" in the UI to authorize.
- `ANTHROPIC_API_KEY` — required for the agent panel + automations

## Architecture notes

- All feeds use direct API libs (not MCP) for daemon-style reads
- OAuth tokens, automations, runs, usage, settings persist in `data/ai-os.db` (gitignored)
- Vault writes use atomic temp-file + rename to survive concurrent Obsidian edits
- Daily note edits debounce-save every 600ms; external edits picked up on next poll (30s)
- Tasks plugin format respected: `- [ ]` checkboxes with `📅 YYYY-MM-DD` due, `🛫` start, `⏳` scheduled, `✅` done, `❌` cancelled, `⏫`/`🔼`/`🔽` priority, `🔁` recurrence
- Hard daily budget cap blocks new agent runs once exceeded (raise in Settings)
- All input passes through `zod` schemas at API boundaries

## Why

Most "AI dashboards" assume you live inside their app. I live inside Obsidian, Gmail, Calendar, and GitHub. AI OS reaches into those — read and write — and gives me a single page that opens with my browser.

## License

No license. Personal project. Fork freely; expect no support.
