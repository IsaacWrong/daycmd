# Security Policy

## Supported versions

Daycmd is pre-1.0. Only the `main` branch receives security fixes. Pin a tagged release if you need stability.

## Reporting a vulnerability

**Do not open a public GitHub issue for security reports.**

Email: `isaacwright2020@gmail.com` with subject prefix `[daycmd security]`.

Please include:

- A description of the issue and its impact
- Steps to reproduce (or a proof of concept)
- The commit SHA or release tag you tested against
- Whether the issue is already public anywhere

You should get an acknowledgement within 5 business days. Once a fix is ready, we'll coordinate disclosure timing with you and credit you in the release notes unless you'd prefer to stay anonymous.

## Scope

Daycmd runs entirely on the user's machine and stores secrets in `.env.local` + a local SQLite database (`data/daycmd.db`). The threat model is local-first; in scope:

- Code paths that could exfiltrate `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, or stored Google OAuth tokens to a remote endpoint not chosen by the user
- Path-traversal or arbitrary-write bugs in the Obsidian read/write tools (`src/lib/obsidian/*`)
- Command injection in agent tool wrappers
- SSRF or arbitrary-fetch bugs in the agent's `web fetch` tool
- Missing `zod` validation at API boundaries that allows unauthenticated clients on `localhost` to perform actions they shouldn't
- Privilege issues in the OAuth callback (`/api/auth/google/callback`) — token capture, CSRF, open redirect

Out of scope:

- Issues that require the attacker to already have shell access to the user's machine
- Denial of service against the local dev server
- Findings against optional integrations (Gmail, Calendar, GitHub) that originate in the upstream API
- Reports that boil down to "the agent has tools that write files / send email" — that's documented and consent-gated in the README

## Safe handling

If you find something, please:

- Don't run experiments against accounts you don't own
- Don't test against the public GitHub org — clone locally and reproduce there
- Don't post the details on social media or in Discord/Slack before we've had a chance to ship a fix
