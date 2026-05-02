# GitHub Actions

Use WhatTheAgent in CI to understand whether a pull request changes what your agents can do.

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
          cache: npm
      - run: npm install -g whattheagent
      - run: wta understand . --output .wta --json --no-color
      - uses: actions/upload-artifact@v4
        with:
          name: whattheagent-report
          path: .wta/
```

Until the package is published to npm, use the source workflow below.

## Source Checkout Workflow

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
- run: node dist/cli.js plan . --for-codex --output .wta/codex-plan.json
```

Or write instructions:

```yaml
- run: node dist/cli.js instructions --for-codex --output .wta/codex-instructions.md
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
  understand.json
  capability-graph.json
  fix-plan.md
  report.html
  agent-context.json
```

Upload the full `.wta` directory as a workflow artifact.

## Product Question CI Should Answer

> Did this PR change what our agents can do, and what should we review or fix?
