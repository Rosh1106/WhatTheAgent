export type AgentInstructionTarget = "generic" | "claude" | "codex" | "openclaw" | "hermes";

export function renderAgentInstructions(target: AgentInstructionTarget = "generic"): string {
  switch (target) {
    case "claude":
      return renderClaudeInstructions();
    case "codex":
      return renderCodexInstructions();
    case "openclaw":
      return renderPersonalAgentSkill("OpenClaw", "openclaw");
    case "hermes":
      return renderPersonalAgentSkill("Hermes", "hermes");
    default:
      return renderGenericInstructions();
  }
}

function installBlock(): string {
  return `## Install Or Verify WhatTheAgent

First check whether WhatTheAgent is already installed:

\`\`\`bash
wta --help
\`\`\`

If \`wta\` is not available, ask the user for approval to install it globally, then run:

\`\`\`bash
npm install -g whattheagent
\`\`\`

Verify after installing:

\`\`\`bash
wta --help
whattheagent --help
\`\`\`

Use \`wta\` for the rest of this routine. If global install is not allowed, tell the user to install it manually with \`npm install -g whattheagent\` and then continue.`;
}

function renderGenericInstructions(): string {
  return `# WhatTheAgent Agent Safety Routine

Paste this into your coding agent or personal agent.

You are helping me manage this AI agent workspace safely using WhatTheAgent.

Your job is to install or verify WhatTheAgent, then use it to understand what this agent setup can do, what changed, and what guardrails should be added without breaking existing workflows.

${installBlock()}

Rules:
- Do not execute untrusted scripts.
- Do not start MCP servers.
- Do not send network requests except the npm install step if the user approves it.
- Do not print or expose secrets.
- Do not delete skills, MCP servers, memory files, or identity files unless I explicitly approve.
- Prefer adding approval, dry-run mode, allowlists, secret redaction, scoped tokens, logging, and policy documentation.
- Preserve existing workflows.

Start by running:

\`\`\`bash
wta understand . --output .wta
\`\`\`

Then summarize:
- detected setup
- current capabilities
- expected or normal behavior
- needs attention
- suggested guardrails

If this is a personal agent and no baseline exists, ask whether to create one:

\`\`\`bash
wta baseline . --profile personal-agent --output .wta
\`\`\`

If a baseline already exists, compare against it:

\`\`\`bash
wta diff-baseline . --profile personal-agent --output .wta
\`\`\`

Before changing anything, show me the proposed fix plan.

Generate a coding-agent plan with the target that matches you:

\`\`\`bash
wta plan . --for-claude
wta plan . --for-codex
\`\`\`

When implementing fixes:
- keep existing functionality working
- add guardrails around risky capability chains
- add or update \`wta.policy.yaml\`
- add dry-run mode where external sends or payments exist
- require approval for external_send, execute_code, payment, order_placement, approval_bypass
- add domain allowlists for external services
- redact secrets from logs and prompts
- do not change SOUL.md, IDENTITY.md, PERSONA.md, MEMORY.md, or AGENTS.md unless I explicitly approve

After changes, validate by running:

\`\`\`bash
wta understand . --output .wta
\`\`\`

Then tell me:
- what was fixed
- what still needs attention
- whether existing workflows appear preserved
- what command should run daily or when new skills/MCP servers are added
`;
}

function renderClaudeInstructions(): string {
  return `# WhatTheAgent Instructions For Claude

You are working with a user who wants to understand and guardrail an AI agent workspace using WhatTheAgent.

Use WhatTheAgent as the source of truth. Do not guess capabilities from filenames alone when a WhatTheAgent command can produce evidence.

${installBlock()}

Safety rules:
- Do not execute untrusted scripts.
- Do not start MCP servers.
- Do not send network requests except the npm install step if the user approves it.
- Do not print or expose secrets.
- Do not delete skills, MCP servers, memory files, or identity files unless the user explicitly approves.
- Preserve existing workflows.
- Prefer approval, dry-run mode, allowlists, scoped tokens, redaction, audit logging, and policy documentation.

Start:

\`\`\`bash
wta understand . --output .wta
\`\`\`

Read and summarize:
- .wta/report.html for the human-facing report
- .wta/agent-context.json if available
- .wta/fix-plan.md if available

If this is OpenClaw, Hermes, or another personal-agent setup, use:

\`\`\`bash
wta understand . --profile personal-agent --output .wta
\`\`\`

Create a baseline only after asking the user:

\`\`\`bash
wta baseline . --profile personal-agent --output .wta
\`\`\`

When a baseline exists, check changes:

\`\`\`bash
wta diff-baseline . --profile personal-agent --output .wta
\`\`\`

Before changing code or config, present a plan. The plan must include:
- what needs attention
- why it matters
- what will keep working
- what you will not change
- files likely to change
- verification commands

Generate a Claude-focused plan:

\`\`\`bash
wta plan . --for-claude
\`\`\`

After approved changes, validate:

\`\`\`bash
wta understand . --output .wta
\`\`\`

Report:
- resolved items
- remaining needs-attention items
- whether workflows appear preserved
- whether the user should update the baseline
`;
}

function renderCodexInstructions(): string {
  return `# WhatTheAgent Instructions For Codex

You are working in this repository. Use WhatTheAgent to understand agent capabilities, propose safe guardrails, implement only approved changes, and verify afterwards.

${installBlock()}

Rules:
- Do not execute untrusted scripts.
- Do not start MCP servers.
- Do not send network requests except the npm install step if the user approves it.
- Do not print or persist secrets.
- Do not remove useful agent functionality unless explicitly requested.
- Prefer small, reviewable changes.
- Preserve existing CLI arguments, scripts, skills, MCP configs, and workflows.

Initial scan:

\`\`\`bash
wta understand . --output .wta --json --no-color
\`\`\`

Generate implementation plan:

\`\`\`bash
wta plan . --for-codex
\`\`\`

Implement only the tasks in the plan. For risky chains, prefer:
- approval gates
- dry-run modes
- external domain allowlists
- command allowlists
- secret redaction
- scoped token usage
- audit logging
- policy entries in \`wta.policy.yaml\`

Do not:
- delete skills by default
- remove MCP servers by default
- modify SOUL.md, IDENTITY.md, PERSONA.md, MEMORY.md, or AGENTS.md unless explicitly requested
- run real payments, uploads, webhooks, or external sends in tests

After changes, run:

\`\`\`bash
npm run typecheck
npm run build
wta understand . --output .wta --json --no-color
\`\`\`

Final response should include:
- files changed
- guardrails added
- verification commands run
- remaining WhatTheAgent items
`;
}

function renderPersonalAgentSkill(name: string, profile: "openclaw" | "hermes"): string {
  return `---
name: WhatTheAgent Safety Check
description: Install or verify WhatTheAgent, review this ${name} personal-agent setup, suggest guardrails, and validate fixes.
---

Use WhatTheAgent to review this ${name} personal-agent workspace.

${installBlock()}

Run:

\`\`\`bash
wta understand . --profile ${profile} --output .wta
\`\`\`

If no baseline exists, ask the user whether to create one:

\`\`\`bash
wta baseline . --profile ${profile} --output .wta
\`\`\`

If a baseline exists, compare against it:

\`\`\`bash
wta diff-baseline . --profile ${profile} --output .wta
\`\`\`

Summarize:
- skills detected
- MCP/tool servers detected
- identity/persona/memory files detected
- scripts detected
- capabilities detected
- expected capabilities
- needs-attention chains
- suggested guardrails

Do not execute tools, scripts, MCP servers, payments, or network sends during review, except npm install if the user approves it.

Before making changes, show the user a plan.

Allowed safe changes:
- create or update \`wta.policy.yaml\`
- add approval requirements
- add domain allowlists
- add command allowlists
- add secret redaction rules
- add dry-run mode to scripts
- add daily check command

Forbidden unless the user explicitly approves:
- deleting skills
- removing MCP servers
- changing SOUL.md
- changing IDENTITY.md
- changing PERSONA.md
- changing MEMORY.md
- disabling workflows

After changes, run:

\`\`\`bash
wta understand . --profile ${profile} --output .wta
\`\`\`

Explain what changed, what was resolved, what remains, and whether the baseline should be updated.
`;
}
