import type { UnderstandResult } from "../core/types.js";

export function renderFixPlan(result: UnderstandResult): string {
  const needsAttention = [
    ...result.riskChains.map((chain) => `${chain.risk}: ${chain.name} on ${chain.componentId} (${chain.capabilities.join(" + ")})`),
    ...result.controlGaps.map((gap) => `${gap.risk}: ${gap.message} (${gap.componentId})`)
  ];
  const lines: string[] = [
    "# WhatTheAgent Fix Plan",
    "",
    "This plan is intended for Codex, Claude Code, Cursor, or another coding agent. It is capability-first: preserve useful tools, add reviewable controls, and avoid treating ordinary inventory as a defect.",
    "",
    "## Priority Summary",
    "",
    `- Critical risk chains: ${result.summary.criticalRiskChains}`,
    `- High risk chains: ${result.summary.highRiskChains}`,
    `- Control gaps: ${result.summary.controlGapCount}`,
    `- Expected or acknowledged items: ${result.expected.length}`,
    `- Normal observations: ${result.observations.length}`,
    `- Implementation tasks: ${result.summary.implementationTaskCount}`,
    "",
    "## Needs Attention",
    ""
  ];

  if (needsAttention.length === 0) {
    lines.push("No high-risk chains or control gaps require action right now.");
  } else {
    for (const item of needsAttention.slice(0, 50)) {
      lines.push(`- ${item}`);
    }
  }

  lines.push(
    "",
    "## Implementation Tasks",
    ""
  );

  if (result.implementationTasks.length === 0) {
    lines.push("No implementation tasks generated.");
  }

  for (const task of result.implementationTasks) {
    lines.push(`### ${task.title}`);
    lines.push("");
    lines.push(`- Priority: ${task.priority}`);
    if (task.why) lines.push(`- Why: ${task.why}`);
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
    if (task.verificationCommands?.length) {
      lines.push("");
      lines.push("Verification commands:");
      for (const command of task.verificationCommands) {
        lines.push(`- \`${command}\``);
      }
    }
    if (task.doNotDo?.length) {
      lines.push("");
      lines.push("Do not do:");
      for (const item of task.doNotDo) {
        lines.push(`- ${item}`);
      }
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

  lines.push("", "## Expected / Acknowledged", "");
  if (result.expected.length === 0) {
    lines.push("No expected or suppressed capabilities were declared.");
  } else {
    for (const observation of result.expected) {
      lines.push(`- ${observation.componentId}: ${observation.message}`);
    }
  }

  lines.push("", "## Normal Observations", "");
  const normalObservations = result.observations.filter((observation) => observation.impact === "informational");
  if (normalObservations.length === 0) {
    lines.push("No normal observations were generated.");
  } else {
    for (const observation of normalObservations.slice(0, 50)) {
      lines.push(`- ${observation.message}`);
    }
  }

  return `${lines.join("\n")}\n`;
}
