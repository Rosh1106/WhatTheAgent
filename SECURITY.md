# Security Policy

WhatTheAgent is a local-first capability discovery and guardrail-planning CLI for AI agent workspaces. It performs static analysis only — no LLM calls, no uploads, no script execution, no MCP server startup.

## Supported versions

The project is pre-1.0. Security fixes are applied to `main` and to the latest published npm package once publishing begins. There are no other supported branches.

## Reporting a vulnerability

Please report vulnerabilities **privately**, not as a public GitHub issue:

- Open a private [GitHub Security Advisory](https://github.com/Rosh1106/WhatTheAgent/security/advisories/new), or
- Email the maintainer (address is in `package.json`).

Include:

- WhatTheAgent version (`wta --version`) or commit SHA
- operating system and Node.js version
- the exact command used
- a minimal reproduction (a small workspace fixture is the most useful thing you can attach)
- whether secrets, reports, or CI artifacts were exposed in the process

We aim to acknowledge reports within a few business days. If you don't hear back, follow up on the same channel.

## What counts as a security issue

- Secret leakage in scan output that the redactor should have caught (e.g. a token that wasn't redacted in `understand.json`, `report.html`, `chat-actions.json`, or any `.wta/` file).
- A scan that triggers code execution, network requests, or MCP-server startup despite the local-first promise.
- Path traversal, symlink-following, or any case where scanning a directory reads files outside that directory.
- A command that mutates files outside the policy file or `.wta/` output directory unexpectedly.
- Crashes that can be triggered by hostile workspace content (we already handle malformed YAML frontmatter; report further crash inputs as security issues).

## What does not count

- A capability that the tool flags but the user considers benign (open a [false-positive issue](.github/ISSUE_TEMPLATE/false_positive.md) instead).
- A capability the tool *missed* (open a normal bug report or feature request).
- A request to scan a remote URL — out of scope by design.

## Sensitive output warning

WhatTheAgent tries to redact secret-like values and stores MCP environment variable values as `[redacted]` in all output.

Even with redaction, `.wta/` reports can contain sensitive workspace metadata:

- local file paths
- agent tool names
- MCP server names
- external service names
- detected capabilities
- risk chains and guardrail gaps
- snippets from skill bodies and scripts

**Review `.wta/` output before committing it, attaching it to a PR, posting it to chat, or making a CI artifact public.** A sample shell allowlist for git:

```bash
echo ".wta/" >> .gitignore
```

## Local-first promise

WhatTheAgent does not intentionally:

- require login
- upload workspace data
- call an LLM
- execute scripts
- start MCP servers
- make network requests during scanning

Preview commands (`wta probe`, `wta runtime`) remain plan-only unless the documentation explicitly says otherwise. Any future deviation from this promise will be called out in `CHANGELOG.md` and require an explicit user-facing flag.

## Security boundaries

WhatTheAgent is a static analysis and planning tool. It is not:

- a sandbox
- endpoint protection
- a runtime firewall
- a guarantee that an agent is safe

Use its output to review capabilities, build policy, add approval gates, and verify guardrails. The tool's job is to make capability *combinations* visible. The decision of what to allow is yours.
