<div align="center">

# Daycmd

**A local-first, agent-driven new-tab page for people juggling a vault, a job, and three side projects.**

Opens with your browser. Knows your day. Routes the work through Claude.

<!-- Replace with a 30-second screen recording or hero gif. -->
<!-- ![Daycmd — hero](docs/hero.gif) -->

</div>

---

## What it is

A single Next.js app that runs on `localhost`, reads your Obsidian vault, your Gmail, your Calendar, your GitHub, and your Anthropic spend, and gives you one page that opens with the browser every morning. A Claude agent sits in the dock. Skills (`⌘1`–`⌘6`) trigger brief / triage / plan / stale / reflect / capture flows on the default `Personal` category. Focus mode dims everything except the work in front of you. The background gradient shifts with the hour.

It is not Notion. It is not a workspace. It is a calm command center — read this, do this, talk to Claude about it.

## What it does

**Home · Almanac**
- Time-of-day palette: dawn → morning → noon → afternoon → dusk → night → deep. CSS variables, no JS animation, recomputed every 10 min.
- **Focus tile** — pomodoro w/ persisted state. 4th completion appends to today's daily note.
- **Today in numbers** — spend / tokens / tasks closed / commits / GitHub open / note words. Each w/ inline sparkline.
- **Streaks** — daily-note + ship streak, walked from vault + commit history.
- **Heatmap** — last 14 days of commits across every repo you push to (events feed + vault repos, deduped by sha).
- **Now hero + day strip** — current calendar block + an absolutely-positioned timeline w/ now-marker punch-through.
- **Tasks** — Obsidian Tasks plugin parser (`📅 due`, `🛫 start`, `⏫ priority`, `🔁 recurrence`); inline check-off writes back to the vault. Bucketed Overdue / Today / Upcoming / Someday.
- **Daily note** — read-only preview on home; "Continue writing" opens a focused glass-modal editor w/ autosave + ⌘S + mtime conflict handling.
- **Right streams** — Calendar (Today/Tomorrow/Later subheaders), Inbox, GitHub PRs, Knowledge w/ drift + run, Errors w/ ✓ dismiss.
- **Agent dock** — bottom-fixed wide bar w/ ⌘J drawer + skill hotkeys.

**Project view (`/projects/[name]`)**
- Breadcrumb masthead.
- Hero stats row: MRR / subscribers / DAU / retention / crash-free / week hours. Stripe + analytics endpoints mocked behind real routes — wire to your account when ready.
- Project-scoped tasks, GitHub (PRs / commits / CI status), activity log.
- Right column = agent workspace. Per-project category, skill strip scoped to the project.

**Agent**
- Streaming Claude Opus 4.7 (per-skill override to Sonnet 4.6 / Haiku).
- Per-category threads — each gets its own message history + container + raw/ log.
- Drag/paste/picker for image, PDF, text attachments.
- ⌘J drawer to expand. Stop button mid-stream.
- Tools: Obsidian read/write, Gmail (read/archive/draft/send/unsubscribe), Calendar (read/create/reschedule), GitHub summary, KB query/grep/ingest/write, web search/fetch.

**Knowledge base (Karpathy 3-tier)**
Per category:
- `raw/` — every agent run auto-logged (prompt + output + tool trace).
- `wiki/` — compiled INDEX + concept + people + source pages.
- `output/` — polished deliverables.

Compile + lint run automatically (when the scheduler is enabled — see `ENABLE_SCHEDULER` below):
- **Cron · 06:00 daily** — compile per category.
- **Cron · 06:30 daily** — lint per category.
- **Dashboard mount** — stale sweep: any category with drift and last compile > 6h triggers compile → lint chain. (Runs on dashboard load regardless of `ENABLE_SCHEDULER`.)
- **Manual** — `run` button per category in the Knowledge section.

Lint findings flow into the Errors section + mirror to `Errors/{date}.md` in the vault.

**Errors**
- DB + vault dual-write (cross-device durable via Obsidian Sync).
- ✓ dismiss per row.
- `POST /api/errors/backfill` rebuilds the vault log from DB.

**Automations**
- `node-cron` scheduler, persisted in SQLite, reloads on edit.
- Default KB compile + lint rows seeded on first boot, one per category.
- Custom agent automations supported via DB (UI pending).

**Settings**
- Daily Anthropic spend cap. Warn at configurable %. Hard-block past cap.
- Default agent category.
- Google OAuth connect/disconnect.

## Why it might be for you

- You live in Obsidian and want the vault to stay canonical.
- You have multiple side projects and lose track of which one needs you today.
- You want an agent that *does the work* (triage, compile, lint, summarize), not just chats about it.
- You'd rather see a calm document than a 4-column Bento grid of widgets.
- You're fine running a local Next.js server. You bring your own Anthropic key.

## Why it might not be for you

- You're on mobile only — this is browser-tab-on-desktop.
- You don't use Obsidian or a markdown vault — every feature reads/writes files on disk.
- You want multi-user / multi-device sync out of the box — this is solo, vault-via-Obsidian-Sync.
- You want a polished SaaS — this is open-source you'll occasionally have to debug.

## ⚠ Before you run it

Daycmd's agent has tools that **write to your Obsidian vault, send / archive Gmail, and create Google Calendar events**. Before pointing it at a real vault or live accounts:

- **Back up your vault.** Use Obsidian Sync, git, or Time Machine. The agent edits files (creates tasks, appends to the daily note, writes KB pages, marks tasks done). Mistakes happen.
- **Set a budget cap in `/settings` before the first long-running skill.** Daily cap defaults to `$0` (unlimited). Forgetting to set one and running a few `Triage Inbox` skills in a row could cost real money.
- **Try the bundled sample vault first.** Point `VAULT_PATH` at [`examples/sample-vault/`](examples/sample-vault/) to kick the tires — no risk to your real notes.
- **Connect Google / GitHub *last*.** They unlock send-email and write-calendar tools; until you connect them, every feed degrades gracefully.

## Quickstart

```bash
git clone https://github.com/IsaacWrong/daycmd.git
cd daycmd
npm install
echo 'VAULT_PATH="'"$PWD"'/examples/sample-vault"' > .env.local
npm run dev
```

Open `http://localhost:3000/setup`. The first-run wizard writes the rest of your keys to `.env.local`, validates the vault path, and links you to the dashboard. Restart `npm run dev` after saving — Next caches `process.env` at boot.

Once `/setup` shows **ready**, open `http://localhost:3000` and pin as your new-tab page.

> **Prefer to edit by hand?** `cp .env.local.example .env.local` and fill in `VAULT_PATH` + `ANTHROPIC_API_KEY` at minimum.
>
> **Don't have an Obsidian vault?** The bundled [`examples/sample-vault/`](examples/sample-vault/) is the safest starting point. The agent will write into it as you use it — copy first if you want to keep the sample pristine.

### Required

| Env | Purpose |
|---|---|
| `VAULT_PATH` | Absolute path to your Obsidian vault. Tasks read from `<VAULT_PATH>/Tasks/*.md`; daily notes from `<VAULT_PATH>/Daily/YYYY-MM-DD.md`; KB categories at `<VAULT_PATH>/Categories/<Name>/{raw,wiki,output}/`. |
| `ANTHROPIC_API_KEY` | Required for agent, skills, KB compile/lint. |

### Optional (each feed degrades gracefully when absent)

| Env | Purpose |
|---|---|
| `GITHUB_TOKEN` | Classic PAT w/ scopes `repo`, `notifications`, `read:user`. Powers GitHub section, ship streak, heatmap. |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | OAuth web client. Redirect URI `http://localhost:3000/api/auth/google/callback`. Click *Connect Google* in `/settings` to authorize Gmail + Calendar. |

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind v4 (`@theme inline` design tokens) · SQLite via `better-sqlite3` · `@anthropic-ai/sdk` · `googleapis` · `octokit` · `node-cron` · `gray-matter` · `date-fns` · `zod`.

## Architecture notes

- **Vault-as-truth.** All notes, tasks, daily entries, KB pages, and lint output live as markdown in the vault. Open them in Obsidian, edit them in Vim, sync via Obsidian Sync or git. Daycmd reads + writes through plain `fs`.
- **SQLite is a fast cache.** `data/secrets.db` holds OAuth tokens, usage rows, automations, error log, agent threads. Gitignored. Errors are also mirrored to `Errors/{date}.md` in the vault for cross-device durability. A legacy `ai-os.db` or `daycmd.db` is auto-renamed on first run.
- **Per-device append-only logs live OUTSIDE `.obsidian/`.** AI usage, error rows, automation runs, and KB compile records are written to `<VAULT_PATH>/daycmd/logs/<hostname>/<table>.ndjson`. Each device writes only its own file (no merge conflicts); reads union across all device folders. The path is deliberately *not* under `.obsidian/` because Obsidian Sync excludes most of `.obsidian/` by default — putting logs there caused AI spend to diverge across devices. Settings JSON still lives at `<VAULT_PATH>/.obsidian/daycmd/*.json` (Obsidian Sync's plugin-config toggle covers it). On first run after upgrading, any legacy `<VAULT_PATH>/.obsidian/daycmd/logs/` data is auto-migrated to the new location.
- **Time-of-day palette via CSS vars.** `.tod-*` classes on `.daycmd-frame` swap `--bg-a`, `--fg`, `--rule`, `--glass`, orb colors, etc. No `dark:` Tailwind variants anywhere.
- **OKLCH-relative colors throughout** (`oklch(from var(--fg) l c h / 0.1)`). Tailwind v4 + modern browsers.
- **Scheduler boots from `instrumentation.ts`** only when `ENABLE_SCHEDULER=1` is set in the environment. Leave it unset during foreground `npm run dev` to avoid duplicate cron firings; set it for the launchd service (`scripts/com.daycmd.server.plist.example`) or when you want to test crons locally. Default KB compile + lint rows are seeded per category on first run (idempotent). Stale-sweep endpoint at `POST /api/kb/auto-compile`.
- **All input validated through `zod` schemas at API boundaries.**
- **Daily-note ensure**: `GET /api/obsidian/daily` lazily renders today's note from your `.obsidian/daily-notes.json` template if missing. Moment-style tokens (`{{date:dddd}}` etc.) are mapped to date-fns.

## Roadmap (rough, in priority order)

- Idea capture modal (⌘K)
- In-app PR / issue drawer

A bundled launchd plist template (`scripts/com.daycmd.server.plist.example`) keeps the dev server alive on port `3210` so the 06:00 KB compile + lint cron survives sleep. Materialize w/ `sed` (paths inside the example file's header) and `launchctl load` it.

## Safety / cost

- The agent has tools that **write to your vault, send email, archive Gmail messages, and create calendar events.** Back up your vault. Set a budget cap in `/settings` before the first long-running skill.
- Hard daily cap blocks new agent runs once exceeded. Default `$0` = unlimited; set one.
- Anthropic key, GitHub PAT, Google tokens all stay local (env file + SQLite). Nothing leaves your machine except the API calls themselves.

## Contributing

Pre-1.0. Issues and PRs welcome — keep them small and focused. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for dev setup, patterns, and conventions.

## Support the project

Daycmd is MIT-licensed and built in spare hours. If it's earned a spot in your new-tab page, you can help keep it that way:

- [GitHub Sponsors](https://github.com/sponsors/IsaacWrong) — recurring, GitHub takes no cut.
- [Buy Me a Coffee](https://www.buymeacoffee.com/isaacwrong) — one-time tip.
- Star the repo, file a thoughtful issue, or send a small focused PR — equally appreciated and arguably more useful.

## License

MIT. See `LICENSE`.

## Acknowledgements

- Design language inspired by editorial calm + Raycast's command-bar UX.
- KB three-tier (`raw/wiki/output`) shape is a riff on Andrej Karpathy's notes-on-notes post.
- Obsidian + Tasks plugin + Daily Notes core plugin do the heavy lifting on the vault side.
