import type { AgentPlan, AgentPlanTarget, UnderstandResult } from "./types.js";
import { understandWorkspace } from "./understandWorkspace.js";

export async function planWorkspace(workspacePath: string, target: AgentPlanTarget = "generic"): Promise<AgentPlan> {
  const understand = await understandWorkspace(workspacePath);
  return planFromUnderstand(understand, target);
}

export function planFromUnderstand(understand: UnderstandResult, target: AgentPlanTarget = "generic"): AgentPlan {
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
    ]
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
