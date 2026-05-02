import type { ControlType, RuntimeMode, RuntimePlan } from "./types.js";
import { understandWorkspace } from "./understandWorkspace.js";
import { stableId } from "../utils/normalize.js";

export async function buildRuntimePlan(workspacePath: string, mode: RuntimeMode): Promise<RuntimePlan> {
  const understand = await understandWorkspace(workspacePath);
  const grouped = new Map<ControlType, Set<string>>();

  for (const gap of understand.controlGaps) {
    grouped.set(gap.control, (grouped.get(gap.control) ?? new Set()).add(gap.componentId));
  }

  return {
    schemaVersion: "0.1",
    workspace: understand.workspace,
    mode,
    status: "preview_only",
    policies: [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([control, componentIds]) => ({
        id: stableId("runtime-policy", `${mode}-${control}`),
        control,
        action: actionForMode(mode),
        appliesTo: [...componentIds].sort()
      })),
    warning: "Runtime protection is preview-only in this version. WhatTheAgent does not install hooks, intercept tool calls, or block live agent actions yet."
  };
}

function actionForMode(mode: RuntimeMode): "observe" | "warn" | "require_approval" | "block" {
  switch (mode) {
    case "observe":
      return "observe";
    case "warn":
      return "warn";
    case "approval":
      return "require_approval";
    case "enforce":
      return "block";
  }
}
