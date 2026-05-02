import type { AgentPlan, AgentPlanTarget, UnderstandResult } from "./types.js";
import { understandWorkspace } from "./understandWorkspace.js";

export async function planWorkspace(workspacePath: string, target: AgentPlanTarget = "generic"): Promise<AgentPlan> {
  const understand = await understandWorkspace(workspacePath);
  return planFromUnderstand(understand, target);
}

export function planFromUnderstand(understand: UnderstandResult, target: AgentPlanTarget = "generic"): AgentPlan {
  const verificationCommands = [
    "npm run typecheck",
    "npm run build",
    "npm run dev -- understand . --json --no-color"
  ];
  const doNotDo = [
    "Do not execute untrusted scripts, MCP servers, or generated agent code.",
    "Do not remove useful agent functionality unless the user explicitly approves.",
    "Do not send network requests, payments, or destructive commands while validating fixes.",
    "Do not print or persist secret values."
  ];
  return {
    schemaVersion: "0.1",
    target,
    generatedFrom: "understand",
    workspace: understand.workspace,
    summary: understand.summary,
    tasks: understand.implementationTasks,
    instructions: targetInstructions(target),
    acceptanceCriteria: [
      "Keep all changes local-first and deterministic.",
      "Do not execute untrusted scripts, tool servers, or agent code while implementing controls.",
      "Prefer reviewable policy, allowlist, sandbox, and approval controls over deleting functionality.",
      "Run WhatTheAgent understand output after changes and confirm reduced control gaps."
    ],
    prompt: renderAgentPrompt(understand, target, verificationCommands, doNotDo),
    verificationCommands,
    doNotDo
  };
}

function targetInstructions(target: AgentPlanTarget): string {
  switch (target) {
    case "codex":
      return "Codex: implement the tasks in priority order, keep patches scoped, preserve existing behavior, and verify with npm run typecheck plus relevant CLI smoke tests.";
    case "claude":
      return "Claude Code: implement the tasks as reviewable edits, explain any risky tradeoffs before changing behavior, and verify with typecheck plus CLI smoke tests.";
    case "generic":
      return "Implement the tasks as a reviewable hardening plan. Add controls before removing capabilities.";
  }
}

function renderAgentPrompt(
  understand: UnderstandResult,
  target: AgentPlanTarget,
  verificationCommands: string[],
  doNotDo: string[]
): string {
  const label = target === "codex" ? "Codex" : target === "claude" ? "Claude Code" : "coding agent";
  const lines: string[] = [
    `You are ${label}. Implement the WhatTheAgent fix plan for this workspace.`,
    "",
    "Goal",
    "Reduce real agent capability risk with reviewable controls while preserving useful behavior.",
    "",
    "Why this matters",
    `- Critical risk chains: ${understand.summary.criticalRiskChains}`,
    `- High risk chains: ${understand.summary.highRiskChains}`,
    `- Control gaps needing review: ${understand.controlGaps.length}`,
    "",
    "Tasks"
  ];

  if (understand.implementationTasks.length === 0) {
    lines.push("- No implementation tasks are currently required.");
  } else {
    for (const task of understand.implementationTasks.slice(0, 20)) {
      lines.push(`- ${task.title}`);
      lines.push(`  Priority: ${task.priority}`);
      lines.push(`  Why: ${task.why ?? task.instructions}`);
      lines.push(`  Files likely to change: ${task.targetFiles.join(", ") || "wta.policy.yaml"}`);
      lines.push(`  Implementation: ${task.instructions}`);
      lines.push(`  Acceptance: ${task.acceptanceCriteria.join(" ")}`);
    }
  }

  lines.push("", "Verification commands");
  for (const command of verificationCommands) {
    lines.push(`- ${command}`);
  }

  lines.push("", "Do not do");
  for (const item of doNotDo) {
    lines.push(`- ${item}`);
  }

  if (understand.expected.length > 0) {
    lines.push("", "Expected or acknowledged capabilities");
    for (const observation of understand.expected.slice(0, 20)) {
      lines.push(`- ${observation.componentId}: ${observation.message}`);
    }
  }

  return `${lines.join("\n")}\n`;
}
