# Contributing to WhatTheAgent

Thanks for the interest. This is a small project, written by a security engineer rather than a career programmer, so the rules below favour clarity and reproducibility over cleverness. Read this before opening a PR.

## Quick start

```bash
git clone https://github.com/Rosh1106/WhatTheAgent.git
cd WhatTheAgent
npm install
npm test                 # 173 tests, ~700ms
npm run typecheck
npm run build
```

Run the CLI from source while you iterate:

```bash
npm run dev -- understand examples/risky-agent --output .wta
npm run dev -- understand examples/risky-agent --chat
npm run dev -- ack mcp.example execute_code --reason "test" --policy /tmp/test.yaml --workspace examples/risky-agent
```

Node 20 or newer is required.

## Project layout

The architecture and module map live in [AGENTS.md](AGENTS.md). Skim the "Current architecture (snapshot)" section before touching anything new.

- `src/` — TypeScript source (CLI, scanners, parsers, risk engine, output formatters)
- `tests/` — Vitest tests, mirrors `src/`
- `examples/` — fixture workspaces used by integration tests and demos
- `readme/` — audience-specific docs (`personal-agents.md`, `workspace-stations.md`, etc.)
- `docs/` — operational docs (`ROADMAP.md`, `github-action.md`)
- `skills/` — the ready-made Hermes / OpenClaw skill that drives WhatTheAgent

## What good PRs look like

1. **A test for whatever you fixed or added.** No PR is merged without one — patterns and detectors regress silently if they're not pinned.
2. **Updated docs.** If you add a flag, update the README block that lists it. If you change output shape, update the relevant section in `readme/` and the `--chat` schema example in [skills/whattheagent-safety-check.skill.md](skills/whattheagent-safety-check.skill.md).
3. **An entry in `CHANGELOG.md`** under `## [Unreleased]`. One line is fine.
4. **Tight scope.** A PR that fixes a bug, refactors three files, and adds a feature is three PRs.

## Detection-quality changes

If your change touches `src/utils/patterns.ts`, `src/risk/`, or anything that affects what gets flagged:

1. Add **both** a true-positive test (the thing you wanted to catch) and a false-positive test (the thing you didn't want to catch). Use the exact line of evidence from the workspace where you saw the issue.
2. Run `npm test` — `tests/utils/patterns.test.ts` already has the false-positive cases sampled from real-world scans. Don't relax those without a clear reason.
3. If practical, run a smoke scan against a real workspace and report before/after counts in the PR description.

## Schema changes

`UnderstandResult`, `ScanResult`, the chat summary, and the policy YAML are pre-1.0 but versioned with `schemaVersion: "0.1"`. If you change any of them:

- Bump the schema version.
- Add a `## [version] - YYYY-MM-DD` block in `CHANGELOG.md` with the breaking change.
- Update integration tests that check schema-shape.
- Update [skills/whattheagent-safety-check.skill.md](skills/whattheagent-safety-check.skill.md) — that file is documentation for downstream agents, and its example payload should match the current shape.

## Commit style

Look at recent commits for the tone. In short:

- Subject line is a short imperative ("Add `--exclude` flag…", "Cut false positives by ~94%…").
- Body explains the *why* and the *measured impact*, not what every file changed.
- One concern per commit; multiple commits per PR are fine and encouraged.
- Mark Claude-Code-assisted work with the `Co-Authored-By: Claude …` trailer if you used it. (We do.)

## Reporting bugs and ideas

- **Bug** → open an issue using the bug-report template. Paste the exact command, the workspace context (skills / MCP configs / scripts present), and what you expected vs got.
- **False positive** → open an issue using the bug-report template *and* paste the exact line of evidence from the report. We pin every fix as a regression test, so a clear evidence line is the most useful thing you can give us.
- **Feature idea** → open an issue using the feature-request template. Tell us what user journey it improves, not what code change you're picturing.
- **Security report** → do NOT open a public issue. Read [SECURITY.md](SECURITY.md) and email the maintainer.

## Code of conduct

We follow a standard [Contributor Covenant](CODE_OF_CONDUCT.md). Be kind. Disagree with ideas, not people. Don't be a jerk to first-time contributors — most of us are first-time contributors at something.
