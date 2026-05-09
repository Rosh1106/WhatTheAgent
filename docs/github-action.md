# GitHub Actions

Use WhatTheAgent in CI to understand whether a pull request changes what your agents can do.

WhatTheAgent is now published on npm, so the recommended workflow installs the CLI directly from npm.

The recommended first behavior is low-friction:

- run WhatTheAgent
- upload the `.wta` report as an artifact
- do not fail on ordinary inventory or observations
- fail only later when you have a policy and thresholds

## Basic Workflow

```yaml
name: WhatTheAgent

on:
  pull_request:
  push:
    branches: [main]

jobs:
  whattheagent:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install -g whattheagent
      - run: wta understand . --output .wta --json --no-color
      - run: wta instructions --for-codex --output .wta/codex-instructions.md
      - uses: actions/upload-artifact@v4
        with:
          name: whattheagent-report
          path: .wta/
```

## Composite Action

This repository also includes `action.yml` so users can run WhatTheAgent as a GitHub Action after the repository is public:

```yaml
- uses: Rosh1106/WhatTheAgent@v0.1.0
  with:
    workspace: .
    output-dir: .wta
    profile: workspace
```

The composite action installs `whattheagent` from npm using `--ignore-scripts` and then runs `wta understand`.

## Source Checkout Workflow

For local development of this repository itself, use the source workflow:

```yaml
name: WhatTheAgent Source Check

on:
  pull_request:
  push:
    branches: [main]

jobs:
  whattheagent:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: node dist/cli.js understand . --output .wta --json --no-color
      - uses: actions/upload-artifact@v4
        with:
          name: whattheagent-report
          path: .wta/
```

## Agent Fix Plan In CI

Generate a coding-agent prompt as an artifact:

```yaml
- run: wta plan . --for-codex --output .wta/codex-plan.json
```

Or write instructions:

```yaml
- run: wta instructions --for-codex --output .wta/codex-instructions.md
```

## Recommended CI Policy

Start with reporting only.

Do not fail builds on:

- inventory
- normal observations
- expected capabilities
- acknowledged capabilities

Later, once `wta.policy.yaml` is tuned, fail only on unsuppressed high or critical risks.

Future command shape:

```bash
wta ci . --fail-on high --output .wta
```

## Output Files

`wta understand . --output .wta` writes:

```text
.wta/
  understand.json         # full structured scan
  capability-graph.json   # nodes/edges of agent surfaces and capabilities
  fix-plan.md             # markdown for a coding agent to act on
  report.html             # tier-organized self-contained report (light/dark)
  visual-chains.svg       # at-a-glance risk-chains image
  agent-context.json      # compact context for an agent
```

If the workflow uses `--chat`, two additional files appear:

```text
  chat-message.md
  chat-actions.json
```

The chat outputs are useful when the same scan needs to be re-posted into a Slack / Discord notification from CI — the markdown is already phone-readable and the actions JSON tells a follow-up step exactly which `wta ack` commands to run if a reviewer approves.

Upload the full `.wta` directory as a workflow artifact.

Review `.wta/` before making artifacts public. WhatTheAgent redacts secret-like values, but reports can still contain sensitive workspace metadata such as tool names, local paths, and external service names.

## Product Question CI Should Answer

> Did this PR change what our agents can do, and what should we review or fix?
