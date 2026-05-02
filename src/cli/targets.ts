import type { AgentPlanTarget, AgentProfile, RuntimeMode } from "../core/types.js";
import type { AgentInstructionTarget } from "../output/agentInstructions.js";
import type { GlobalOptions } from "./options.js";

export function planTarget(options: GlobalOptions): AgentPlanTarget {
  if (options.forCodex) return "codex";
  if (options.forClaude) return "claude";
  return "generic";
}

export function instructionTarget(options: GlobalOptions): AgentInstructionTarget {
  if (options.forCodex) return "codex";
  if (options.forClaude) return "claude";
  if (options.forOpenclaw) return "openclaw";
  if (options.forHermes) return "hermes";
  return "generic";
}

export function runtimeMode(value: RuntimeMode | undefined): RuntimeMode {
  if (value === "observe" || value === "warn" || value === "approval" || value === "enforce") return value;
  throw new Error(`Invalid runtime mode: ${value}. Expected observe, warn, approval, or enforce.`);
}

export function profileOption(value: AgentProfile | undefined): AgentProfile {
  if (value === undefined) return "workspace";
  if (value === "workspace" || value === "personal-agent" || value === "openclaw" || value === "hermes") return value;
  throw new Error(`Invalid profile: ${value}. Expected workspace, personal-agent, openclaw, or hermes.`);
}

export function personalProfileOption(value: AgentProfile | undefined): AgentProfile {
  const profile = profileOption(value ?? "personal-agent");
  if (profile === "workspace") {
    throw new Error("Personal-agent commands require personal-agent, openclaw, or hermes profile.");
  }
  return profile;
}
