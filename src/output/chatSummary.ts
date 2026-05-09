import type {
  Capability,
  Component,
  ComponentType,
  ControlGap,
  PersonalAgentBaselineDiff,
  RiskChain,
  RiskLevel,
  UnderstandResult
} from "../core/types.js";

export interface ChatSummary {
  schemaVersion: "0.1";
  source: "understand" | "diff-baseline";
  workspace: { root: string };
  message: string;
  items: ChatItem[];
  summary: {
    totalItems: number;
    highestSeverity: RiskLevel | "none";
    riskChainCount: number;
  };
}

export interface ChatItem {
  componentId: string;
  label: string;
  type: ComponentType;
  path?: string;
  capabilities: Capability[];
  riskChainName?: string;
  highestRisk: RiskLevel;
  why: string;
  actions: ChatActions;
}

export interface ChatActions {
  approve: { intent: string; command: string };
  guardrail: { intent: string; hint: string };
  remove: { intent: string; hint: string };
}

const RISK_BULLET: Record<RiskLevel, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢"
};

export function buildUnderstandChatSummary(result: UnderstandResult): ChatSummary {
  const componentMap = new Map<string, Component>(result.scan.components.map((component) => [component.id, component]));
  const items: ChatItem[] = [];
  const seen = new Set<string>();

  for (const chain of result.riskChains) {
    if (seen.has(chain.componentId)) continue;
    seen.add(chain.componentId);
    const component = componentMap.get(chain.componentId);
    items.push(itemFromChain(chain, component));
  }

  const meaningfulGaps = result.controlGaps
    .filter((gap) => gap.impact === "fix_required" || gap.impact === "fix_recommended");
  for (const gap of meaningfulGaps) {
    if (seen.has(gap.componentId)) continue;
    seen.add(gap.componentId);
    const component = componentMap.get(gap.componentId);
    items.push(itemFromGap(gap, component));
  }

  items.sort(compareItems);
  return {
    schemaVersion: "0.1",
    source: "understand",
    workspace: result.workspace,
    items,
    summary: summarize(items, result.riskChains.length),
    message: renderUnderstandMessage(result, items)
  };
}

export function buildDiffChatSummary(diff: PersonalAgentBaselineDiff): ChatSummary {
  const items: ChatItem[] = [];
  const seen = new Set<string>();

  const chainsByComponent = new Map<string, RiskChain[]>();
  for (const chain of diff.addedRiskChains) {
    chainsByComponent.set(chain.componentId, [...(chainsByComponent.get(chain.componentId) ?? []), chain]);
  }

  for (const skill of diff.newSkills) {
    seen.add(skill.componentId);
    const skillChains = [...skill.riskChains, ...(chainsByComponent.get(skill.componentId) ?? [])];
    const highestRisk = pickHighestRiskFromChains(skillChains) ?? capabilityRisk(skill.capabilities);
    const riskChainName = skillChains[0]?.name;
    items.push({
      componentId: skill.componentId,
      label: skill.label,
      type: "skill",
      path: skill.path,
      capabilities: skill.capabilities,
      riskChainName,
      highestRisk,
      why: whyForSkill(skill.capabilities, skillChains),
      actions: actionsFor(skill.componentId, skill.label, skill.path)
    });
  }

  for (const chain of diff.addedRiskChains) {
    if (seen.has(chain.componentId)) continue;
    seen.add(chain.componentId);
    items.push(itemFromChain(chain, undefined));
  }

  items.sort(compareItems);
  return {
    schemaVersion: "0.1",
    source: "diff-baseline",
    workspace: diff.workspace,
    items,
    summary: summarize(items, diff.addedRiskChains.length),
    message: renderDiffMessage(diff, items)
  };
}

function itemFromChain(chain: RiskChain, component: Component | undefined): ChatItem {
  return {
    componentId: chain.componentId,
    label: component?.label ?? chain.componentId,
    type: component?.type ?? "skill",
    path: component?.path,
    capabilities: chain.capabilities,
    riskChainName: chain.name,
    highestRisk: chain.risk,
    why: chain.message,
    actions: actionsFor(chain.componentId, component?.label ?? chain.componentId, component?.path)
  };
}

function itemFromGap(gap: ControlGap, component: Component | undefined): ChatItem {
  return {
    componentId: gap.componentId,
    label: component?.label ?? gap.componentId,
    type: component?.type ?? "skill",
    path: component?.path,
    capabilities: [],
    highestRisk: gap.risk,
    why: gap.message,
    actions: actionsFor(gap.componentId, component?.label ?? gap.componentId, component?.path)
  };
}

function actionsFor(componentId: string, label: string, componentPath: string | undefined): ChatActions {
  const safeReason = "<USER_REASON>";
  return {
    approve: {
      intent: `User approves ${label} as intentional.`,
      command: `wta ack ${componentId} --reason "${safeReason}"`
    },
    guardrail: {
      intent: `User wants a guardrail before next use.`,
      hint: `Edit wta.policy.yaml to require human_approval for ${componentId}, or add domain/command allowlists scoped to it.`
    },
    remove: {
      intent: `User wants to remove ${label}.`,
      hint: componentPath ? `Delete the file at ${componentPath} and re-run wta understand .` : `Locate and remove ${label}, then re-run wta understand .`
    }
  };
}

function summarize(items: ChatItem[], riskChainCount: number): ChatSummary["summary"] {
  if (items.length === 0) return { totalItems: 0, highestSeverity: "none", riskChainCount };
  const highest = items.reduce<RiskLevel>((best, item) => (riskRank(item.highestRisk) > riskRank(best) ? item.highestRisk : best), "low");
  return { totalItems: items.length, highestSeverity: highest, riskChainCount };
}

function compareItems(left: ChatItem, right: ChatItem): number {
  const byRisk = riskRank(right.highestRisk) - riskRank(left.highestRisk);
  if (byRisk !== 0) return byRisk;
  return left.label.localeCompare(right.label);
}

function pickHighestRiskFromChains(chains: { risk: RiskLevel }[]): RiskLevel | undefined {
  if (chains.length === 0) return undefined;
  return chains.reduce<RiskLevel>((best, chain) => (riskRank(chain.risk) > riskRank(best) ? chain.risk : best), "low");
}

function capabilityRisk(capabilities: Capability[]): RiskLevel {
  if (capabilities.includes("payment") || capabilities.includes("order_placement")) return "critical";
  if (capabilities.includes("execute_code") || capabilities.includes("external_send") || capabilities.includes("approval_bypass")) return "high";
  if (capabilities.includes("write_file") || capabilities.includes("credential_access")) return "medium";
  return "low";
}

function whyForSkill(capabilities: Capability[], chains: { name: string; risk: RiskLevel; capabilities: Capability[] }[]): string {
  if (chains.length > 0) {
    const chain = chains[0]!;
    return `${chain.name}: ${chain.capabilities.join(" + ")}.`;
  }
  if (capabilities.length === 0) return "New skill with no detected capabilities.";
  return `Detected capabilities: ${capabilities.join(", ")}.`;
}

function renderUnderstandMessage(result: UnderstandResult, items: ChatItem[]): string {
  if (items.length === 0) {
    return [
      "✅ Nothing urgent in your agent setup.",
      "",
      `Workspace: ${result.workspace.root}`,
      `Inventory: ${result.inventory.counts.skills} skills · ${result.inventory.counts.scripts} scripts · ${result.inventory.counts.toolServers} MCP servers.`,
      "",
      "Re-run anytime: wta understand . --chat"
    ].join("\n");
  }

  const lines: string[] = [];
  const riskChains = result.riskChains.length;
  const attention = items.length - riskChains;
  const headline = riskChains > 0
    ? `🔴 ${riskChains} risk chain${riskChains === 1 ? "" : "s"}${attention > 0 ? ` · ${attention} other item${attention === 1 ? "" : "s"} need attention` : ""}`
    : `🟠 ${items.length} item${items.length === 1 ? "" : "s"} need attention`;
  lines.push(headline, "");

  for (const item of items.slice(0, 6)) lines.push(renderItem(item));
  if (items.length > 6) lines.push(`... and ${items.length - 6} more (see report.html)`, "");

  lines.push("What do you want to do?");
  lines.push("   ✅ approve — I trust this, add to policy");
  lines.push("   🛡  guardrail — require approval / scope it down");
  lines.push("   🚫 remove — delete it");
  return lines.join("\n");
}

function renderDiffMessage(diff: PersonalAgentBaselineDiff, items: ChatItem[]): string {
  if (items.length === 0) {
    return [
      "✅ No changes since the last baseline.",
      "",
      `Profile: ${diff.profile}`,
      "Re-run when you've added a new skill: wta diff-baseline . --chat"
    ].join("\n");
  }

  const lines: string[] = [];
  const newSkills = diff.summary.newSkillCount;
  const newChains = diff.summary.addedRiskChainCount;
  const headlineParts = [
    newSkills > 0 ? `${newSkills} new skill${newSkills === 1 ? "" : "s"}` : null,
    newChains > 0 ? `${newChains} new risk chain${newChains === 1 ? "" : "s"}` : null,
    diff.summary.removedSkillCount > 0 ? `${diff.summary.removedSkillCount} removed` : null
  ].filter((part): part is string => Boolean(part));
  const severityIcon = items.some((item) => item.highestRisk === "critical") ? "🔴" : items.some((item) => item.highestRisk === "high") ? "🟠" : "🟡";
  lines.push(`${severityIcon} ${headlineParts.join(" · ")}`, "");

  for (const item of items.slice(0, 6)) lines.push(renderItem(item));
  if (items.length > 6) lines.push(`... and ${items.length - 6} more (see report.html)`, "");

  lines.push("What do you want to do?");
  lines.push("   ✅ approve — I trust this, add to policy");
  lines.push("   🛡  guardrail — require approval / scope it down");
  lines.push("   🚫 remove — delete it");
  return lines.join("\n");
}

function renderItem(item: ChatItem): string {
  const lines: string[] = [];
  const bullet = RISK_BULLET[item.highestRisk];
  const typeLabel = friendlyType(item.type);
  lines.push(`${bullet} ${item.label} (${typeLabel})`);
  if (item.path) lines.push(`   ${item.path}`);
  if (item.capabilities.length >= 2) {
    lines.push(`   ${item.capabilities.slice(0, 4).join(" → ")}${item.capabilities.length > 4 ? " …" : ""}`);
  } else if (item.capabilities.length === 1) {
    lines.push(`   ${item.capabilities[0]}`);
  }
  if (item.riskChainName) lines.push(`   ${item.riskChainName.toLowerCase()}`);
  lines.push(`   ${item.why}`);
  lines.push("");
  return lines.join("\n");
}

function friendlyType(type: ComponentType): string {
  switch (type) {
    case "mcp_server": return "MCP";
    case "skill": return "Skill";
    case "script": return "Script";
    case "prompt": return "Prompt";
    case "rule": return "Rule";
    case "memory": return "Memory";
    case "config": return "Config";
    case "env_var": return "Env";
    case "api_endpoint": return "API";
    case "capability": return "Capability";
  }
}

function riskRank(risk: RiskLevel): number {
  return ({ critical: 4, high: 3, medium: 2, low: 1 } as const)[risk];
}
