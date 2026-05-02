import type { PersonalAgentBaseline, PersonalAgentBaselineDiff } from "../core/types.js";

export interface PersonalFormatOptions {
  filesWritten?: string[];
}

export function formatPersonalBaselineSummary(baseline: PersonalAgentBaseline, options: PersonalFormatOptions = {}): string {
  const result = baseline.understand;
  const lines = [
    "WhatTheAgent personal-agent baseline complete",
    "",
    `Profile: ${baseline.profile}`,
    "",
    "Detected setup",
    `- ${result.inventory.counts.skills} skill${result.inventory.counts.skills === 1 ? "" : "s"}`,
    `- ${result.inventory.counts.scripts} script${result.inventory.counts.scripts === 1 ? "" : "s"}`,
    `- ${result.inventory.counts.toolServers} MCP server${result.inventory.counts.toolServers === 1 ? "" : "s"}`,
    `- ${result.capabilities.length} capability type${result.capabilities.length === 1 ? "" : "s"}`,
    "",
    "Policy consent",
    "WhatTheAgent generated a starter personal-agent policy proposal.",
    "",
    "Ask the user:",
    "Do you want to accept these baseline capabilities, or add guardrails before approving this agent setup?",
    "",
    "Recommended guardrails",
    ...baseline.policyProposal.recommendedControls.map((control) => `- ${control.replace(/_/g, " ")}`),
    "",
    "Agent next step",
    "- If accepted, ask Codex/Claude to apply `.wta/policy-proposal.yaml` into `wta.policy.yaml`.",
    "- If not accepted, ask the agent to add stricter approval, allowlist, sandbox, secret, or audit controls."
  ];

  if (options.filesWritten?.length) {
    lines.push("", "Files written:");
    for (const file of options.filesWritten) lines.push(`- ${file}`);
  }

  return `${lines.join("\n")}\n`;
}

export function formatPersonalBaselineDiffSummary(diff: PersonalAgentBaselineDiff, options: PersonalFormatOptions = {}): string {
  const lines = [
    "WhatTheAgent personal-agent baseline diff",
    "",
    `Profile: ${diff.profile}`,
    "",
    "Changes",
    `- New skills: ${diff.summary.newSkillCount}`,
    `- Removed skills: ${diff.summary.removedSkillCount}`,
    `- Added capabilities: ${diff.summary.addedCapabilityCount}`,
    `- Added risk chains: ${diff.summary.addedRiskChainCount}`,
    "",
    "New skill review"
  ];

  if (diff.newSkills.length === 0) {
    lines.push("- No new skills detected.");
  } else {
    for (const skill of diff.newSkills) {
      lines.push(`- ${skill.label} (${skill.path ?? skill.componentId})`);
      lines.push(`  Permissions: ${skill.capabilities.join(", ") || "none detected"}`);
      if (skill.riskChains.length > 0) {
        lines.push(`  Risk chains: ${skill.riskChains.map((chain) => `${chain.name} (${chain.risk})`).join(", ")}`);
      }
    }
  }

  lines.push(
    "",
    "Ask the user:",
    "Are you fine with these new skill capabilities, or do you want guardrails before approving the skill?",
    "",
    "Guardrail options",
    "- require approval before execution or external sends",
    "- add command allowlist",
    "- add external domain allowlist",
    "- scope and redact secrets",
    "- sandbox scripts/MCP servers",
    "- add audit logging",
    "",
    "Agent next step",
    "- Review `.wta/new-skill-review-plan.md`.",
    "- If accepted, apply `.wta/policy-proposal.yaml` to `wta.policy.yaml`.",
    "- If not accepted, implement guardrails first."
  );

  if (options.filesWritten?.length) {
    lines.push("", "Files written:");
    for (const file of options.filesWritten) lines.push(`- ${file}`);
  }

  return `${lines.join("\n")}\n`;
}
