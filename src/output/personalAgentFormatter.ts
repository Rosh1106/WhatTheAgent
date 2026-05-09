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
  const tldr = formatDiffTldr(diff);
  const lines = [
    "WhatTheAgent personal-agent baseline diff",
    `Profile: ${diff.profile}`,
    "",
    tldr,
    ""
  ];

  if (diff.summary.addedRiskChainCount > 0) {
    lines.push("Risk chain", "");
    for (const chain of diff.addedRiskChains) {
      lines.push(`[${chain.risk.toUpperCase()}] ${chain.name}`);
      if (chain.capabilities.length >= 2) {
        lines.push(`  ${chain.capabilities[0]}  -->  ${chain.capabilities.slice(1).join(" + ")}`);
      }
      lines.push(`  ${chain.message}`);
      lines.push(`  Component: ${chain.componentId}`);
      lines.push("");
    }
  }

  if (diff.summary.newSkillCount > 0) {
    lines.push("New skills", "");
    for (const skill of diff.newSkills) {
      lines.push(`+ ${skill.label}`);
      lines.push(`  Path: ${skill.path ?? skill.componentId}`);
      lines.push(`  Capabilities: ${skill.capabilities.join(", ") || "none detected"}`);
      if (skill.riskChains.length > 0) {
        lines.push(`  Risk chains: ${skill.riskChains.map((chain) => `${chain.name} (${chain.risk})`).join(", ")}`);
      }
      lines.push("");
    }
  }

  if (diff.summary.removedSkillCount > 0) {
    lines.push("Removed skills", "");
    for (const skill of diff.removedSkills) {
      lines.push(`- ${skill.label} (${skill.path ?? skill.componentId})`);
    }
    lines.push("");
  }

  if (diff.summary.newSkillCount === 0 && diff.summary.removedSkillCount === 0 && diff.summary.addedCapabilityCount === 0 && diff.summary.addedRiskChainCount === 0) {
    lines.push("No changes since baseline.", "");
  }

  lines.push(
    "Action",
    "  Accept: wta ack <component> [<capability>] --reason \"...\"",
    "    or apply .wta/policy-proposal.yaml into wta.policy.yaml",
    "  Decline: add a guardrail (approval, allowlist, secret scoping, sandbox, audit log) before next run"
  );

  if (options.filesWritten?.length) {
    lines.push("", "Files written:");
    for (const file of options.filesWritten) lines.push(`- ${file}`);
  }

  return `${lines.join("\n")}\n`;
}

function formatDiffTldr(diff: PersonalAgentBaselineDiff): string {
  return [
    `${diff.summary.newSkillCount} new skill${diff.summary.newSkillCount === 1 ? "" : "s"}`,
    `${diff.summary.removedSkillCount} removed`,
    `${diff.summary.addedCapabilityCount} added capabilit${diff.summary.addedCapabilityCount === 1 ? "y" : "ies"}`,
    `${diff.summary.addedRiskChainCount} added risk chain${diff.summary.addedRiskChainCount === 1 ? "" : "s"}`
  ].join("  |  ");
}
