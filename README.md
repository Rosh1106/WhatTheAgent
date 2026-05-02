# WhatTheAgent

WhatTheAgent shows what your AI agent is really doing.

Run one command and see the capabilities your agent has, what changed, and which chains look risky. This is a local-first capability discovery, knowledge graph, and governance CLI. It is not a vulnerability scanner.

## Install

```bash
npm install
npm run build
```

During local development:

```bash
npm run dev -- scan examples/risky-agent
```

After publishing or linking, both binaries work:

```bash
whattheagent scan .
wta scan .
```

## Commands

```bash
whattheagent scan .
whattheagent scan . --output whattheagent.json
whattheagent understand .
whattheagent understand . --json
whattheagent understand . --html
whattheagent understand . --for-agent
whattheagent understand . --ui
whattheagent plan . --for-codex
whattheagent plan . --for-claude
whattheagent probe .
whattheagent runtime . --mode observe
whattheagent graph .
whattheagent diff old.json new.json
whattheagent report whattheagent.json
```

Agent-friendly flags are supported by every command:

```bash
whattheagent scan . --json --no-color --output whattheagent.json
wta diff old.json new.json --json --quiet
```

`understand` writes a capability-first workbench bundle:

```text
.wta/
  understand.json
  capability-graph.json
  fix-plan.md
  report.html
  agent-context.json
```

MCP servers are normalized as tool servers with subtype `mcp_server` in the understand output.

`understand` separates the report into the buckets a human or coding agent needs:

- inventory: skills, scripts, MCP tool servers, and detected controls
- capabilities: what the agent can do, with evidence and confidence
- needs attention: high-risk chains and sensitive missing controls
- normal observations: ordinary capabilities such as basic reads or expected network access
- expected / acknowledged: capabilities declared in `wta.policy.yaml`
- fixes: quick fixes and agent implementation tasks

Control detection is deterministic and local. WhatTheAgent looks for:

- `wta.policy.yaml`, `wta.policy.yml`, `wta.policy.json`, or `.wta/policy.*`
- GitHub Actions workflows that run `wta` or `whattheagent`
- Policy text for command allowlists, domain allowlists, human approval, secret controls, sandbox controls, network restrictions, CI gates, audit logging, delegation policy, and payment approval

Expected capabilities and suppressions can be declared in policy:

```yaml
expected:
  - component: "mcp.github-readonly"
    capability: "network_access"
    reason: "GitHub read-only MCP server needs network access to api.github.com."

suppressions:
  - component: "script.local-report"
    capability: "read_file"
    reason: "Reads only workspace report files."
    expires: "2026-12-31"
```

This does not hide inventory. It moves acknowledged findings out of “needs attention” so false positives are easier to spot.

Runtime and sandbox features are preview/plan-only in this version:

```bash
wta probe . --json
wta runtime . --mode approval --json
```

They do not execute probes, install hooks, intercept tool calls, or block live agent actions yet.

## Static and Local First

WhatTheAgent does not require login, upload scan data, call an API, use an LLM, execute scripts, or start MCP servers. MCP configs are parsed statically by default.

The reserved flag below is accepted for future compatibility:

```bash
whattheagent scan . --allow-mcp-exec
```

For now it prints:

```text
MCP execution mode is reserved for a future version.
```

## Example

```bash
npm run dev -- scan examples/risky-agent --output whattheagent.json
npm run dev -- understand examples/risky-agent --output .wta
npm run dev -- plan examples/risky-agent --for-codex
npm run dev -- probe examples/risky-agent --json
npm run dev -- runtime examples/risky-agent --mode warn
npm run dev -- graph examples/risky-agent --json
npm run dev -- report whattheagent.json
```

The example workspace intentionally triggers:

- `external_send`
- `credential_access`
- `execute_code`
- `network_access`
- data exfiltration and remote execution risk chains

Additional fixtures cover common review cases:

```bash
npm run dev -- understand examples/benign-agent
npm run dev -- understand examples/expected-github-tool
npm run dev -- understand examples/risky-finance-agent
npm run dev -- understand examples/critical-payment-agent
```

- `benign-agent` shows low-noise inventory and ordinary observations
- `expected-github-tool` shows an expected MCP tool server declared by policy
- `risky-finance-agent` triggers credential plus external-send risk
- `critical-payment-agent` triggers payment and order-placement risk

## JSON Shape

Scan output is deterministic and stable:

```json
{
  "schemaVersion": "0.1",
  "workspace": {
    "root": "."
  },
  "components": [],
  "findings": [],
  "riskChains": [],
  "graph": {
    "nodes": [],
    "edges": []
  },
  "summary": {}
}
```

Core scan logic lives in reusable functions under `src/core`, `src/scanner`, `src/parser`, `src/graph`, `src/diff`, and `src/risk` so a future local MCP server can expose:

- `scan_workspace`
- `generate_graph`
- `diff_scans`
- `explain_capability`
- `find_risky_chains`
- `export_report`
