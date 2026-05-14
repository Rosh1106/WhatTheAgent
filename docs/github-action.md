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

## GitHub Code Scanning (SARIF)

WhatTheAgent emits SARIF 2.1.0 so findings show up in the Security tab of any public repo and in any commercial SARIF aggregator (GitLab, Snyk Code, Sonar, etc.).

```yaml
name: WhatTheAgent

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read
  security-events: write   # required to upload SARIF to Code Scanning

jobs:
  whattheagent:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install -g whattheagent

      # Run the scan and gate the build on critical findings.
      - run: wta understand . --output .wta --fail-on critical

      # Upload SARIF to GitHub Code Scanning so findings appear under Security → Code scanning.
      - uses: github/codeql-action/upload-sarif@v3
        if: always()       # upload even when --fail-on triggered exit 1
        with:
          sarif_file: .wta/results.sarif
          category: whattheagent

      # Optional: keep the full report directory as a workflow artifact.
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: whattheagent-report
          path: .wta/
```

`wta understand . --output .wta` always writes `.wta/results.sarif` alongside the other outputs. If you'd rather pipe SARIF directly without using the output directory, use `wta understand . --sarif > results.sarif` — the SARIF goes to stdout; the gating verdict goes to stderr.

### `--fail-on` thresholds

| Flag value | Fails CI when there is at least one finding of risk… |
|---|---|
| `none` *(default)* | Never (just reports) |
| `low` / `note` | low or higher |
| `medium` / `warning` | medium or higher |
| `high` / `error` | high or higher |
| `critical` | critical only |

The verdict line prints to stderr (e.g. `WhatTheAgent: failing CI — 1 risk chain at or above 'critical'.`), so it appears in CI logs without polluting your SARIF/JSON stdout pipeline.

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
