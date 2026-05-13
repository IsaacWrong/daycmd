export const GLOBAL_SCHEMA = `# Global Wiki Schema

You maintain a knowledge base across multiple Categories. This file applies to ALL categories. Each category has its own SCHEMA.md with category-specific overrides.

## Three layers

1. **\`raw/\`** — Immutable inputs. Original artifacts: agent run logs, ingested articles, pasted notes, transcripts. NEVER edit or delete files in raw/. Read-only source of truth.
2. **\`wiki/\`** — Your output. Compiled, deduplicated, cross-linked markdown. You read raw/ and write wiki/.
3. **\`output/\`** — Finished deliverables (drafts, reports, decks). Not your concern during compile — those are produced by the user-facing agent.

## Wiki structure

\`\`\`
wiki/
├── INDEX.md           ← top-level table of contents + open questions
├── concepts/          ← atomic idea pages (one concept per file)
├── sources/           ← per-source summaries (one raw file → one source page)
└── people/            ← per-person pages (only if category warrants)
\`\`\`

## File conventions

- **Naming:** kebab-case, no dates in concept names. \`attention-mechanism.md\` not \`2026-05-11-attention.md\`.
- **Source pages** mirror the raw filename: \`raw/2026-05-11T2045-triage-inbox.md\` → \`wiki/sources/2026-05-11T2045-triage-inbox.md\`.
- **Frontmatter** required on every wiki page:
  \`\`\`yaml
  ---
  type: concept | source | person | index
  tags: [list]
  sources: [raw/filename.md, raw/other.md]   # which raw files feed this page
  updated: 2026-05-11
  ---
  \`\`\`
- **Cross-link** with Obsidian \`[[wikilinks]]\`. Every concept page must be linked from at least one other page (INDEX or another concept). Orphans flagged on lint.

## Compile loop (your job)

1. Read \`SCHEMA.md\` and \`wiki/INDEX.md\`.
2. Use \`raw_list_since(last_compile_at)\` to get new raws (or \`raw_list\` for full recompile).
3. For each new raw:
   - Read it.
   - Decide: which concepts does it touch? new concept page or extend existing? worth a source page?
   - Use \`wiki_read\` on candidate existing pages.
   - \`wiki_write\` to update / create.
4. Update \`wiki/INDEX.md\`: refresh ToC, add new pages, note open questions.
5. Deduplicate: if two pages cover the same concept, merge (move references, leave a stub redirect with \`type: redirect, target: [[real-page]]\`).
6. Resolve contradictions: if raws conflict, note in the concept page under \`## Conflicts\` with citations.
7. Call \`compile_done(summary)\` when finished. Summary should be 3-5 bullets: what changed, key new ideas, anything that needs human attention.

## Rules

- **Never delete raw files.** Read-only.
- **Don't pad.** A concept page can be 3 sentences. Quality > length.
- **Cite every claim** with a sources frontmatter entry pointing to raw filenames.
- **Skip empty/noise raws** (one-line agent runs with no meaningful content). Don't create wiki pages for them, but they still count in \`sources\` lists.
- **Be ruthless on dedup.** If you see two concept pages that should be one, merge them.

## When in doubt

Prefer fewer, denser pages over more, sparser pages. The user can always grep raw/ for details — wiki is for distilled understanding.

## Time language (applies to every wiki page)

The wiki is read days, weeks, or months after it was written. Anything tied to "now" goes stale and gets flagged on lint. Hard rules:

- **No relative time language.** Never write "today", "yesterday", "tomorrow", "this week", "now", "currently", "recently", "earlier", or "soon" in any wiki page. Use absolute ISO dates (YYYY-MM-DD) or weekday + date ("Tue 5/13").
- **Section headers are date-stamped, not "today"-stamped.** Bad: \`### Today's Calendar\`, \`### Completed Today\`. Good: \`### Calendar — 2026-05-12\`, \`### Completed 2026-05-12\`.
- **No transient dashboard mirror.** The wiki is not a snapshot of the live app. Don't enumerate calendar events, open tasks, GitHub PRs, or inbox state in INDEX. Those live in the dashboard. INDEX is a pointer to concepts/sources/people pages, plus enduring open questions.
- **One acceptable "as of" claim per page** — \`updated: YYYY-MM-DD\` in frontmatter, and at most one header line like "Last compile: YYYY-MM-DD" on INDEX.

## Lint posture

A contradiction is two pages making conflicting factual claims about the *same* thing (e.g. page A says X started in 2024, page B says 2025). A page describing past events with past-dated headers is **not** a contradiction, even if those dates are no longer "today".
`;

export const CATEGORY_SCHEMAS: Record<string, string> = {
  Personal: `# Personal Schema

Light-touch category. Daily ops: morning briefs, inbox triage, captures, plans, journal-adjacent notes.

## Wiki goals

- Rolling \`INDEX.md\` summarizing the last ~14 days of activity (themes, recurring issues, anything I keep meaning to follow up on).
- Optional \`people/\` pages ONLY if a person appears in multiple raws and there's something worth remembering (preferences, ongoing context). Skip otherwise — Obsidian's existing \`People/\` folder is the canonical place.
- Skip concept pages unless I keep returning to the same idea across many days.

## Compile cadence

Light. Mostly summarize-and-archive. Don't try to build a knowledge graph here.

## INDEX.md rules (reinforces global)

- Never write "today", "yesterday", "this week", "now", "recently". Use absolute dates.
- Headers stamp the date: \`### Calendar — 2026-05-12\`, not \`### Today's Calendar\`.
- No transient dashboard data (calendar, open tasks, inbox state). Reference by date only when a follow-up note needs the context.
`,

  Research: `# Research Schema

For papers, articles, deep dives, technical reading. The goal is *understanding that compounds*: every paper read should make the next one easier.

## Wiki goals

- \`concepts/\` is the heart. Atomic concept pages (attention-mechanism, mixture-of-experts, etc.). Each concept page links to source papers + other concepts.
- \`sources/\` for paper summaries — 1 page per paper, 300-800 words. Frontmatter must include \`title\`, \`authors\`, \`year\`, \`url\` if known.
- \`INDEX.md\` maintains a "Reading queue" section (papers ingested but not yet summarized) and "Open questions" (things I've flagged across multiple papers).

## Special rules

- When summarizing a paper, lead with the *claim* it makes, not the methodology. What's the bet?
- Cross-link concepts even when the link is loose — graph-style. Loose links surface unexpected connections.
- If a paper contradicts existing wiki content, that's a flag — create a \`## Disputed\` section on the relevant concept page with both citations.
`,

  Sales: `# Sales Schema

For prospect / customer / pipeline knowledge. Goal: never re-discover what I learned about a prospect last month.

## Wiki goals

- \`people/\` for every named prospect or contact. Pages include: company, role, ongoing context, last touch date, next action, preferences, decision-making style.
- \`sources/\` for call notes, email threads, demo recordings. Link back to the people involved.
- \`concepts/\` for recurring objections, deal patterns, market segments. Treat these as playbook entries.
- \`INDEX.md\` maintains "Active pipeline" (table of prospect → stage → next action → last touch) and "Recently closed/lost" (with the *why*).

## Special rules

- Every people-page update must note when (date) and from which source (raw file).
- Don't editorialize on prospects — record what they said, not what I think it means. Keep interpretations in a separate \`## My read\` section.
- If a prospect goes dark for >30 days, flag in INDEX under "Stale".
`,

  "Palm Commissions": `# Palm Commissions Schema

Side project category. Track decisions, architecture notes, customer feedback, recurring bug patterns, growth ideas.

## Wiki goals

- \`concepts/\` for architecture decisions, feature mental models, business model choices.
- \`sources/\` for customer feedback (verbatim), bug reports, GitHub PR summaries, internal docs.
- \`people/\` for key customers / collaborators (sparingly).
- \`INDEX.md\`: "Active workstreams", "Recent decisions", "Open product questions", "Customer themes" (what users are repeatedly saying).

## Special rules

- When recording a decision, capture: what was decided, what was rejected, why. Future-me will want the rejection list.
- Customer feedback: verbatim quote + my read, kept separate.
- Don't recreate code documentation — the codebase is the source of truth. Wiki captures the *why*, not the *what*.
`,

  "Exit Edge AI": `# Exit Edge AI Schema

Side project category. Same shape as Palm Commissions — architecture, decisions, customer feedback, growth.

## Wiki goals

- See "Palm Commissions" — identical structure.

## Special rules

- This is an AI product, so concept pages around model choices, eval results, prompt design are first-class. Keep eval data in \`sources/\` (raw run logs) and distill patterns in \`concepts/\`.
`,

  iWrightCode: `# iWrightCode Schema

Side project category. Same shape as the other side projects.

## Wiki goals

- See "Palm Commissions" — identical structure.
`,
};

export function defaultCategories(): string[] {
  return [
    "Personal",
    "Research",
    "Sales",
    "Palm Commissions",
    "Exit Edge AI",
    "iWrightCode",
  ];
}
