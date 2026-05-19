# Changelog

All notable changes to Daycmd are tracked here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is
[SemVer](https://semver.org/spec/v2.0.0.html) — pre-1.0, so minor bumps may
contain breaking changes.

## [Unreleased]

### Added

- `.github/FUNDING.yml` — GitHub Sponsors + Buy Me a Coffee links surface the repo's Sponsor button.
- `.github/PULL_REQUEST_TEMPLATE.md` — summary / test plan / checklist tied to `CONTRIBUTING.md`.
- `.github/dependabot.yml` — weekly grouped npm + github-actions updates; major bumps for `next` / `react` / `react-dom` land separately.
- README **Support the project** section.

## [0.1.1] - 2026-05-19

### Fixed

- `scripts/com.daycmd.server.plist` baked `/Users/isaacwright/...` into `WorkingDirectory` + `StandardOut/Err` paths, leaking the maintainer's home dir. launchd does not expand `${HOME}`, so the file is now shipped as `scripts/com.daycmd.server.plist.example` w/ `__USER_HOME__` + `__REPO_PATH__` placeholders. Materialize via the `sed` snippet in the template header, then `launchctl load`. The materialized plist is gitignored.

## [0.1.0] - 2026-05-19

Initial public release.

### Highlights

- Home dashboard: time-of-day palette, focus tile (pomodoro w/ daily-note write-back), today-in-numbers w/ sparklines, daily + ship streaks, 14-day commit heatmap, now-hero + day strip, Obsidian Tasks plugin parser w/ inline check-off, daily-note preview + glass-modal editor.
- Right streams: Calendar (Today / Tomorrow / Later), Inbox, GitHub PRs, Knowledge w/ drift + run, Errors w/ ✓ dismiss.
- Project view (`/projects/[name]`): breadcrumb masthead, hero stats (MRR / DAU / retention / crash-free / week hours), project-scoped tasks + GitHub + activity, per-project agent workspace.
- Agent: streaming Claude Opus 4.7 (per-skill Sonnet / Haiku override), per-category threads, drag/paste/picker attachments, ⌘J drawer, stop button, ambient micro-AI surfaces (morning brief, today-line, smart-rank, event prep, inbox synopsis, project narrative, blockers, daily ghost, pomo capture).
- Tools: Obsidian read/write, Gmail (read/archive/draft/send/unsubscribe, thread-scoped), Calendar (read/create/reschedule), GitHub summary, KB query/grep/ingest/write, web search/fetch, error-log + wiki write.
- Knowledge base: three-tier `raw/wiki/output` per category. 06:00 compile + 06:30 lint cron. Stale sweep on dashboard mount. Manual `run` per category. Lint findings mirror to `Errors/{date}.md`.
- Errors: DB + vault dual-write, ✓ dismiss, `POST /api/errors/backfill`.
- Automations: `node-cron` scheduler in SQLite, reloads on edit, default KB rows seeded idempotently on first boot.
- Settings: daily Anthropic spend cap (warn % + hard block), default agent category, Google OAuth connect/disconnect.
- Setup wizard (`/setup`) writes `.env.local`, validates vault path.
- macOS launchd plist (`scripts/com.daycmd.server.plist`) — keeps dev server up on `:3210` so 06:00 cron survives sleep.
- Kernel browser smoke script (`scripts/kernel-smoke.mjs`).

[Unreleased]: https://github.com/IsaacWrong/daycmd/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/IsaacWrong/daycmd/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/IsaacWrong/daycmd/releases/tag/v0.1.0
