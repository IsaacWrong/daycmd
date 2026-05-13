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

Run both, both should pass:

```bash
npx tsc --noEmit          # typecheck
npm run build             # production build
```

There is no eslint config yet — TypeScript strictness is the only static gate. If you add one, please make it a separate PR.

## Commit style

- Imperative, ≤50 chars on the subject line, blank line before body.
- Body wraps at ~72 chars.
- Reference issues / PRs by number where relevant.
- Keep one logical change per commit. Squash on merge.

## Architecture cheatsheet

- `src/app/` — Next.js app router. `page.tsx` (home), `projects/[name]/page.tsx`, `settings/page.tsx`, plus `api/` route handlers.
- `src/components/redesign/` — every UI primitive (`TodFrame`, `Masthead`, `AgentBar`, `FocusTile`, `Section`, `Sparkline`, `Glyph`, etc.). The folder name is historical; treat it as the canonical components dir.
- `src/lib/` — server-side logic: agent loop, KB compile + lint, Obsidian read/write, GitHub/Gmail/Calendar adapters, SQLite, scheduler.
- `data/daycmd.db` — local SQLite (gitignored). Auto-bootstraps schema on first run; legacy `ai-os.db` is auto-renamed.
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

## Reporting bugs / requesting features

Use GitHub issues. For bugs, include:
- Node version (`node -v`)
- Vault path (or "sample-vault")
- Reproduction steps
- Browser + console errors

## License

By contributing, you agree your changes are released under the project's MIT license.
