## What this changes

One or two sentences. Replace the title.

## Why

The user journey or bug this improves. Quote the exact issue / discussion / scan output that motivated this if you have one.

## How (if non-obvious)

Skip if it's a small, obvious change. Otherwise, two or three lines about the approach.

## Test evidence

- [ ] `npm test` — all tests pass
- [ ] `npm run typecheck` — clean
- [ ] `npm run build` — clean
- [ ] Added a test that fails before this change and passes after
- [ ] If this affects detection (`src/utils/patterns.ts`, `src/risk/`), added a regression test using the exact line of evidence
- [ ] If this changes output schema, bumped `schemaVersion` and added a `CHANGELOG.md` entry
- [ ] If this adds a flag or command, README and the relevant `readme/*.md` are updated

## Before / after (if visible)

Screenshots of `report.html`, before/after counts on a real workspace, or a snippet of console output. Optional but useful.
