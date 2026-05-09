import type { AgentPlan, DiffResult, ScanResult, UnderstandResult } from "../core/types.js";

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
      fix: suggestedFixForCapabilities(chain.capabilities),
      capabilities: chain.capabilities,
      risk: chain.risk
    })),
    ...meaningfulGaps.slice(0, Math.max(0, 5 - result.riskChains.length)).map((gap) => ({
      title: gap.control,
      componentId: gap.componentId,
      message: gap.message,
      fix: `Add ${gap.control.replace(/_/g, " ")}.`,
      capabilities: [] as string[],
      risk: gap.risk
    }))
  ];
  const normalObservations = result.observations.filter((observation) => observation.impact === "informational").slice(0, 5);
  const lines = [
    "WhatTheAgent understood this workspace",
    "",
    formatTldrLine(result.riskChains.length, meaningfulGaps.length, result.expected.length, result.inventory.counts.findings),
    "",
    "Detected setup",
    `- ${result.inventory.counts.toolServers} MCP server${result.inventory.counts.toolServers === 1 ? "" : "s"}`,
    `- ${result.inventory.counts.skills} skill${result.inventory.counts.skills === 1 ? "" : "s"}`,
    `- ${result.inventory.counts.scripts} script${result.inventory.counts.scripts === 1 ? "" : "s"}`,
    `- ${result.capabilities.length} capability type${result.capabilities.length === 1 ? "" : "s"}`,
    ...formatDetectedClients(result),
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
      lines.push(`${index + 1}. [${item.risk.toUpperCase()}] ${item.title}`);
      if (item.capabilities.length >= 2) {
        lines.push(`   ${item.capabilities[0]}  -->  ${item.capabilities.slice(1).join(" + ")}`);
      }
      lines.push(`   ${item.message}`);
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

export function formatCompatibilitySummary(result: { knownClients: Array<{ name: string; clientExistsPaths: string[]; mcpConfigPaths: string[]; skillsDirPaths: string[] }> }): string {
  const lines = ["WhatTheAgent known clients", ""];
  for (const client of result.knownClients) {
    const mcpFiles = client.mcpConfigPaths.length > 0 ? client.mcpConfigPaths.join(", ") : "none";
    const skillsDirs = client.skillsDirPaths.length > 0 ? client.skillsDirPaths.join(", ") : "none";
    lines.push(`- ${client.name}`);
    lines.push(`  MCP configs: ${mcpFiles}`);
    lines.push(`  Skills: ${skillsDirs}`);
  }
  return `${lines.join("\n")}\n`;
}

function humanCapability(capability: string): string {
  return capability.replace(/_/g, " ");
}

function formatTldrLine(riskChains: number, gaps: number, expected: number, findings: number): string {
  const segments = [
    `${riskChains} risk chain${riskChains === 1 ? "" : "s"}`,
    `${gaps} need${gaps === 1 ? "s" : ""} attention`,
    `${expected} acknowledged`,
    `${findings} inventory finding${findings === 1 ? "" : "s"}`
  ];
  return segments.join("  |  ");
}

function formatDetectedClients(result: UnderstandResult): string[] {
  const clients = result.inventory.compatibility?.detectedClients ?? [];
  if (clients.length === 0) return ["- detected agent clients: none"];
  return [
    `- detected agent client${clients.length === 1 ? "" : "s"}: ${clients.map((client) => `${client.name} (${detectedClientFiles(client).join(", ")})`).join("; ")}`
  ];
}

function detectedClientFiles(client: { detectedFiles: string[]; mcpConfigFiles: string[]; skillsDirs: string[] }): string[] {
  return [...new Set([...client.detectedFiles, ...client.mcpConfigFiles, ...client.skillsDirs])].sort();
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
