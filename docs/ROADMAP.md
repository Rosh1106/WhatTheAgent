# WhatTheAgent Roadmap

## Vision

WhatTheAgent should become a CLI-first agent security workbench.

It should help users understand and harden AI agent systems by answering:

1. What is set up?
2. What can the agent do?
3. What controls exist?
4. What controls are missing?
5. What risky capability chains exist?
6. What fixes should be made?
7. What instructions should be sent to Codex, Claude, or another coding agent?

The product should start local-first and developer-first, then evolve toward richer UI, sandbox capability probing, runtime monitoring, and agent supply-chain protection.

## Product positioning

WhatTheAgent is not just a vulnerability scanner.

It is:

> Agent capability understanding, control-gap analysis, and hardening guidance for AI agent workspaces.

Or:

> A security workbench for understanding and hardening agent capabilities before they become production risk.

## Audience paths

WhatTheAgent should speak clearly to two related but different audiences.

### Personal agents

Examples:

- OpenClaw
- Hermes
- local personal agents
- custom skill folders
- memory files
- identity/persona files
- scripts and MCP servers

Positioning:

> A capability map and safety checklist for personal AI agents.

Personal-agent users want to know:

- what skills, tools, memory, and identity files exist
- which scripts can run
- which MCP servers are available
- which secrets or external services are referenced
- what changed since the last scan
- what Claude or Codex should fix

Roadmap items:

- initial `wta understand . --profile personal-agent`
- initial `wta understand . --profile hermes`
- initial `wta understand . --profile openclaw`
- initial identity/persona/memory surface detection
- initial `wta baseline . --profile hermes`
- initial `wta diff-baseline . --profile hermes`
- initial `wta init-policy . --profile hermes`
- future background watch mode for new skills
- future fail thresholds for new unsuppressed skills
- `wta init-policy --profile hermes`
- `wta init-policy --profile openclaw`

### Workspace stations

Examples:

- Codex
- Claude Code
- Cursor
- Kiro
- Windsurf
- VS Code agent workflows
- team repositories
- CI and pull requests

Positioning:

> A repo/workspace capability report for coding agents, with reviewable fix plans.

Workspace-station users want to know:

- did this PR add a new MCP server
- did this PR add new capabilities
- did this PR add secret access
- did this PR add external send or network behavior
- what controls are missing
- what Codex or Claude Code should fix

Roadmap items:

- GitHub Actions workflow example
- `.wta/summary.md`
- `wta ci . --fail-on high --output .wta`
- PR-comment friendly summaries
- known-client path coverage
- `wta compatibility`

## Capability-first model

The core abstraction should be capabilities, not protocols.

Protocols and frameworks are input sources:

- MCP
- A2A
- AG-UI / A2UI-style interfaces
- UCP
- AP2-style payments
- Cursor rules
- Claude Code commands
- Codex skills
- OpenAI/Codex skill formats
- Hermes/OpenClaw
- Custom tool configs
- Scripts
- CI workflows

All of these should normalize into:

- setup surfaces
- capabilities
- controls
- gaps
- risks
- fixes

## Example product flow

```bash
wta understand . --output .wta --html --for-agent
```

Generated output:

```text
.wta/
  understand.json
  capability-graph.json
  fix-plan.md
  report.html
  summary.md
  agent-context.json
```

The report should show:

- Detected agent setup
- MCP servers
- Skills, prompts, rules, scripts, and configs
- Capabilities
- Controls
- Control gaps
- Risk chains
- Quick fixes
- Implementation tasks

## Ideal UX

The ideal UX is a local visual workbench.

User runs:

```bash
wta understand . --ui
```

A local browser opens and shows the whole agent landscape.

The user can click a risk chain, inspect evidence, select recommended fixes, and generate implementation instructions for Codex or Claude.

The UI should not silently make dangerous changes. It should produce a reviewable plan first.

Recommended UX sections:

1. Landscape graph
2. Capability table
3. MCP server access map
4. Controls coverage
5. Control gaps
6. Risk chains
7. Fix center
8. Agent instruction pack

## MCP server handling

MCP servers should be shown directly as MCP servers.

Represent them as:

```text
MCP server
```

For each MCP server, show:

- Name
- Source file
- Transport or command
- Credentials used
- Capabilities exposed
- Controls detected
- Missing controls
- Risk chains
- Quick fixes

Example:

```text
GitHub MCP server
Capabilities:
- read_repository
- create_issue
- open_pull_request
Controls:
- least privilege token: unknown
- human approval: missing
Quick fixes:
- require approval for repository writes
- use least-privilege token
```

## Capability taxonomy

Initial capabilities:

- read_file
- write_file
- delete_file
- modify_code
- execute_shell
- execute_code
- run_script
- install_package
- network_access
- call_external_api
- send_external_message
- receive_external_message
- read_env
- access_secret
- use_api_key
- use_oauth_token
- query_database
- write_database
- memory_read
- memory_write
- scheduled_execution
- spawn_subagent
- communicate_with_agent
- share_context
- place_order
- authorize_payment
- make_payment
- issue_refund
- ui_control
- approval_bypass

## Controls taxonomy

Initial controls:

- human_approval
- command_allowlist
- external_domain_allowlist
- secret_redaction
- secret_scoping
- read_only_filesystem
- network_restriction
- sandbox_enabled
- ci_gate
- audit_logging
- policy_file
- least_privilege_token
- delegation_policy
- payment_approval

## Risk chains

Risk chains should be generated from capability combinations.

Examples:

- access_secret + send_external_message = secret exfiltration risk
- read_file + call_external_api = source/code exfiltration risk
- execute_shell + network_access = remote execution risk
- scheduled_execution + send_external_message = unattended exfiltration risk
- memory_read + send_external_message = memory leakage risk
- spawn_subagent + share_context = uncontrolled delegation risk
- place_order + authorize_payment = financial action risk
- ui_control + approval_bypass = deceptive interface/action risk
- install_package + execute_code = dependency execution risk
- access_secret + use_remote_runtime = credential exposure risk

## Fix model

Classify fixes into three groups:

1. Safe autofix
2. Guided fix
3. Agent implementation task

Examples of safe autofixes:

- Add starter `wta.policy.yaml`
- Add GitHub Action template
- Add starter report config

Examples of guided fixes:

- Add command allowlist
- Add external domain allowlist
- Add human approval for specific actions

Examples of agent implementation tasks:

- Add new scanner logic
- Add policy evaluator
- Add UI graph interactions
- Add tests

## Runtime and sandbox roadmap

The product should eventually support:

1. Static capability understanding
2. Sandbox capability probing
3. Runtime observe mode
4. Runtime approval mode
5. Runtime enforce/block mode

Static scan answers:

> What could this agent do?

Sandbox probing answers:

> What can this agent actually do in a controlled environment?

Runtime enforcement answers:

> What is this agent trying to do live, and should it be allowed?

## Milestones

### Milestone 1: `wta understand`

Add:

```bash
wta understand .
wta understand . --json
wta understand . --html
wta understand . --for-agent
```

Outputs:

- human-readable terminal summary
- `understand.json`
- `capability-graph.json`
- `fix-plan.md`
- basic self-contained `report.html`

### Milestone 2: control detection

Add:

- policy file detection
- command allowlist detection
- external domain allowlist detection
- secret scoping/redaction detection
- CI gate detection
- sandbox/read-only/network restrictions detection

### Milestone 3: visual workbench

Add:

```bash
wta understand . --ui
```

The UI should render:

- graph view
- selected node details
- fix center
- implementation plan generator

### Milestone 4: agent handoff

Add:

```bash
wta plan . --for-codex
wta plan . --for-claude
```

The plan should include:

- current gaps
- target files
- required changes
- acceptance criteria
- test plan

### Milestone 5: sandbox probing

Add controlled probes for:

- file read
- file write
- shell execution
- network access
- fake secrets/canary tokens
- external send
- package install
- delegation

### Milestone 6: runtime protection

Add observe/warn/approval/enforce modes.

## Non-goals for now

- Do not build a SaaS dashboard first.
- Do not require a cloud account.
- Do not make the product only an MCP server.
- Do not execute untrusted agent code by default.
- Do not silently apply risky code changes.

## Core principle

Same knowledge graph, two audiences:

1. Humans get a visual explanation.
2. Agents get structured JSON and implementation tasks.
