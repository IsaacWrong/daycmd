<!-- Keep PRs small and focused. One logical change per PR. -->

## Summary

<!-- 1-3 sentences: what changed and why. Link issues with "Closes #123". -->

## Test plan

<!-- How you verified this. Commands run, manual steps, screenshots for UI. -->

- [ ] `npx tsc --noEmit`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`

## Notes for reviewers

<!-- Anything non-obvious: tradeoffs considered, follow-ups deferred, areas you want a second pair of eyes on. Delete if N/A. -->

## Checklist

- [ ] Stayed inside the patterns in [`CONTRIBUTING.md`](../CONTRIBUTING.md) (TOD CSS vars, no `dark:`, zod at API boundaries, vault-as-truth)
- [ ] Added or updated tests when changing behavior
- [ ] Updated `README.md` / `CHANGELOG.md` if user-facing
- [ ] If a new agent tool was added: surfaced the side effect in the README safety section
