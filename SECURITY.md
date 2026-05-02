# Security Policy

WhatTheAgent is a local-first capability discovery and guardrail planning CLI for AI agent workspaces.

## Supported Versions

The project is pre-1.0. Security fixes are applied to the latest version on `main` and the latest published npm package once publishing begins.

## Reporting A Vulnerability

Please report vulnerabilities privately by contacting the maintainer before opening a public issue.

Include:

- WhatTheAgent version or commit SHA
- operating system and Node.js version
- command used
- minimal reproduction steps
- whether secrets, reports, or CI artifacts were exposed

## Sensitive Output Warning

WhatTheAgent tries to redact secret-like values and stores MCP environment variable values as `[redacted]`.

Even with redaction, `.wta/` reports can contain sensitive workspace metadata such as:

- local file paths
- agent tool names
- MCP server names
- external service names
- detected capabilities
- risk chains and guardrail gaps

Do not commit or publicly upload `.wta/` reports unless you have reviewed them.

## Local-First Promise

WhatTheAgent does not intentionally:

- require login
- upload workspace data
- call an LLM
- execute scripts
- start MCP servers
- make network requests during scanning

Preview commands such as `probe` and `runtime` remain plan-only unless explicitly documented otherwise.

## Security Boundaries

WhatTheAgent is a static analysis and planning tool. It is not a sandbox, endpoint protection product, runtime firewall, or guarantee that an agent is safe.

Use its output to review capabilities, create policy, add approval gates, and verify guardrails.
