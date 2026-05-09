import fs from "node:fs/promises";
import path from "node:path";
import type {
  AgentProfile,
  Capability,
  Component,
  ControlType,
  Finding,
  PersonalAgentBaseline,
  PersonalAgentBaselineDiff,
  PolicyProposal,
  RiskChain,
  SkillPermissionChange,
  UnderstandResult
} from "./types.js";
import { understandWorkspace } from "./understandWorkspace.js";
import { stableJson } from "../output/jsonWriter.js";

const defaultPersonalControls: ControlType[] = [
  "human_approval",
  "command_allowlist",
  "external_domain_allowlist",
  "secret_redaction",
  "secret_scoping",
  "sandbox_enabled",
  "audit_logging",
  "policy_file"
];

const approvalCapabilities: Capability[] = [
  "external_send",
  "execute_code",
  "payment",
  "order_placement",
  "approval_bypass",
  "agent_delegation"
];

export async function createPersonalAgentBaseline(
  workspacePath: string,
  profile: AgentProfile = "personal-agent"
): Promise<PersonalAgentBaseline> {
  const understand = await understandWorkspace(workspacePath, { profile });
  return {
    schemaVersion: "0.1",
    createdAt: new Date().toISOString(),
    profile,
    workspace: {
      root: "."
    },
    understand,
    policyProposal: buildPolicyProposal(understand, profile, "baseline")
  };
}

export async function diffPersonalAgentBaseline(
  workspacePath: string,
  baselineFile: string,
  profile?: AgentProfile
): Promise<PersonalAgentBaselineDiff> {
  const baseline = JSON.parse(await fs.readFile(baselineFile, "utf8")) as PersonalAgentBaseline;
  const activeProfile = profile ?? baseline.profile;
  const current = await understandWorkspace(workspacePath, { profile: activeProfile });

  const baselineComponents = new Map(baseline.understand.scan.components.map((component) => [component.id, component]));
  const currentComponents = new Map(current.scan.components.map((component) => [component.id, component]));
  const baselineFindingIds = new Set(baseline.understand.scan.findings.map((finding) => finding.id));
  const baselineRiskChainIds = new Set(baseline.understand.scan.riskChains.map((chain) => chain.id));

  const newSkills = current.scan.components
    .filter((component) => component.type === "skill" && !baselineComponents.has(component.id))
    .map((component) => skillChange("added", component, current));
  const removedSkills = baseline.understand.scan.components
    .filter((component) => component.type === "skill" && !currentComponents.has(component.id))
    .map((component) => skillChange("removed", component, baseline.understand));
  const addedCapabilities = current.scan.findings.filter((finding) => !baselineFindingIds.has(finding.id));
  const addedRiskChains = current.scan.riskChains.filter((chain) => !baselineRiskChainIds.has(chain.id));
  const policyProposal = buildPolicyProposal(current, activeProfile, "new-skill-review", newSkills);

  return {
    schemaVersion: "0.1",
    profile: activeProfile,
    workspace: {
      root: "."
    },
    baselineCreatedAt: baseline.createdAt,
    newSkills,
    removedSkills,
    addedCapabilities,
    addedRiskChains,
    policyProposal,
    agentPrompt: buildAgentPrompt(newSkills, addedCapabilities, addedRiskChains, policyProposal),
    summary: {
      newSkillCount: newSkills.length,
      removedSkillCount: removedSkills.length,
      addedCapabilityCount: addedCapabilities.length,
      addedRiskChainCount: addedRiskChains.length
    }
  };
}

export function buildPolicyProposal(
  understand: UnderstandResult,
  profile: AgentProfile,
  mode: "baseline" | "new-skill-review",
  skillChanges: SkillPermissionChange[] = []
): PolicyProposal {
  const components = mode === "new-skill-review" && skillChanges.length > 0
    ? skillChanges.map((change) => change.componentId)
    : personalComponentIds(understand);
  const relevantFindings = understand.scan.findings
    .filter((finding) => components.includes(finding.componentId));
  const expectedEntries = expectedPolicyEntries(relevantFindings);

  return {
    profile,
    file: "wta.policy.yaml",
    summary: mode === "baseline"
      ? "Starter personal-agent policy for reviewing powerful skills, identity files, scripts, secrets, and external sends."
      : "Policy proposal for newly added personal-agent skills and their capabilities.",
    yaml: renderPolicyYaml(profile, expectedEntries),
    recommendedControls: defaultPersonalControls,
    appliesTo: components.sort()
  };
}

export function starterPolicy(profile: AgentProfile): string {
  return renderPolicyYaml(profile, []);
}

export async function seededPolicyFromScan(workspacePath: string, profile: AgentProfile): Promise<{ yaml: string; expectedCount: number }> {
  const understand = await understandWorkspace(workspacePath, { profile: isPersonalProfile(profile) ? profile : undefined });
  const entries = expectedPolicyEntries(understand.scan.findings);
  return { yaml: renderPolicyYaml(profile, entries), expectedCount: entries.length };
}

function isPersonalProfile(profile: AgentProfile | undefined): profile is AgentProfile {
  return profile === "personal-agent" || profile === "openclaw" || profile === "hermes";
}

export async function writePersonalBaselineOutputs(outputDir: string, baseline: PersonalAgentBaseline): Promise<string[]> {
  const resolvedDir = path.resolve(outputDir);
  const baselineFile = path.join(resolvedDir, "baseline.json");
  const proposalFile = path.join(resolvedDir, "policy-proposal.yaml");
  const planFile = path.join(resolvedDir, "policy-implementation-plan.md");
  await fs.mkdir(resolvedDir, { recursive: true });
  await fs.writeFile(baselineFile, stableJson(baseline), "utf8");
  await fs.writeFile(proposalFile, baseline.policyProposal.yaml, "utf8");
  await fs.writeFile(planFile, renderPolicyPlan(baseline.policyProposal), "utf8");
  return [baselineFile, proposalFile, planFile];
}

export async function writePersonalDiffOutputs(outputDir: string, diff: PersonalAgentBaselineDiff): Promise<string[]> {
  const resolvedDir = path.resolve(outputDir);
  const diffFile = path.join(resolvedDir, "baseline-diff.json");
  const proposalFile = path.join(resolvedDir, "policy-proposal.yaml");
  const planFile = path.join(resolvedDir, "new-skill-review-plan.md");
  await fs.mkdir(resolvedDir, { recursive: true });
  await fs.writeFile(diffFile, stableJson(diff), "utf8");
  await fs.writeFile(proposalFile, diff.policyProposal.yaml, "utf8");
  await fs.writeFile(planFile, diff.agentPrompt, "utf8");
  return [diffFile, proposalFile, planFile];
}

export async function writeStarterPolicy(filePath: string, profile: AgentProfile, force = false): Promise<void> {
  await writePolicyContent(filePath, starterPolicy(profile), force);
}

export async function writePolicyContent(filePath: string, yaml: string, force = false): Promise<void> {
  if (await fileExists(filePath) && !force) {
    throw new Error(`${filePath} already exists. Use --force to overwrite it.`);
  }
  await fs.mkdir(path.dirname(path.resolve(filePath)), { recursive: true });
  await fs.writeFile(filePath, yaml, "utf8");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return false;
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function personalComponentIds(understand: UnderstandResult): string[] {
  return understand.scan.components
    .filter((component) => component.type === "skill" || component.type === "prompt" || component.type === "rule" || component.type === "memory" || component.type === "script" || component.type === "mcp_server")
    .map((component) => component.id)
    .sort();
}

function skillChange(status: "added" | "removed", component: Component, result: UnderstandResult): SkillPermissionChange {
  const referencedPaths = referencedSkillPaths(component);
  const componentAndChildIds = new Set([
    component.id,
    ...result.scan.components
      .filter((candidate) => candidate.parentId === component.id || (candidate.path ? referencedPaths.has(candidate.path) : false))
      .map((candidate) => candidate.id)
  ]);
  const findings = result.scan.findings.filter((finding) => componentAndChildIds.has(finding.componentId));
  const capabilities = [...new Set(findings.map((finding) => finding.capability))].sort();
  const riskChains = result.scan.riskChains.filter((chain) => chain.componentId === component.id || componentAndChildIds.has(chain.componentId));
  return {
    componentId: component.id,
    label: component.label,
    path: component.path,
    status,
    capabilities,
    findings,
    riskChains
  };
}

function referencedSkillPaths(component: Component): Set<string> {
  const metadata = component.metadata as { referencedFiles?: string[] } | undefined;
  const baseDir = component.path?.includes("/") ? component.path.split("/").slice(0, -1).join("/") : "";
  return new Set(
    (metadata?.referencedFiles ?? [])
      .map((file) => file.startsWith("/") ? file.slice(1) : file)
      .map((file) => path.posix.normalize(baseDir ? `${baseDir}/${file}` : file))
  );
}

function expectedPolicyEntries(findings: Finding[]): Array<{ componentId: string; capability: Capability; reason: string }> {
  const seen = new Set<string>();
  const entries: Array<{ componentId: string; capability: Capability; reason: string }> = [];
  for (const finding of findings) {
    const key = `${finding.componentId}:${finding.capability}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({
      componentId: finding.componentId,
      capability: finding.capability,
      reason: `User approved ${finding.capability} for this personal-agent surface after reviewing WhatTheAgent evidence.`
    });
  }
  return entries.sort((a, b) => `${a.componentId}:${a.capability}`.localeCompare(`${b.componentId}:${b.capability}`));
}

function renderPolicyYaml(profile: AgentProfile, expectedEntries: Array<{ componentId: string; capability: Capability; reason: string }>): string {
  const lines = [
    "# WhatTheAgent personal-agent policy proposal",
    `profile: ${profile}`,
    "",
    "controls:",
    "  identity:",
    "    protectFiles:",
    "      - SOUL.md",
    "      - IDENTITY.md",
    "      - PERSONA.md",
    "      - MEMORY.md",
    "      - AGENTS.md",
    "",
    "human_approval:",
    "  required_for:",
    ...approvalCapabilities.map((capability) => `    - ${capability}`),
    "",
    "command_allowlist:",
    "  commands: []",
    "",
    "external_domain_allowlist:",
    "  domains: []",
    "",
    "network_restriction:",
    "  allowed_hosts: []",
    "",
    "secret_redaction: true",
    "secret_scoping: true",
    "least_privilege_token: true",
    "sandbox_enabled: true",
    "audit_logging: true",
    "",
    "expected:"
  ];

  if (expectedEntries.length === 0) {
    lines.push("  []");
  } else {
    for (const entry of expectedEntries) {
      lines.push(`  - component: "${entry.componentId}"`);
      lines.push(`    capability: "${entry.capability}"`);
      lines.push(`    reason: "${entry.reason}"`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function renderPolicyPlan(proposal: PolicyProposal): string {
  return [
    "# WhatTheAgent Personal-Agent Policy Plan",
    "",
    proposal.summary,
    "",
    "Ask the user before applying this policy. If approved, create or update `wta.policy.yaml` with `.wta/policy-proposal.yaml`.",
    "",
    "Do not execute personal-agent tools, MCP servers, scripts, payments, or external sends while applying this policy.",
    "",
    "Recommended controls:",
    ...proposal.recommendedControls.map((control) => `- ${control}`),
    "",
    "Applies to:",
    ...proposal.appliesTo.map((componentId) => `- ${componentId}`)
  ].join("\n") + "\n";
}

function buildAgentPrompt(
  newSkills: SkillPermissionChange[],
  addedCapabilities: Finding[],
  addedRiskChains: RiskChain[],
  proposal: PolicyProposal
): string {
  const lines = [
    "# WhatTheAgent New Skill Review",
    "",
    "A personal-agent baseline changed. Ask the user whether to accept the new capabilities or add guardrails before using the new skill.",
    "",
    "User decision to request:",
    "- Accept these capabilities and add them to `expected` policy entries, or",
    "- Add guardrails such as approval, command allowlist, domain allowlist, secret scoping, sandboxing, or audit logging.",
    "",
    "New skills:"
  ];

  if (newSkills.length === 0) {
    lines.push("- none");
  } else {
    for (const skill of newSkills) {
      lines.push(`- ${skill.label} (${skill.path ?? skill.componentId})`);
      lines.push(`  Capabilities: ${skill.capabilities.join(", ") || "none detected"}`);
      if (skill.riskChains.length > 0) {
        lines.push(`  Risk chains: ${skill.riskChains.map((chain) => `${chain.name} (${chain.risk})`).join(", ")}`);
      }
    }
  }

  lines.push("", "Added capabilities:");
  for (const finding of addedCapabilities.slice(0, 30)) {
    const location = finding.evidence.line ? `${finding.evidence.file}:${finding.evidence.line}` : finding.evidence.file;
    lines.push(`- ${finding.capability} on ${finding.componentId} from ${finding.evidence.pattern} at ${location}`);
  }
  if (addedCapabilities.length === 0) lines.push("- none");

  lines.push("", "Added risk chains:");
  for (const chain of addedRiskChains) {
    lines.push(`- ${chain.risk}: ${chain.name} on ${chain.componentId} (${chain.capabilities.join(" + ")})`);
  }
  if (addedRiskChains.length === 0) lines.push("- none");

  lines.push(
    "",
    "Policy proposal:",
    "```yaml",
    proposal.yaml.trimEnd(),
    "```",
    "",
    "Implementation instructions:",
    "- Do not execute the new skill while reviewing it.",
    "- Do not start MCP servers.",
    "- Do not send network requests or payments.",
    "- If the user accepts, update `wta.policy.yaml` with expected entries and controls.",
    "- If the user wants guardrails, add or tighten controls before approving the skill."
  );

  return `${lines.join("\n")}\n`;
}
