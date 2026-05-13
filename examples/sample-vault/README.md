# Sample vault

A minimal Obsidian-compatible vault that demonstrates everything Daycmd reads + writes. Point `VAULT_PATH` at this folder to demo without setting up Obsidian first.

```bash
# In your .env.local:
VAULT_PATH="/absolute/path/to/daycmd/examples/sample-vault"
```

## What's in here

```
Tasks/                       Inbox.md, Personal.md, Work.md, Side Projects.md
Daily/                       2 sample daily notes (today + yesterday templates)
Daily/Weekly/                weekly note (rendered from template)
Projects/                    one sample project w/ frontmatter
Categories/Personal/         raw/ + wiki/ + output/ tier dirs w/ a seed INDEX
Templates/                   Daily Note Template, Weekly Note Template, Project Template
.obsidian/                   daily-notes.json so Daycmd knows the template path
```

## Caveats

- The agent **will write** to this folder (tasks, daily notes, KB raw entries) once you start using it. If you want to keep the sample pristine, copy the directory before pointing Daycmd at it.
- Some sample tasks have an `🛫 2026-04-01` start date so they don't sit "overdue" forever — feel free to update.

## Next steps

- Switch `VAULT_PATH` to your real Obsidian vault when you're ready.
- Daycmd will auto-create category folders under `Categories/` as you talk to the agent.
