@AGENTS.md

# Audit-issue workflow

When auditing or reviewing the codebase (security, UI/UX, accessibility,
architecture, performance, testing, documentation, or any other category),
file each finding as a GitHub issue in `IsaacWrong/daycmd` via the
`mcp__github__issue_write` tool. Do this as the findings come in — don't
batch a session's worth of audit work into a single mega-issue or a chat
summary that disappears.

Conventions:

- **Title**: `[Category] short imperative description` (e.g.
  `[Security] Validate tool inputs with zod before dispatch`).
- **Body**: severity, `file:line` citation, what's wrong, fix sketch.
  Keep it concrete — no "consider improving X" filler.
- **Granularity**: one issue per substantive finding. Group genuinely
  trivial / polish items into a single per-category tracker issue with a
  checklist body.
- **Labels**: apply existing repo labels where they match. Don't invent
  new labels without checking the existing set first.
- **Source attribution**: include a short footer like
  `_Source: codebase audit, <date>._` so it's clear these came from a
  review pass.

Skip issues only when the finding is already filed (search first via
`mcp__github__list_issues` / `search_issues`) or when the "fix" is actually
"this is intentional, document it" — in which case the issue is still
useful but should be labeled accordingly.
