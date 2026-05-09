# Changelog

All notable changes to WhatTheAgent are recorded here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Schemas tagged
with `schemaVersion: "0.1"` are pre-1.0 and may change before the first stable
release; breaking schema changes will be called out in the relevant section.

## [Unreleased]

### Added

- README mascot (`readme/mascot.svg`) and animated terminal demo (`readme/demo.svg`).
- npm / license / Node / tests / status badges and a sharper "Why this exists" section in `README.md`.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, `RELEASE.md`, GitHub issue templates, and a pull-request template.
- A "Non-goals" section in `docs/ROADMAP.md` that explicitly puts sandbox capability probing, runtime monitoring/enforcement, SaaS dashboards, and silent fixes out of scope.

### Changed

- `readme/README.md` (docs hub), `readme/personal-agents.md`, `readme/workspace-stations.md`, `readme/agent-instructions.md`, and `docs/ROADMAP.md` brought up to date with the current command surface (`--chat`, `--open`, `--exclude`, `--from-scan`, `--reason-from-stdin`, `wta ack`, `wta ack-batch`).
- `AGENTS.md` snapshot of the current architecture and detection-quality rules for new contributors. The "Runtime and sandbox direction" section is replaced with an explicit "What WhatTheAgent does *not* do" scope reminder.

### Removed

- **`wta probe` command and `src/core/probePlan.ts`.** Sandbox capability probing is now an explicit non-goal (see ROADMAP). Anyone who needs it should use a real sandbox (gVisor / nsjail / Docker-with-seccomp).
- **`wta runtime` command and `src/core/runtimePlan.ts`.** Runtime observability / enforcement is now an explicit non-goal. Use the agent runtime's own audit logs, permission model, or a dedicated EDR.
- The supporting `ProbePlan`, `SandboxProbe`, `ProbeStatus`, `RuntimePlan`, and `RuntimeMode` types from `src/core/types.ts`, plus the `formatProbePlanSummary` and `formatRuntimePlanSummary` console formatters.
- Pruned `CapabilityState` to `declared | inferred | unknown` (dropped `sandbox_confirmed`, `sandbox_blocked`, `not_tested`, which only made sense alongside the removed probe command).
- Dead `src/cli/options.ts` and `src/cli/targets.ts` (orphan scaffolding never wired into `cli.ts`).
- The `probe:example` npm script and the `npm run probe:example` smoke step in CI.

## [0.1.0] - pre-release

The first publishable cut of WhatTheAgent. Highlights:

### Added

- Local-first capability discovery for AI agent workspaces (skills, MCP servers, scripts, configs).
- Risk-chain detection: `credential_access + external_send` → Data Exfiltration; `execute_code + network_access` → Remote Execution; `approval_bypass + external_send` → Silent External Action; `payment` / `order_placement` → Financial Action.
- Finding lifecycle: every finding lands in *inventory*, *needs attention*, or *risk chain*. Sensitive paths (`.env`, `.ssh`, etc.) escalate; ordinary `read_file` / `network_access` is informational.
- HTML report (`report.html`) — tier-organized, dark/light mode, self-contained, embedded SVG visual chains, per-card capability flow, evidence in `<details>` dropdowns.
- Animated chat-style summary (`--chat`) — phone-readable markdown plus a structured actions JSON for personal-agent / Telegram-bot integrations. Side-effect files at `.wta/chat-message.md` and `.wta/chat-actions.json`.
- `wta ack <component> [<capability>] --reason "..."` to acknowledge intentional capabilities. `--reason-from-stdin` reads the reason from stdin (avoids shell-escape issues in agent-driven flows). `wta ack-batch` reads a JSON array from stdin and runs many acks against a single shared scan.
- `wta init-policy . --from-scan` seeds `expected[]` in `wta.policy.yaml` with every detected `(component, capability)` from the current scan.
- `wta understand . --open` opens the rendered HTML report in the default browser.
- `--exclude <pattern>` extends the built-in default ignores (node_modules, dist, .venv, `.claude/plugins/marketplaces`, etc.) with user-supplied globs or bare directory names.
- `wta diff-baseline` redesigned console output: TL;DR line, capability-flow inline (`cap1 --> cap2`), card-style new/removed sections.
- A ready-made Hermes / OpenClaw skill at `skills/whattheagent-safety-check.skill.md` that drives the chat workflow end-to-end.
- 173 Vitest tests covering risk classification, chain detection, sensitivity scoring, finding lifecycle, MCP/skill parsing with redaction, secret redaction patterns, SVG / HTML report stability and HTML-injection escape, the chat summary builder, the policy mutation engine, and end-to-end fixture scans.

### Detection quality

- Body keyword patterns require verb+object phrases (`place an order`, `process payment`, `delegate to <noun>`, `do not ask before|the user|for approval`) instead of bare nouns. Cuts false positives by ~94% on real-world home-directory scans.
- Default-excluded `.claude/plugins/marketplaces`, `.claude/plugins/cache`, `.claude/projects`, `.venv`, `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.gradle`, `.next`, `.nuxt`, `.cache`, `Library/Caches`, plus the existing `node_modules`, `dist`, `.git`.
- Hardened the skill parser against malformed YAML frontmatter (e.g. unquoted colon in `description:`); a single bad file no longer aborts the entire scan.

### CLI

- `wta understand`, `wta scan`, `wta graph`, `wta diff`, `wta plan`, `wta instructions`, `wta compatibility`, `wta init-policy`, `wta ack`, `wta ack-batch`, `wta baseline`, `wta diff-baseline`, `wta probe` (preview), `wta runtime` (preview).

### Output

- `understand.json`, `capability-graph.json`, `fix-plan.md`, `report.html`, `visual-chains.svg`, `agent-context.json` written to `.wta/`. Plus `chat-message.md` and `chat-actions.json` when `--chat` is passed.

### Known limitations

- Several control types from `AGENTS.md` (`audit_logging`, `delegation_policy`, `payment_approval`) are placeholder-only; full detection is on the roadmap.
- `fix-plan.md` and `understand.json` grow linearly with finding count; large workspaces produce large files. Capping is on the roadmap.
- Component IDs are slugs of full paths and remain unreadable for deeply nested skills; switching to `<basename>-<6char-hash>` is on the roadmap.
- `wta probe` and `wta runtime` are plan-only.

[Unreleased]: https://github.com/Rosh1106/WhatTheAgent/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Rosh1106/WhatTheAgent/releases/tag/v0.1.0
