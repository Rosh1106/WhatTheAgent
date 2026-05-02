import type { AgentPlan, DiffResult, ProbePlan, RuntimePlan, ScanResult, UnderstandResult } from "../core/types.js";

export interface FormatOptions {
  quiet?: boolean;
  filesWritten?: string[];
}

export function formatScanSummary(scan: ScanResult, options: FormatOptions = {}): string {
  if (options.quiet) return "";
  const lines = [
    "WhatTheAgent scan complete",
    "",
    "Components found:",
    `- ${scan.summary.componentsByType.skill} Skills`,
    `- ${scan.summary.componentsByType.mcp_server} MCP server${scan.summary.componentsByType.mcp_server === 1 ? "" : "s"}`,
    `- ${scan.summary.componentsByType.script} Scripts`,
    "",
    "Capabilities:"
  ];

  const capabilities = Object.entries(scan.summary.capabilities).filter(([, count]) => count > 0);
  if (capabilities.length === 0) {
    lines.push("- none detected");
  } else {
    for (const [capability, count] of capabilities) {
      lines.push(`- ${capability}: ${count}`);
    }
  }

  lines.push("", "High-risk chains:");
  if (scan.riskChains.length === 0) {
    lines.push("- none detected");
  } else {
    for (const chain of scan.riskChains) {
      lines.push(`- ${chain.name}: ${chain.componentId}`);
    }
  }

  if (options.filesWritten?.length) {
    lines.push("", "Files written:");
    for (const file of options.filesWritten) {
      lines.push(`- ${file}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function formatDiffSummary(diff: DiffResult): string {
  const lines: string[] = ["WhatTheAgent diff complete", ""];

  if (diff.addedRiskChains.length > 0) {
    lines.push("New high-risk chain detected:", "");
    for (const chain of diff.addedRiskChains) {
      lines.push(`Component: ${chain.componentId}`);
      lines.push(`Chain: ${chain.capabilities.join(" + ")}`);
      lines.push(`Risk: ${chain.risk}`);
      lines.push("Evidence:");
      for (const evidence of chain.evidence) {
        const location = evidence.line ? `${evidence.file}:${evidence.line}` : evidence.file;
        lines.push(`- ${evidence.pattern} in ${location}`);
      }
      lines.push("");
    }
  }

  lines.push(`New components: ${diff.addedComponents.length}`);
  lines.push(`Removed components: ${diff.removedComponents.length}`);
  lines.push(`New capabilities: ${diff.addedCapabilities.length}`);
  lines.push(`Removed capabilities: ${diff.removedCapabilities.length}`);
  lines.push(`New high-risk chains: ${diff.addedRiskChains.length}`);
  lines.push(`Removed high-risk chains: ${diff.removedRiskChains.length}`);
  lines.push(`Risk level changes: ${diff.riskLevelChanges.length}`);

  return `${lines.join("\n")}\n`;
}

export function formatUnderstandSummary(result: UnderstandResult, options: FormatOptions = {}): string {
  if (options.quiet) return "";
  const meaningfulGaps = result.controlGaps.filter((gap) => gap.impact === "fix_required" || gap.impact === "fix_recommended");
  const needsAttention = [
    ...result.riskChains.map((chain) => ({
      title: chain.name,
      componentId: chain.componentId,
      message: chain.message,
      fix: suggestedFixForCapabilities(chain.capabilities)
    })),
    ...meaningfulGaps.slice(0, Math.max(0, 5 - result.riskChains.length)).map((gap) => ({
      title: gap.control,
      componentId: gap.componentId,
      message: gap.message,
      fix: `Add ${gap.control.replace(/_/g, " ")}.`
    }))
  ];
  const normalObservations = result.observations.filter((observation) => observation.impact === "informational").slice(0, 5);
  const lines = [
    "WhatTheAgent understood this workspace",
    "",
    "Detected setup",
    `- ${result.inventory.counts.toolServers} tool server${result.inventory.counts.toolServers === 1 ? "" : "s"}`,
    `- ${result.inventory.counts.skills} skill${result.inventory.counts.skills === 1 ? "" : "s"}`,
    `- ${result.inventory.counts.scripts} script${result.inventory.counts.scripts === 1 ? "" : "s"}`,
    `- ${result.capabilities.length} capability type${result.capabilities.length === 1 ? "" : "s"}`,
    "",
    "What your agent can do"
  ];

  for (const capability of result.capabilities.slice().sort((a, b) => b.count - a.count || a.capability.localeCompare(b.capability)).slice(0, 8)) {
    lines.push(`- ${humanCapability(capability.capability)} (${capability.count})`);
  }
  if (result.capabilities.length === 0) {
    lines.push("- none detected");
  }

  lines.push("", "Needs attention");
  if (needsAttention.length === 0) {
    lines.push("- Nothing urgent found. Normal tool capabilities are listed as observations.");
  } else {
    needsAttention.slice(0, 5).forEach((item, index) => {
      lines.push(`${index + 1}. ${item.message}`);
      lines.push(`   Component: ${item.componentId}`);
      lines.push(`   Suggested fix: ${item.fix}`);
    });
    if (needsAttention.length > 5) {
      lines.push(`- ... ${needsAttention.length - 5} more item${needsAttention.length - 5 === 1 ? "" : "s"} in the report`);
    }
  }

  lines.push("", "Normal observations");
  if (normalObservations.length === 0) {
    lines.push("- none");
  } else {
    for (const observation of normalObservations) {
      lines.push(`- ${observation.message}`);
    }
  }

  if (result.expected.length > 0) {
    lines.push("", "Expected / acknowledged");
    for (const observation of result.expected.slice(0, 5)) {
      lines.push(`- ${observation.message}`);
    }
  }

  lines.push("", "Next step for your coding agent");
  if (result.implementationTasks.length > 0) {
    lines.push("Run:");
    lines.push("  wta plan . --for-codex");
  } else {
    lines.push("- No fix plan needed right now.");
  }

  if (options.filesWritten?.length) {
    lines.push("", "Files written:");
    for (const file of options.filesWritten) {
      lines.push(`- ${file}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function formatAgentPlanSummary(plan: AgentPlan): string {
  return plan.prompt;
}

export function formatProbePlanSummary(plan: ProbePlan): string {
  return [
    "WhatTheAgent sandbox probe plan",
    "",
    plan.warning,
    "",
    `Probes: ${plan.probes.length}`,
    ...plan.probes.map((probe) => `- ${probe.capability}: ${probe.description}`)
  ].join("\n") + "\n";
}

export function formatRuntimePlanSummary(plan: RuntimePlan): string {
  return [
    `WhatTheAgent runtime ${plan.mode} preview`,
    "",
    plan.warning,
    "",
    `Policies: ${plan.policies.length}`,
    ...plan.policies.map((policy) => `- ${policy.action}: ${policy.control} (${policy.appliesTo.length} component${policy.appliesTo.length === 1 ? "" : "s"})`)
  ].join("\n") + "\n";
}

function humanCapability(capability: string): string {
  return capability.replace(/_/g, " ");
}

function suggestedFixForCapabilities(capabilities: string[]): string {
  if (capabilities.includes("credential_access") && capabilities.includes("external_send")) {
    return "Add secret scoping/redaction and approval before external sends.";
  }
  if (capabilities.includes("execute_code") && capabilities.includes("network_access")) {
    return "Add command allowlist, sandboxing, and network restrictions.";
  }
  if (capabilities.includes("payment") || capabilities.includes("order_placement")) {
    return "Require explicit approval and dry-run controls for commerce actions.";
  }
  if (capabilities.includes("approval_bypass")) {
    return "Add policy that overrides approval-bypass instructions.";
  }
  return "Review and add the missing control shown in the report.";
}
