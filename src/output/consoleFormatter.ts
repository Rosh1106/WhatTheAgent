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
  const lines = [
    "WhatTheAgent understand complete",
    "",
    "Agent landscape:",
    `- ${result.inventory.counts.skills} Skills`,
    `- ${result.inventory.counts.toolServers} Tool servers`,
    `- ${result.inventory.counts.scripts} Scripts`,
    "",
    "Capabilities:"
  ];

  for (const capability of result.capabilities.slice().sort((a, b) => b.count - a.count || a.capability.localeCompare(b.capability)).slice(0, 10)) {
    lines.push(`- ${capability.capability}: ${capability.count} (${capability.risk})`);
  }
  if (result.capabilities.length === 0) {
    lines.push("- none detected");
  }

  lines.push("", "Control gaps:");
  if (result.controlGaps.length === 0) {
    lines.push("- none detected");
  } else {
    for (const gap of result.controlGaps.slice(0, 10)) {
      lines.push(`- ${gap.control}: ${gap.componentId} (${gap.risk})`);
    }
    if (result.controlGaps.length > 10) lines.push(`- ... ${result.controlGaps.length - 10} more`);
  }

  lines.push("", "Risk chains:");
  if (result.riskChains.length === 0) {
    lines.push("- none detected");
  } else {
    for (const chain of result.riskChains.slice(0, 10)) {
      lines.push(`- ${chain.name}: ${chain.componentId} (${chain.risk})`);
    }
    if (result.riskChains.length > 10) lines.push(`- ... ${result.riskChains.length - 10} more`);
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
  return [
    `WhatTheAgent plan for ${plan.target}`,
    "",
    `Tasks: ${plan.tasks.length}`,
    `Critical risk chains: ${plan.summary.criticalRiskChains}`,
    `High risk chains: ${plan.summary.highRiskChains}`,
    "",
    "Top tasks:",
    ...plan.tasks.slice(0, 10).map((task) => `- ${task.priority}: ${task.title}`),
    plan.tasks.length > 10 ? `- ... ${plan.tasks.length - 10} more` : ""
  ].filter(Boolean).join("\n") + "\n";
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
