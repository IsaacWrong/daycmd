# Tutorials

Short animated walkthroughs of the parts of daycmd that are easy to misconfigure or miss. Each clip is silent, ~8–14 seconds, and rendered from a Remotion composition in [`remotion/tutorials/`](../remotion/tutorials/). Regenerate with:

```bash
npm run video:tutorials
```

---

## 1. Set a budget cap — before you run a skill

Default cap is **`$0`** which means **unlimited**. A few `Triage Inbox` skills in a row could quietly burn real money. Open `/settings` first, set a daily USD cap, pick a warn-at threshold.

![Set a budget cap](tutorials/budget.gif)

---

## 2. Connect Google — Gmail + Calendar

Create an OAuth web client in Google Cloud Console with redirect URI `http://localhost:3000/api/auth/google/callback`. Paste `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` into `.env.local`, then click **Connect Google** in `/settings`. Tools `gmail.list/archive/send` and `calendar.read/create` light up once the OAuth dance lands.

![Connect Google OAuth](tutorials/google.gif)

---

## 3. GitHub PAT — three scopes, one paste

Generate a classic PAT at <https://github.com/settings/tokens/new>. The agent needs three scopes: `repo`, `notifications`, `read:user`. Paste the token into `.env.local` as `GITHUB_TOKEN=…`, restart `npm run dev`, and the heatmap + PRs feed fill in.

![GitHub PAT setup](tutorials/github.gif)

---

## 4. Sample vault first, then swap to yours

The agent *writes* into your vault — creating tasks, appending to daily notes, writing KB pages. Point `VAULT_PATH` at `examples/sample-vault` for the first session, kick the tires, then swap to your real vault path and restart `npm run dev`.

![Sample vault then your vault](tutorials/vault.gif)

---

## 5. The agent dock — ⌘J opens, ⌘1 fires a skill

`⌘J` expands the dock. `⌘1`–`⌘6` fire skills: **Triage · Brief · Plan · Lint · Review · Compile**. Each streams Opus 4.7 by default with per-skill model overrides. Tool calls render as pills as they execute (Gmail, Obsidian, Calendar, GitHub).

![Skills and agent dock](tutorials/skills.gif)

---

## 6. Knowledge base — raw → wiki → output

Every agent run auto-logs to `raw/`. At 06:00 daily, a cron compiles into `wiki/` (INDEX + concept + people + source pages) and runs a lint pass. Polished pages move to `output/`. Lint findings mirror to `Errors/{date}.md` in your vault and surface in the Errors section.

![KB compile and lint](tutorials/kb.gif)

---

## Regenerating

Each tutorial is a [Remotion `<Composition>`](../remotion/Root.tsx) backed by a single component file. Edit the component, then run:

```bash
npm run video:tutorials         # all six
npx remotion render tut-budget /tmp/x.mp4   # just one
```

The render script lives at [`scripts/render-tutorials.sh`](../scripts/render-tutorials.sh). It renders MP4s to a temp dir, converts via `ffmpeg` palettegen for crisp colors, and drops GIFs into `docs/tutorials/`.
