# Personal Agents

Use this path if your agent is a personal setup: OpenClaw, Hermes, custom skills, local memory files, scripts, MCP servers, or identity/persona files.

## Positioning

> Map your OpenClaw/Hermes skills, tools, memory, scripts, and MCP servers, then generate safe fix plans for Claude or Codex.

## What Personal-Agent Users Want To Know

- What skills are installed?
- Which scripts can run?
- Which MCP servers are configured?
- Which files shape identity or persona?
- Which memory files exist?
- Which secrets or environment variables are referenced?
- Which external services can receive data?
- What changed since the last scan?
- What should Claude, Codex, or another coding agent fix?

## How To Use It Today

From the root of your personal-agent folder:

```bash
wta understand . --output .wta
```

Open:

```text
.wta/report.html
```

Ask a coding agent to help with fixes:

```bash
wta plan . --for-claude
wta plan . --for-codex
```

Use JSON for automation:

```bash
wta understand . --json --no-color --output .wta
```

## How To Read The Report

### Looks Normal

These are inventory and ordinary observations:

- skills detected
- scripts detected
- MCP servers detected
- read-only file access
- expected network access declared in policy

### Worth Reviewing

These are not always bad, but deserve attention:

- a skill can run shell commands
- a script can send data externally
- a tool references secrets or API keys
- an MCP server starts with a local command
- an instruction says to act without asking

### Fix First

These are high-priority personal-agent risks:

- credentials plus external send
- code execution plus network access
- payment or order placement
- approval bypass plus external action
- writes to identity, persona, memory, or skill files

## Suggested Personal-Agent Workflow

1. Run `wta understand . --output .wta`.
2. Open `.wta/report.html`.
3. Review "Needs attention" before normal observations.
4. Create or update `wta.policy.yaml` for expected tools.
5. Run `wta plan . --for-codex` or `wta plan . --for-claude`.
6. Let the coding agent implement controls.
7. Re-run `wta understand .` and compare results.

## Example Policy For Personal Agents

```yaml
expected:
  - component: "*github*"
    capability: "network_access"
    reason: "The GitHub tool is expected to call api.github.com."

human_approval:
  required_for:
    - external_send
    - execute_code
    - payment
    - approval_bypass

secret_redaction: true
least_privilege_token: true
sandbox_enabled: true
```

## OpenClaw And Hermes

OpenClaw and Hermes now have initial personal-agent profiles.

Current status: early support.

WhatTheAgent currently detects these personal-agent surfaces when a personal profile is used:

- `SOUL.md`
- `IDENTITY.md`
- `PERSONA.md`
- `MEMORY.md`
- `AGENTS.md`
- `skills/**/*.md`
- `*.skill.md`
- `mcp.json`
- `.mcp.json`
- `scripts/**`

It does not execute skills, tools, scripts, or MCP servers.

Profiles:

```bash
wta understand . --profile personal-agent
wta understand . --profile hermes
wta understand . --profile openclaw
```

## Baseline And New Skill Review

Create the first approved state:

```bash
wta baseline . --profile hermes --output .wta
```

This writes:

```text
.wta/
  baseline.json
  policy-proposal.yaml
  policy-implementation-plan.md
```

The terminal output asks the user whether to accept the baseline capabilities or add guardrails first.

When a new skill is added, compare against the baseline:

```bash
wta diff-baseline . --profile hermes --output .wta
```

This writes:

```text
.wta/
  baseline-diff.json
  policy-proposal.yaml
  new-skill-review-plan.md
```

The diff shows:

- new skills
- removed skills
- added capabilities
- added risk chains
- policy entries that would acknowledge accepted capabilities
- guardrail options if the user does not want to accept the capability as-is

Generate a starter policy:

```bash
wta init-policy . --profile hermes
wta init-policy . --profile openclaw
```

Future baseline improvements:

```bash
wta baseline . --watch
wta diff-baseline . --fail-on high
```

The current implementation is command-driven and local-first. It does not run a background watcher or execute new skills.
