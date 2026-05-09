# AGENTS.md

This file gives coding agents context for working on WhatTheAgent.

## Product direction

WhatTheAgent is a CLI-first agent security workbench.

The product goal is not just to scan for static risky patterns. The goal is to help users and coding agents understand the whole AI agent landscape in a workspace:

1. What agent setup exists?
2. What tools, skills, prompts, rules, scripts, servers, and integrations are configured?
3. What capabilities does the agent have?
4. What controls protect those capabilities?
5. What control gaps and risky chains exist?
6. What quick fixes should be made?
7. What implementation instructions should be sent to Codex, Claude, or another coding agent?

The flagship command should become:

```bash
wta understand .
```

This should produce a human-readable explanation, an agent-readable knowledge graph, quick fixes, and a fix plan.

## Important framing

Use capability-first language.

Do not make MCP the central abstraction. MCP is important, but it is only one source of capabilities.

Treat MCP, A2A, skills, rules, prompts, Cursor config, Claude Code commands, Codex skills, Hermes/OpenClaw config, scripts, APIs, and custom tools as input adapters or capability sources.

In user-facing output, prefer:

- Agent capabilities
- Tool servers
- Controls
- Control gaps
- Risk chains
- Quick fixes
- Implementation tasks

Instead of overusing:

- MCP risk
- MCP governance
- MCP scanner

When MCP servers are detected, represent them as tool servers with subtype `mcp_server`.

Example:

```json
{
  "type": "ToolServer",
  "subtype": "mcp_server",
  "label": "GitHub tool server",
  "capabilities": ["read_repository", "create_issue", "open_pull_request"],
  "controls": ["least_privilege_token", "human_approval"]
}
```

## Desired architecture

```text
Input adapters
  - Cursor / Claude Code / Codex / Hermes / OpenClaw / MCP / A2A / scripts / custom configs
        ↓
Setup inventory
        ↓
Normalized capability model
        ↓
Control detection
        ↓
Control gap analysis
        ↓
Capability knowledge graph
        ↓
Risk-chain engine
        ↓
Quick-fix recommender
        ↓
Human report + agent-readable JSON + implementation plan
```

## UX direction

`wta understand .` should eventually generate:

```text
.wta/
  understand.json
  capability-graph.json
  fix-plan.md
  report.html
  summary.md
```

The HTML/UX should show the whole agent landscape:

- Agent workspace
- Skills
- Prompts
- Rules
- Tool servers, including MCP servers
- Scripts
- Secrets and environment access
- External services
- Databases
- Scheduled tasks
- CI/CD workflows
- Controls
- Control gaps
- Risk chains
- Quick fixes

Users should be able to select fixes in the UX. WhatTheAgent should generate precise implementation instructions for coding agents rather than silently changing risky logic.

## Core data model to add

Add or evolve these concepts:

- `UnderstandResult`
- `SetupInventory`
- `AgentSurface`
- `ToolServer`
- `Control`
- `ControlGap`
- `QuickFix`
- `ImplementationTask`

A capability should have a state such as:

- `declared`
- `inferred`
- `unknown`

Controls should include:

- `human_approval`
- `command_allowlist`
- `external_domain_allowlist`
- `secret_redaction`
- `secret_scoping`
- `read_only_filesystem`
- `network_restriction`
- `sandbox_enabled`
- `ci_gate`
- `audit_logging`
- `policy_file`
- `least_privilege_token`
- `delegation_policy`
- `payment_approval`

## Knowledge graph

The graph should power both the human UX and the agent-readable output.

Recommended graph node types:

- `Workspace`
- `Agent`
- `Skill`
- `Prompt`
- `Rule`
- `ToolServer`
- `Script`
- `Config`
- `Secret`
- `ExternalService`
- `Database`
- `ScheduledTask`
- `CIWorkflow`
- `Capability`
- `Control`
- `ControlGap`
- `RiskChain`
- `QuickFix`
- `ImplementationTask`

Recommended graph edge types:

- `CONTAINS`
- `USES`
- `CALLS`
- `READS`
- `WRITES`
- `SENDS_TO`
- `ACCESSES`
- `HAS_CAPABILITY`
- `PROTECTED_BY`
- `MISSING_CONTROL`
- `PART_OF_RISK_CHAIN`
- `CAN_BE_FIXED_BY`
- `IMPLEMENTED_BY`
- `DEFINED_IN`

## What WhatTheAgent does *not* do

WhatTheAgent is a **static, local-first** capability discovery tool. It is not a sandbox, an EDR, a runtime firewall, or a SaaS dashboard. The full reasoning lives in [docs/ROADMAP.md#non-goals](docs/ROADMAP.md#non-goals); the short version is that credible sandboxes already exist (gVisor, nsjail, Docker), agent vendors are building runtime observability themselves (Claude Code audit logs, MCP permission models, Cursor Privacy Mode), and competing on those is a losing race for a focused project.

If a contribution starts to add code execution, network calls during scanning, MCP startup, or runtime hooks, that's a scope alarm — flag it in the PR description.

## Coding guidance

Prefer deterministic, local-first analysis.

Do not require cloud upload, login, LLM calls, or live tool execution for the default path.

Use stable JSON output so other agents and CI systems can consume results.

When generating fixes, classify them as:

1. Safe autofix
2. Guided fix
3. Agent implementation task

Do not silently remove user functionality. Risky changes should become reviewable fix plans.

## Suggested first implementation milestone

Build the first version of:

```bash
wta understand .
wta understand . --json
wta understand . --html
wta understand . --for-agent
wta understand . --output .wta
```

Acceptance criteria:

- Existing `scan`, `graph`, `diff`, and `report` commands still work.
- `npm run typecheck` passes.
- `npm run build` passes.
- `npm test` passes (Vitest, currently 173 tests).
- `wta understand examples/risky-agent` prints a human-readable understanding report.
- `wta understand examples/risky-agent --json` emits deterministic JSON.
- `wta understand examples/risky-agent --html --output .wta` writes `.wta/report.html`.
- `wta understand examples/risky-agent --for-agent --output .wta` writes `.wta/fix-plan.md` and `.wta/agent-context.json`.
- MCP servers are shown as tool servers, not as the whole product category.
- Output is capability-first and control-gap-first.

## Current architecture (snapshot)

```
src/
  cli.ts                       # Commander entry; one block per command
  core/
    scanWorkspace.ts           # orchestrates skill/MCP/script/personal scans
    understandWorkspace.ts     # turns ScanResult into UnderstandResult
    findingLifecycle.ts        # detected → inventory / needs_attention / etc.
    personalAgentBaseline.ts   # baseline / diff / policy proposal
    ackPolicy.ts               # wta ack + wta ack-batch policy mutation
    planWorkspace.ts           # wta plan implementation tasks
    probePlan.ts, runtimePlan.ts (preview only)
    types.ts                   # all shared types
  scanner/                     # finds files (skills, MCP configs, scripts, personal)
  parser/                      # parses skills (gray-matter w/ safeMatter fallback)
                               # and MCP configs (jsonc-parser, env redaction)
  risk/
    classifier.ts              # capability → risk level
    chainDetector.ts           # capability sets → known risk chains
    sensitivity.ts             # path/snippet sensitivity scoring
  graph/                       # capability-graph builder + queries
  output/
    htmlReport.ts              # tier-organized report.html (light + dark)
    visualChainsSvg.ts         # at-a-glance SVG of top chains and gaps
    chatSummary.ts             # phone-readable + actions JSON for personal agents
    consoleFormatter.ts        # terminal output for every command
    fixPlan.ts                 # markdown for coding agents
    agentInstructions.ts       # copy-paste prompts per target
    jsonWriter.ts              # writes everything in .wta/
    markdownReport.ts, personalAgentFormatter.ts
  utils/
    patterns.ts                # capability detection regexes (verb+object preferred)
    fileWalker.ts              # glob wrapper + default ignores + --exclude support
    normalize.ts               # secret redaction, slugify, stableId, snippet
    safeRead.ts                # bounded file reads
  clients/wellKnownClients.ts  # known agent client config paths
```

`tests/` mirrors `src/` and uses Vitest. Add a regression test for any detection change — the patterns.test.ts file in particular has both true-positive examples and the exact false-positive lines we sampled from real-world scans. Adding a pattern that would re-introduce one of those false positives must fail there.

## What NOT to scan

`src/utils/fileWalker.ts` keeps a default-ignore list including `node_modules`, `.git`, `dist`, `build`, `.venv`, `__pycache__`, `.claude/plugins/marketplaces`, `.claude/plugins/cache`, `.claude/projects`, and OS caches. The marketplace/cache excludes alone removed ~94% of false positives in the home-directory dogfooding test.

If you add another high-volume third-party content path (e.g. a new IDE's plugin cache), add it to the default-ignore list. Do not silently lower detection precision to compensate.

## Output schema stability

`UnderstandResult`, `ScanResult`, and the chat-summary schemas are pre-1.0 but versioned by `schemaVersion: "0.1"`. Any breaking change to those schemas must:

1. Bump the schema version.
2. Note the change in `CHANGELOG.md`.
3. Update the test in `tests/integration/fixtures.test.ts` that locks determinism.

The `htmlReport.test.ts` determinism test asserts that the same input produces the same output. Keep that property.
