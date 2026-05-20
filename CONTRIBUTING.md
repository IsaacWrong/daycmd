# Contributing to Daycmd

Pre-1.0. Small focused PRs welcome.

## Dev setup

```bash
git clone https://github.com/IsaacWrong/daycmd.git
cd daycmd
npm install
cp .env.local.example .env.local
# minimum to boot: VAULT_PATH + ANTHROPIC_API_KEY
# point VAULT_PATH at examples/sample-vault/ to skip Obsidian setup
npm run dev
```

Open `http://localhost:3000`. The dashboard reloads on file save. The scheduler boots from `instrumentation.ts`; KB compile/lint automations seed on first run.

## Before you open a PR

Run all four, each should pass:

```bash
npx tsc --noEmit          # typecheck
npm run lint              # eslint (next/core-web-vitals + next/typescript)
npm test                  # vitest
npm run build             # production build
```

The lint baseline is intentionally permissive — several React 19 hook rules (`react-hooks/set-state-in-effect`, `react-hooks/purity`, `react-hooks/refs`) are downgraded to warnings because the codebase has a handful of legit external-state-sync patterns that will be refactored incrementally. Tighten in focused follow-up PRs rather than bundling rule changes with feature work.

## Commit style

- Imperative, ≤50 chars on the subject line, blank line before body.
- Body wraps at ~72 chars.
- Reference issues / PRs by number where relevant.
- Keep one logical change per commit. Squash on merge.

## Architecture cheatsheet

- `src/app/` — Next.js app router. `page.tsx` (home), `projects/[name]/page.tsx`, `settings/page.tsx`, plus `api/` route handlers.
- `src/components/redesign/` — every UI primitive (`TodFrame`, `Masthead`, `AgentBar`, `FocusTile`, `Section`, `Sparkline`, `Glyph`, etc.). The folder name is historical; treat it as the canonical components dir.
- `src/lib/` — server-side logic: agent loop, KB compile + lint, Obsidian read/write, GitHub/Gmail/Calendar adapters, SQLite, scheduler.
- `data/secrets.db` — local SQLite (gitignored). Auto-bootstraps schema on first run; legacy `ai-os.db` or `daycmd.db` is auto-renamed.
- `examples/sample-vault/` — minimal vault for testing without your own Obsidian setup.

## Patterns to follow

- **All TOD-aware colors come from CSS variables** (`var(--bg-a)`, `var(--fg)`, `var(--c-tasks)`, etc.) in `globals.css`. Don't introduce raw `#hex` or Tailwind palette colors.
- **No `dark:` Tailwind variants.** The `.tod-*` classes swap variables; `dark:` would fight that.
- **Eyebrow + title + hairline rule** is the section pattern — no card chrome.
- **Vault is canonical.** SQLite + localStorage are caches. New persistence should write to the vault first if it represents something the user owns (notes, tasks, lint findings).
- **`zod` schemas at every API boundary.**
- **Migrate, don't break.** If you rename a localStorage key or DB column, add a one-shot migration in `lib/ls-migrate.ts` or `lib/db.ts`'s bootstrap block.

## Patterns to avoid

- Don't add `dark:` variants or `bg-zinc-*` classes — TOD palette handles theming.
- Don't add agent tools without surfacing the side effect (file write, email send) in the README safety section.
- Don't seed automations that aren't idempotent — `ensureDefaultKbAutomations` is the reference pattern.

## Extending daycmd

Three common extension shapes. Each is intentionally short — read the referenced files for the full pattern.

### Add a new agent tool

Tools are what Claude can *do* (read files, send mail, hit GitHub). Each lives as one entry in the `tools` array plus one `case` in the `runTool` dispatcher.

1. Append a new entry to the `tools` array in `src/lib/agent-tools.ts` (name, description, JSON-schema `input_schema`).
2. Add a matching `case "<name>":` to `runTool` in the same file. Validate inputs with `zod` and return a string (or JSON-stringified object).
3. If the tool needs special framing (e.g. "always call X before Y"), update `SYSTEM_PROMPT` in `src/lib/agent.ts`.
4. Files: `src/lib/agent-tools.ts`, `src/lib/agent.ts` (system prompt only if behavior changes), README **Safety** section if the tool writes to user data.

### Add a new user-facing skill

Skills are the `⌘1`–`⌘6` buttons in the agent bar — preset prompts with model/effort/maxTokens defaults.

1. Append a new `SkillDef` to `SKILLS` in `src/lib/skills-defs.ts` with a unique `id`, a `category` (e.g. `"Personal"`, `"Research"`), and the locked-in `prompt`.
2. `SkillStrip` (`src/components/redesign/agent-bar/SkillStrip.tsx`) auto-picks the first 6 skills whose `category` matches the current category, so order matters within a category.
3. Files: `src/lib/skills-defs.ts`. No component changes needed unless you want a non-default presentation.

### Add a new automation row

Automations are cron-scheduled agent runs persisted in SQLite and reloaded on edit.

1. If you want it seeded on first boot, add an entry next to `ensureDefaultKbAutomations` in `src/lib/automations.ts` — use that function as the idempotent reference.
2. Otherwise insert via the existing CRUD helpers (`createAutomation`, etc.). Schema lives in `src/lib/db.ts` (`automations` + `automation_runs` tables).
3. Cron strings use [`node-cron`](https://www.npmjs.com/package/node-cron) syntax (5-field, local time). The scheduler only runs when `ENABLE_SCHEDULER=1` (see `instrumentation.ts`).
4. Files: `src/lib/automations.ts`, optionally `src/lib/db.ts` if a new column is needed (add an `ALTER TABLE` migration in the bootstrap block).

## Reporting bugs / requesting features

Use GitHub issues. For bugs, include:
- Node version (`node -v`)
- Vault path (or "sample-vault")
- Reproduction steps
- Browser + console errors

## License

By contributing, you agree your changes are released under the project's MIT license.
