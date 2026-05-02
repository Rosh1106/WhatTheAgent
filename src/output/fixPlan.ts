import type { UnderstandResult } from "../core/types.js";

export function renderFixPlan(result: UnderstandResult): string {
  const lines: string[] = [
    "# WhatTheAgent Fix Plan",
    "",
    "This plan is intended for Codex, Claude Code, Cursor, or another coding agent. Do not silently remove functionality; implement reviewable controls.",
    "",
    "## Priority Summary",
    "",
    `- Critical risk chains: ${result.summary.criticalRiskChains}`,
    `- High risk chains: ${result.summary.highRiskChains}`,
    `- Control gaps: ${result.summary.controlGapCount}`,
    `- Implementation tasks: ${result.summary.implementationTaskCount}`,
    "",
    "## Implementation Tasks",
    ""
  ];

  if (result.implementationTasks.length === 0) {
    lines.push("No implementation tasks generated.");
  }

  for (const task of result.implementationTasks) {
    lines.push(`### ${task.title}`);
    lines.push("");
    lines.push(`- Priority: ${task.priority}`);
    lines.push(`- Target files: ${task.targetFiles.join(", ") || "policy/config files"}`);
    lines.push(`- Related fixes: ${task.relatedQuickFixes.join(", ")}`);
    lines.push("");
    lines.push("Instructions:");
    lines.push(task.instructions);
    lines.push("");
    lines.push("Acceptance criteria:");
    for (const criterion of task.acceptanceCriteria) {
      lines.push(`- ${criterion}`);
    }
    lines.push("");
  }

  lines.push("## Quick Fixes", "");
  for (const fix of result.quickFixes) {
    lines.push(`### ${fix.title}`);
    lines.push("");
    lines.push(`- Kind: ${fix.kind}`);
    lines.push(`- Risk: ${fix.risk}`);
    if (fix.componentId) lines.push(`- Component: ${fix.componentId}`);
    lines.push(`- Rationale: ${fix.rationale}`);
    lines.push("- Steps:");
    for (const step of fix.steps) {
      lines.push(`  - ${step}`);
    }
    lines.push("");
  }

  lines.push("## Risk Chains", "");
  for (const chain of result.riskChains) {
    lines.push(`- ${chain.risk}: ${chain.name} on ${chain.componentId} (${chain.capabilities.join(" + ")})`);
  }

  return `${lines.join("\n")}\n`;
}
