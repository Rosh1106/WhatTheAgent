import type { DiffResult, ScanResult } from "../core/types.js";

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
