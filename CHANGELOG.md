# Changelog

All notable changes to WhatTheAgent are recorded here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Schemas tagged
with `schemaVersion: "0.1"` are pre-1.0 and may change before the first stable
release; breaking schema changes will be called out in the relevant section.

## [Unreleased]

## [0.3.0] - 2026-05-14

The "better detection + slot into any CI" release. Region-aware scanning eliminates the false-positive class that dominated home-dir dogfooding, SARIF output unlocks GitHub Code Scanning and every commercial SAST aggregator, and `--fail-on` is the universal CI gate.

### Added

- **Region-aware scanning** (`src/parser/regions.ts`). Before pattern matching, files are split into typed regions so detection only fires on the right kind of text:
  - For `SKILL.md` and other markdown: fenced code blocks become `code` regions (run script-shape patterns), prose paragraphs become `prose` regions (run skill-instruction patterns), inline backtick spans and HTML comments are stripped entirely.
  - For Python: `#` line comments and triple-quoted docstrings are stripped, including trailing comments after a code statement; `#` inside string literals is preserved.
  - For JavaScript / TypeScript: `//` line comments and `/* */` block comments are stripped; `//` inside string, template, and regex literals is preserved.
  - For Bash: `#` comments are stripped at word boundaries; the shebang stays as code.
- 27 new chunker unit tests in `tests/parser/regions.test.ts` and 10 end-to-end FP-suppression integration tests in `tests/integration/regionAwareScanning.test.ts` covering each region kind plus chain-detection sanity.
- **SARIF 2.1.0 output** (`src/output/sarifReport.ts`). `wta understand . --output .wta` now always writes `.wta/results.sarif` alongside the other outputs; `wta understand . --sarif` emits SARIF to stdout for direct piping into `github/codeql-action/upload-sarif`. Risk chains and meaningful control gaps are mapped to SARIF rules + results with severity-correct `level` (critical/high → error, medium → warning, low → note), stable partialFingerprints for cross-run dedup, and physical locations from finding evidence.
- **`--fail-on <level>` CI gate** (`src/core/failOn.ts`). Threshold values: `none` (default), `low`, `medium`, `high`, `critical`. SARIF aliases `note` / `warning` / `error` are accepted too. When findings ≥ threshold are present, `wta understand` sets exit code 1; the verdict prints to stderr so it doesn't pollute SARIF/JSON stdout pipelines.
- 14 SARIF tests + 13 fail-on tests covering shape, schema, level mapping, rule dedup, fingerprint stability, output determinism, threshold parsing (case-insensitive, aliases, invalid input), and inclusive-threshold semantics. Total 240 tests passing.

### Changed

- The skill scanner (`src/scanner/skillScanner.ts`) now runs `skillInstructionPatterns` only against prose regions and `scriptPatterns` only against fenced code blocks — eliminating a large class of false positives where prose in a SKILL.md mentioned a script-shape construct (e.g. *"do not use `os.system`"*, *"deprecated `requests.post`"*).
- The script scanner (`src/scanner/scriptScanner.ts`) now strips comments before pattern matching. Comments in Python / JS / TS / Bash no longer trigger findings about the constructs they describe.
- `writeUnderstandOutputs` now also writes `results.sarif` to the output directory. Existing callers get this for free; the file list in the returned tuple grows from 6 entries to 7.

## [0.2.1] - 2026-05-10

### Security

- **Symlink-escape disclosure fix.** A malicious workspace could include a symlink (e.g. a `SKILL.md` pointing at `~/.ssh/id_rsa` or `~/.aws/credentials`) and `wta understand .` would follow it, scan the file, and emit its path and snippets into `report.html` and `understand.json`. Confirmed empirically against the prior release; an untrusted skill marketplace could weaponize this for local file disclosure.

  Two layers of protection now:
  1. `glob` is invoked with `follow: false`, preventing traversal through symlinked directories during the walk.
  2. After globbing, every matched path is resolved with `fs.realpath`. Any file whose real location escapes the resolved scan root is dropped before it's read, parsed, or quoted into evidence. Intra-workspace symlinks (which resolve back inside the root) remain scannable.

  Three regression tests in `tests/utils/fileWalker.test.ts` lock in the behaviour using the exact PoC that motivated the fix (file symlink escape, directory symlink escape, and a sanity check that ordinary nested files still scan).

  No CVE has been requested; the impact is local information disclosure to the user running `wta`, not remote code execution. Users on 0.2.0 should upgrade.

  Credit: discovered during dogfooding while writing this project's own threat model.

## [0.2.0] - 2026-05-09

The "we're going public" release. Big visual + scope cleanup since 0.1.0 plus open-source scaffolding.

### Added

- **README mascot** (`readme/mascot.svg`) and **animated terminal demo** (`readme/demo.svg`) — both inline SVG, no external assets.
- **npm / license / Node / tests / status badges** and a sharper "Why this exists" section in `README.md`.
- **Open-source scaffolding**: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, `RELEASE.md`, GitHub issue templates (bug, false-positive, feature), `.github/PULL_REQUEST_TEMPLATE.md`, and `.github/ISSUE_TEMPLATE/config.yml`.
- **Dependabot config** (`.github/dependabot.yml`) — weekly grouped npm + github-actions updates.
- **CodeQL workflow** (`.github/workflows/codeql.yml`) — JavaScript/TypeScript SAST on push, PR, and weekly schedule.
- A "Non-goals" section in `docs/ROADMAP.md` that explicitly puts sandbox capability probing, runtime monitoring/enforcement, SaaS dashboards, and silent fixes out of scope.

### Changed

- `readme/README.md` (docs hub), `readme/personal-agents.md`, `readme/workspace-stations.md`, `readme/agent-instructions.md`, and `docs/ROADMAP.md` brought up to date with the current command surface (`--chat`, `--open`, `--exclude`, `--from-scan`, `--reason-from-stdin`, `wta ack`, `wta ack-batch`).
- `AGENTS.md` snapshot of the current architecture and detection-quality rules for new contributors. The "Runtime and sandbox direction" section is replaced with an explicit "What WhatTheAgent does *not* do" scope reminder.
- `SECURITY.md` rewritten with private security advisory link, scope of what counts as a security issue, and what doesn't.

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

[Unreleased]: https://github.com/Rosh1106/WhatTheAgent/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/Rosh1106/WhatTheAgent/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/Rosh1106/WhatTheAgent/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/Rosh1106/WhatTheAgent/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Rosh1106/WhatTheAgent/releases/tag/v0.1.0
