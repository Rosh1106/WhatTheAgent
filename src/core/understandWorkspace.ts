import fs from "node:fs/promises";
import path from "node:path";
import type {
  AgentSurface,
  Capability,
  CapabilityGraph,
  Confidence,
  Component,
  Control,
  ControlGap,
  ControlType,
  Finding,
  GraphEdge,
  GraphNode,
  ImplementationTask,
  NormalizedCapability,
  Observation,
  QuickFix,
  RiskLevel,
  ScanOptions,
  ScanResult,
  ToolServer,
  UserImpact,
  UnderstandResult
} from "./types.js";
import { highestRiskLevel } from "../risk/classifier.js";
import { sensitivityForFinding, type Sensitivity } from "../risk/sensitivity.js";
import { scanWorkspace } from "./scanWorkspace.js";
import { sortGraphEdges, sortGraphNodes, stableId } from "../utils/normalize.js";

const policyFiles = [
  "wta.policy.yaml",
  "wta.policy.yml",
  "wta.policy.json",
  ".wta/policy.yaml",
  ".wta/policy.yml",
  ".wta/policy.json"
];

const ciWorkflowDir = ".github/workflows";

interface WorkspacePolicy {
  expected: PolicyExpectation[];
  suppressions: PolicySuppression[];
}

interface PolicyExpectation {
  component?: string;
  capability?: Capability;
  reason: string;
}

interface PolicySuppression extends PolicyExpectation {
  expires?: string;
}

interface GapAnalysis {
  controlGaps: ControlGap[];
  observations: Observation[];
  expected: Observation[];
}

export async function understandWorkspace(workspacePath: string, options: ScanOptions = {}): Promise<UnderstandResult> {
  const root = path.resolve(workspacePath);
  const scan = await scanWorkspace(root, options);
  const { controls: detectedControls, policy } = await detectControls(root);
  const riskChains = enrichRiskChains(scan.riskChains.filter((chain) => !policyMatchesChain(chain, policy)));
  const expectedRiskChains = expectedObservationsForRiskChains(scan.riskChains, policy);
  const analysis = buildGapAnalysis(scan, detectedControls, policy);
  const controlGaps = analysis.controlGaps;
  const toolServers = buildToolServers(scan, controlGaps, detectedControls.map((control) => control.type), riskChains);
  const controls = buildControls(controlGaps, detectedControls);
  const quickFixes = buildQuickFixes(controlGaps, scan);
  const implementationTasks = buildImplementationTasks(quickFixes);
  const surfaces = buildSurfaces(scan, toolServers, controlGaps, controls, riskChains);
  const observations = [
    ...buildInventoryObservations(scan, toolServers, controls),
    ...analysis.observations
  ].sort((a, b) => a.id.localeCompare(b.id));
  const capabilities = buildCapabilities(scan.findings, scan.components);
  const expected = [...analysis.expected, ...expectedRiskChains].sort((a, b) => a.id.localeCompare(b.id));
  const graph = buildUnderstandGraph(scan.graph, controls, controlGaps, quickFixes, implementationTasks, surfaces, observations, expected);

  return {
    schemaVersion: "0.1",
    workspace: {
      root: "."
    },
    inventory: {
      workspaceRoot: ".",
      surfaces,
      toolServers,
      compatibility: scan.compatibility,
      counts: {
        skills: scan.summary.componentsByType.skill,
        scripts: scan.summary.componentsByType.script,
        toolServers: toolServers.length,
        findings: scan.findings.length,
        riskChains: scan.riskChains.length
      }
    },
    capabilities,
    observations,
    expected,
    controls,
    controlGaps,
    riskChains,
    quickFixes,
    implementationTasks,
    graph,
    scan,
    summary: {
      capabilityCount: capabilities.length,
      controlGapCount: controlGaps.length,
      quickFixCount: quickFixes.length,
      implementationTaskCount: implementationTasks.length,
      criticalRiskChains: riskChains.filter((chain) => chain.risk === "critical").length,
      highRiskChains: riskChains.filter((chain) => chain.risk === "high").length
    }
  };
}

async function detectControls(root: string): Promise<{ controls: Control[]; policy: WorkspacePolicy }> {
  const controls = new Map<ControlType, Control>();
  const policy: WorkspacePolicy = { expected: [], suppressions: [] };

  for (const relativeFile of policyFiles) {
    const absolute = path.join(root, relativeFile);
    const content = await readIfExists(absolute);
    if (content === undefined) continue;
    addDetectedControl(controls, "policy_file", relativeFile, "policy file");
    mergePolicy(policy, parsePolicy(content));
    for (const controlType of detectPolicyControls(content)) {
      addDetectedControl(controls, controlType, relativeFile, `policy:${controlType}`);
    }
  }

  const workflowDir = path.join(root, ciWorkflowDir);
  const workflowFiles = await listFilesIfExists(workflowDir);
  for (const file of workflowFiles) {
    const content = await readIfExists(file);
    if (!content) continue;
    const relativeFile = path.join(ciWorkflowDir, path.basename(file));
    if (/\b(wta|whattheagent)\b/i.test(content)) {
      addDetectedControl(controls, "ci_gate", relativeFile, "ci:whattheagent");
    }
    if (/audit|upload-artifact|sarif|summary/i.test(content)) {
      addDetectedControl(controls, "audit_logging", relativeFile, "ci:audit");
    }
  }

  return {
    controls: [...controls.values()].sort((a, b) => a.id.localeCompare(b.id)),
    policy
  };
}

function mergePolicy(target: WorkspacePolicy, source: WorkspacePolicy): void {
  target.expected.push(...source.expected);
  target.suppressions.push(...source.suppressions);
}

function parsePolicy(content: string): WorkspacePolicy {
  return {
    expected: parsePolicyEntries(content, "expected"),
    suppressions: parsePolicyEntries(content, "suppressions")
  };
}

function parsePolicyEntries(content: string, section: "expected" | "suppressions"): Array<PolicyExpectation | PolicySuppression> {
  const lines = content.split(/\r?\n/);
  const entries: Array<PolicyExpectation | PolicySuppression> = [];
  let inSection = false;
  let current: Record<string, string> | undefined;

  for (const line of lines) {
    if (new RegExp(`^${section}:\\s*$`).test(line.trim())) {
      inSection = true;
      continue;
    }
    if (inSection && /^[A-Za-z0-9_-]+:\s*$/.test(line.trim()) && !line.startsWith(" ")) {
      break;
    }
    if (!inSection) continue;

    const itemStart = line.match(/^\s*-\s+component:\s*["']?([^"']+)["']?\s*$/);
    if (itemStart) {
      if (current) entries.push(policyEntry(current));
      current = { component: itemStart[1]?.trim() ?? "" };
      continue;
    }
    const keyValue = line.match(/^\s+(component|capability|reason|expires):\s*["']?([^"']+)["']?\s*$/);
    if (keyValue && current) {
      current[keyValue[1] ?? ""] = keyValue[2]?.trim() ?? "";
    }
  }

  if (current) entries.push(policyEntry(current));
  return entries.filter((entry) => entry.reason);
}

function policyEntry(values: Record<string, string>): PolicyExpectation | PolicySuppression {
  return {
    component: values.component,
    capability: values.capability as Capability | undefined,
    reason: values.reason || "Expected by policy",
    expires: values.expires
  };
}

function detectPolicyControls(content: string): ControlType[] {
  const patterns: Array<[ControlType, RegExp]> = [
    ["human_approval", /human[_-]?approval|approval|required_approval|require_approval/i],
    ["command_allowlist", /command[_-]?allowlist|allowed[_-]?commands|commands:\s*\[/i],
    ["external_domain_allowlist", /external[_-]?domain[_-]?allowlist|allowed[_-]?domains|domains:\s*\[/i],
    ["secret_redaction", /secret[_-]?redaction|redact[_-]?secrets|mask[_-]?secrets/i],
    ["secret_scoping", /secret[_-]?scoping|scoped[_-]?secret|secret[_-]?scope/i],
    ["read_only_filesystem", /read[_-]?only[_-]?filesystem|read[_-]?only|write[_-]?deny/i],
    ["network_restriction", /network[_-]?restriction|network[_-]?deny|allowed[_-]?hosts|egress/i],
    ["sandbox_enabled", /sandbox[_-]?enabled|sandbox:\s*(true|enabled)|container/i],
    ["ci_gate", /ci[_-]?gate|pull_request|required_check/i],
    ["audit_logging", /audit[_-]?logging|audit:\s*(true|enabled)|log[_-]?tool[_-]?calls/i],
    ["least_privilege_token", /least[_-]?privilege[_-]?token|token[_-]?scope|scoped[_-]?token/i],
    ["delegation_policy", /delegation[_-]?policy|allowed[_-]?subagents|subagent/i],
    ["payment_approval", /payment[_-]?approval|commerce[_-]?approval|purchase[_-]?approval/i]
  ];

  return patterns
    .filter(([, regex]) => regex.test(content))
    .map(([control]) => control)
    .sort();
}

function addDetectedControl(controls: Map<ControlType, Control>, type: ControlType, file: string, pattern: string): void {
  if (controls.has(type)) return;
  controls.set(type, {
    id: stableId("control", type),
    type,
    label: humanize(type),
    status: "detected",
    evidence: {
      file,
      pattern
    }
  });
}

async function readIfExists(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return undefined;
    throw error;
  }
}

async function listFilesIfExists(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && /\.(ya?ml|json)$/i.test(entry.name))
      .map((entry) => path.join(dirPath, entry.name))
      .sort();
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return [];
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function buildToolServers(
  scan: ScanResult,
  controlGaps: ControlGap[],
  detectedControlTypes: ControlType[] = [],
  activeRiskChains: ScanResult["riskChains"] = scan.riskChains
): ToolServer[] {
  return scan.components
    .filter((component) => component.type === "mcp_server")
    .map((component) => {
      const metadata = component.metadata as {
        command?: string;
        args?: string[];
        env?: Record<string, string>;
        transport?: string;
      };
      const capabilities = capabilitiesForComponent(scan.findings, component.id);
      const chainIds = activeRiskChains.filter((chain) => chain.componentId === component.id).map((chain) => chain.id).sort();
      const gapIds = controlGaps.filter((gap) => gap.componentId === component.id).map((gap) => gap.id).sort();
      const controlTypes = controlsForCapabilities(capabilities, detectedControlTypes).sort();
      return {
        id: component.id,
        type: "ToolServer" as const,
        subtype: "mcp_server" as const,
        label: component.label,
        path: component.path,
        command: metadata.command,
        args: metadata.args ?? [],
        transport: metadata.transport,
        envVars: Object.keys(metadata.env ?? {}).sort(),
        capabilities,
        controls: controlTypes,
        controlGaps: gapIds,
        riskChains: chainIds
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function buildSurfaces(
  scan: ScanResult,
  toolServers: ToolServer[],
  controlGaps: ControlGap[],
  controls: Control[],
  activeRiskChains: ScanResult["riskChains"] = scan.riskChains
): AgentSurface[] {
  const toolServerById = new Map(toolServers.map((server) => [server.id, server]));
  const detected = controls.filter((control) => control.status === "detected").map((control) => control.type);
  return scan.components
    .filter((component) => component.type === "skill" || component.type === "script" || component.type === "mcp_server" || component.type === "prompt" || component.type === "rule" || component.type === "memory" || component.type === "config")
    .map((component) => {
      const gaps = controlGaps.filter((gap) => gap.componentId === component.id).map((gap) => gap.id).sort();
      const chainIds = activeRiskChains.filter((chain) => chain.componentId === component.id).map((chain) => chain.id).sort();
      const type = surfaceType(component.type);
      const subtype = component.type === "mcp_server" ? "mcp_server" : undefined;
      const toolServer = toolServerById.get(component.id);
      return {
        id: component.id,
        type,
        subtype,
        label: component.label,
        path: component.path,
        capabilities: toolServer?.capabilities ?? capabilitiesForComponent(scan.findings, component.id),
        controls: controlsForCapabilities(toolServer?.capabilities ?? capabilitiesForComponent(scan.findings, component.id), detected),
        controlGaps: gaps,
        riskChains: chainIds
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function surfaceType(type: Component["type"]): AgentSurface["type"] {
  switch (type) {
    case "mcp_server":
      return "tool_server";
    case "skill":
      return "skill";
    case "script":
      return "script";
    case "prompt":
      return "prompt";
    case "rule":
      return "rule";
    case "memory":
      return "memory";
    default:
      return "config";
  }
}

function buildCapabilities(findings: Finding[], components: Component[]): NormalizedCapability[] {
  const byCapability = new Map<Capability, Finding[]>();
  const componentById = new Map(components.map((component) => [component.id, component]));
  for (const finding of findings) {
    byCapability.set(finding.capability, [...(byCapability.get(finding.capability) ?? []), finding]);
  }

  return [...byCapability.entries()]
    .map(([capability, groupedFindings]) => {
      const sensitivity = highestSensitivity(groupedFindings.map((finding) => sensitivityForFinding(finding, componentById.get(finding.componentId))));
      return {
        capability,
        state: "inferred" as const,
        count: groupedFindings.length,
        risk: highestRiskLevel(groupedFindings.map((finding) => finding.risk)),
        evidence: groupedFindings.map((finding) => finding.evidence).slice(0, 20),
        category: sensitivity === "normal" ? "observation" as const : "needs_attention" as const,
        confidence: confidenceForFindings(groupedFindings),
        impact: impactForSensitivity(sensitivity)
      };
    })
    .sort((a, b) => a.capability.localeCompare(b.capability));
}

function buildGapAnalysis(scan: ScanResult, detectedControls: Control[], policy: WorkspacePolicy): GapAnalysis {
  const gaps: ControlGap[] = [];
  const observations: Observation[] = [];
  const expected: Observation[] = [];
  const seen = new Set<string>();
  const detected = new Set(detectedControls.map((control) => control.type));
  const componentById = new Map(scan.components.map((component) => [component.id, component]));
  const riskComponentIds = importantRiskComponentIds(scan, policy);

  if (!detected.has("policy_file") && scan.findings.length > 0) {
    gaps.push({
      id: stableId("gap", "workspace.root-policy_file"),
        control: "policy_file",
        componentId: "workspace.root",
        risk: "medium",
        message: "No WhatTheAgent policy file was detected for this workspace.",
        evidence: [{ file: ".", pattern: "missing:wta.policy" }],
        category: "control_gap",
        confidence: "high",
        impact: "review_recommended"
      });
  }

  if (!detected.has("ci_gate") && scan.riskChains.some((chain) => (chain.risk === "critical" || chain.risk === "high") && !policyMatchesChain(chain, policy))) {
    gaps.push({
      id: stableId("gap", "workspace.root-ci_gate"),
        control: "ci_gate",
        componentId: "workspace.root",
        risk: "medium",
        message: "No CI gate was detected for WhatTheAgent risk checks.",
        evidence: [{ file: ".", pattern: "missing:ci_gate" }],
        category: "control_gap",
        confidence: "high",
        impact: "review_recommended"
      });
  }

  for (const finding of scan.findings) {
    const component = componentById.get(finding.componentId);
    const policyMatch = policyMatchForFinding(finding, policy);
    if (policyMatch) {
      expected.push(observationFromFinding(finding, component, policyMatch.reason, true));
      continue;
    }

    const sensitivity = sensitivityForFinding(finding, component);
    const hasImportantRiskChain = riskComponentIds.has(finding.componentId) || (component?.parentId ? riskComponentIds.has(component.parentId) : false);
    const dangerousStandalone = isDangerousStandaloneCapability(finding.capability);

    if (sensitivity === "normal" && !hasImportantRiskChain && !dangerousStandalone) {
      observations.push(observationFromFinding(finding, component));
      continue;
    }

    for (const rule of gapRulesForCapability(finding.capability)) {
      if (detected.has(rule.control)) continue;
      const key = `${finding.componentId}:${rule.control}`;
      if (seen.has(key)) continue;
      seen.add(key);
      gaps.push({
        id: stableId("gap", key),
        control: rule.control,
        componentId: finding.componentId,
        risk: rule.risk,
        message: rule.message,
        evidence: [finding.evidence],
        category: "control_gap",
        confidence: confidenceForFinding(finding),
        impact: rule.risk === "critical" ? "fix_required" : "fix_recommended"
      });
    }
  }

  return {
    controlGaps: gaps.sort((a, b) => a.id.localeCompare(b.id)),
    observations: observations.sort((a, b) => a.id.localeCompare(b.id)),
    expected: expected.sort((a, b) => a.id.localeCompare(b.id))
  };
}

function gapRulesForCapability(capability: Capability): Array<{ control: ControlType; risk: RiskLevel; message: string }> {
  switch (capability) {
    case "execute_code":
      return [
        { control: "human_approval", risk: "high", message: "Code execution should require explicit human approval or a trusted automation context." },
        { control: "command_allowlist", risk: "high", message: "Executable commands should be constrained by an allowlist." },
        { control: "sandbox_enabled", risk: "high", message: "Code execution should run inside a sandboxed or constrained environment." }
      ];
    case "external_send":
      return [
        { control: "external_domain_allowlist", risk: "high", message: "External sends should be limited to approved domains or services." },
        { control: "audit_logging", risk: "medium", message: "External sends should produce an audit trail." }
      ];
    case "network_access":
      return [
        { control: "network_restriction", risk: "medium", message: "Network access should be restricted to expected destinations." }
      ];
    case "credential_access":
      return [
        { control: "secret_scoping", risk: "high", message: "Credential access should be scoped to the smallest needed token or secret." },
        { control: "secret_redaction", risk: "high", message: "Secret values should be redacted from logs, prompts, and generated outputs." },
        { control: "least_privilege_token", risk: "high", message: "Tokens should use least-privilege permissions." }
      ];
    case "write_file":
      return [
        { control: "read_only_filesystem", risk: "medium", message: "File writes should be scoped, reviewed, or disabled in read-only contexts." }
      ];
    case "payment":
    case "order_placement":
      return [
        { control: "payment_approval", risk: "critical", message: "Financial or commerce actions should require payment approval." },
        { control: "human_approval", risk: "critical", message: "Financial or commerce actions should require explicit human approval." }
      ];
    case "agent_delegation":
      return [
        { control: "delegation_policy", risk: "medium", message: "Agent delegation should be governed by a delegation policy." }
      ];
    case "approval_bypass":
      return [
        { control: "human_approval", risk: "high", message: "Instructions that discourage confirmation should be countered with approval policy." }
      ];
    default:
      return [];
  }
}

function importantRiskComponentIds(scan: ScanResult, policy: WorkspacePolicy): Set<string> {
  return new Set(
    scan.riskChains
      .filter((chain) => (chain.risk === "critical" || chain.risk === "high") && !policyMatchesChain(chain, policy))
      .map((chain) => chain.componentId)
  );
}

function policyMatchesChain(chain: ScanResult["riskChains"][number], policy: WorkspacePolicy): boolean {
  return chain.capabilities.every((capability) => {
    const finding: Finding = {
      id: `${chain.id}-${capability}`,
      componentId: chain.componentId,
      capability,
      risk: chain.risk,
      evidence: chain.evidence[0] ?? { file: ".", pattern: "risk_chain" }
    };
    return policyMatchForFinding(finding, policy);
  });
}

function expectedObservationsForRiskChains(scanRiskChains: ScanResult["riskChains"], policy: WorkspacePolicy): Observation[] {
  return scanRiskChains
    .filter((chain) => policyMatchesChain(chain, policy))
    .map((chain) => ({
      id: stableId("expected", `${chain.id}-risk-chain`),
      componentId: chain.componentId,
      category: "inventory",
      confidence: chain.evidence.length > 1 ? "high" : "medium",
      impact: "informational",
      message: `Expected risk chain acknowledged by policy: ${chain.name}.`,
      evidence: chain.evidence,
      expected: true,
      suppressionReason: "All capabilities in this chain are expected or suppressed by policy."
    }));
}

function isDangerousStandaloneCapability(capability: Capability): boolean {
  return capability === "credential_access"
    || capability === "execute_code"
    || capability === "payment"
    || capability === "order_placement"
    || capability === "approval_bypass";
}

function policyMatchForFinding(finding: Finding, policy: WorkspacePolicy): PolicyExpectation | undefined {
  const candidates = [...policy.expected, ...policy.suppressions.filter((suppression) => !isExpired(suppression.expires))];
  return candidates.find((entry) => {
    const componentMatches = !entry.component || wildcardMatch(finding.componentId, entry.component);
    const capabilityMatches = !entry.capability || finding.capability === entry.capability;
    return componentMatches && capabilityMatches;
  });
}

function isExpired(value: string | undefined): boolean {
  if (!value) return false;
  const expires = Date.parse(value);
  return Number.isFinite(expires) && expires < Date.now();
}

function wildcardMatch(value: string, pattern: string): boolean {
  const regex = new RegExp(`^${pattern.split("*").map(escapeRegex).join(".*")}$`);
  return regex.test(value);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function observationFromFinding(finding: Finding, component: Component | undefined, reason?: string, expected = false): Observation {
  const sensitivity = sensitivityForFinding(finding, component);
  return {
    id: stableId(expected ? "expected" : "observation", `${finding.id}-${reason ?? ""}`),
    componentId: finding.componentId,
    capability: finding.capability,
    category: expected ? "inventory" : sensitivity === "normal" ? "observation" : "needs_attention",
    confidence: confidenceForFinding(finding),
    impact: expected ? "informational" : impactForSensitivity(sensitivity),
    message: reason ?? observationMessage(finding, component),
    evidence: [finding.evidence],
    expected,
    suppressionReason: expected ? reason : undefined
  };
}

function buildInventoryObservations(scan: ScanResult, toolServers: ToolServer[], controls: Control[]): Observation[] {
  const observations: Observation[] = [];
  for (const server of toolServers) {
    observations.push({
      id: stableId("observation", `${server.id}-detected`),
      componentId: server.id,
      category: "inventory",
      confidence: "high",
      impact: "informational",
      message: `MCP server detected: ${server.label}.`,
      evidence: server.path ? [{ file: server.path, pattern: "tool_server" }] : []
    });
  }
  for (const control of controls.filter((control) => control.status === "detected")) {
    observations.push({
      id: stableId("observation", `${control.id}-detected`),
      componentId: control.componentId ?? "workspace.root",
      category: "observation",
      confidence: "high",
      impact: "informational",
      message: `Control detected: ${control.label}.`,
      evidence: control.evidence ? [control.evidence] : []
    });
  }
  if (scan.summary.componentsByType.skill > 0) {
    observations.push({
      id: "observation.skills-detected",
      componentId: "workspace.root",
      category: "inventory",
      confidence: "high",
      impact: "informational",
      message: `${scan.summary.componentsByType.skill} skill${scan.summary.componentsByType.skill === 1 ? "" : "s"} detected.`,
      evidence: []
    });
  }
  return observations;
}

function observationMessage(finding: Finding, component: Component | undefined): string {
  const label = component?.label ?? finding.componentId;
  switch (finding.capability) {
    case "network_access":
      return `${label} can access network resources.`;
    case "read_file":
      return `${label} can read files.`;
    case "write_file":
      return `${label} can write files.`;
    case "external_send":
      return `${label} can send data externally.`;
    case "credential_access":
      return `${label} references credentials or environment values.`;
    case "execute_code":
      return `${label} can execute local code or commands.`;
    default:
      return `${label} has capability ${finding.capability}.`;
  }
}

function confidenceForFindings(findings: Finding[]): Confidence {
  if (findings.some((finding) => confidenceForFinding(finding) === "high")) return "high";
  if (findings.some((finding) => confidenceForFinding(finding) === "medium")) return "medium";
  return "low";
}

function confidenceForFinding(finding: Finding): Confidence {
  if (finding.capability === "payment" || finding.capability === "order_placement") return "high";
  if (finding.capability === "credential_access" || finding.capability === "execute_code" || finding.capability === "external_send") return "high";
  if (finding.capability === "network_access" || finding.capability === "write_file" || finding.capability === "approval_bypass") return "medium";
  return "low";
}

function highestSensitivity(values: Sensitivity[]): Sensitivity {
  if (values.includes("critical")) return "critical";
  if (values.includes("sensitive")) return "sensitive";
  return "normal";
}

function impactForSensitivity(sensitivity: Sensitivity): UserImpact {
  if (sensitivity === "critical") return "fix_required";
  if (sensitivity === "sensitive") return "review_recommended";
  return "informational";
}

function buildControls(controlGaps: ControlGap[], detectedControls: Control[]): Control[] {
  const controls = new Map<ControlType, Control>();
  for (const control of detectedControls) {
    controls.set(control.type, control);
  }
  for (const gap of controlGaps) {
    if (controls.has(gap.control)) continue;
    controls.set(gap.control, {
      id: stableId("control", gap.control),
      type: gap.control,
      label: humanize(gap.control),
      status: "missing"
    });
  }
  return [...controls.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function enrichRiskChains(riskChains: ScanResult["riskChains"]): ScanResult["riskChains"] {
  return riskChains.map((chain) => ({
    ...chain,
    category: "risk_chain",
    confidence: chain.evidence.length > 1 ? "high" : "medium",
    impact: chain.risk === "critical" ? "fix_required" : "fix_recommended"
  }));
}

function buildQuickFixes(controlGaps: ControlGap[], scan: ScanResult): QuickFix[] {
  return controlGaps.map((gap) => {
    const component = scan.components.find((candidate) => candidate.id === gap.componentId);
    return {
      id: stableId("fix", `${gap.componentId}-${gap.control}`),
      kind: quickFixKind(gap.control),
      title: quickFixTitle(gap.control, component?.label ?? gap.componentId),
      componentId: gap.componentId,
      risk: gap.risk,
      rationale: gap.message,
      steps: quickFixSteps(gap.control, component),
      controlGaps: [gap.id],
      category: "fix_ready",
      confidence: gap.confidence ?? "medium",
      impact: gap.impact ?? "fix_recommended"
    };
  });
}

function quickFixKind(control: ControlType): "safe_autofix" | "guided_fix" | "agent_implementation_task" {
  return control === "policy_file" || control === "ci_gate" ? "safe_autofix" : "guided_fix";
}

function quickFixTitle(control: ControlType, label: string): string {
  return `${humanize(control)} for ${label}`;
}

function quickFixSteps(control: ControlType, component?: Component): string[] {
  const location = component?.path ? ` in ${component.path}` : "";
  switch (control) {
    case "human_approval":
      return [`Add an explicit approval requirement before this capability can run${location}.`, "Document the approval condition in a policy file or agent instruction."];
    case "policy_file":
      return ["Create wta.policy.yaml at the workspace root.", "Declare approval, command, network, secret, sandbox, and CI controls that match the workspace risk profile."];
    case "ci_gate":
      return ["Add a GitHub Actions workflow or CI job that runs WhatTheAgent in JSON mode.", "Fail or warn when new high-risk chains are introduced."];
    case "sandbox_enabled":
      return ["Run executable tools inside a constrained sandbox where possible.", "Document which commands, paths, and network destinations are available inside the sandbox."];
    case "command_allowlist":
      return [`List the exact commands allowed for this component${location}.`, "Block or require review for all other commands."];
    case "external_domain_allowlist":
      return [`Define approved external domains for this component${location}.`, "Require review before sending data to any other destination."];
    case "secret_redaction":
      return ["Redact token-like values from logs, prompts, generated reports, and tool output.", "Add tests or checks for common secret names."];
    case "secret_scoping":
      return ["Replace broad secrets with narrowly scoped tokens.", "Avoid loading credentials unless the component is explicitly invoked."];
    case "least_privilege_token":
      return ["Review token permissions and reduce them to the minimum required scope.", "Prefer separate tokens per MCP server or skill."];
    case "network_restriction":
      return ["Restrict outbound network access to expected APIs.", "Log or require approval for new destinations."];
    case "read_only_filesystem":
      return ["Run this component in read-only mode when possible.", "Require explicit paths for any allowed write operations."];
    case "payment_approval":
      return ["Require explicit approval for payment, refund, checkout, order, or purchase actions.", "Add a dry-run mode for commerce flows."];
    case "delegation_policy":
      return ["Define which subagents can be spawned and what context may be shared.", "Require approval before delegation outside the current workspace."];
    default:
      return [`Add ${humanize(control)} coverage for this component.`];
  }
}

function buildImplementationTasks(quickFixes: QuickFix[]): ImplementationTask[] {
  return quickFixes.map((fix) => ({
    id: stableId("task", fix.id),
    title: `Implement ${fix.title}`,
    priority: fix.risk,
    targetFiles: ["wta.policy.yaml", fix.componentId ?? ""].filter(Boolean),
    instructions: `Implement a reviewable control for ${fix.title}. Do not remove functionality silently. Prefer policy, allowlist, sandbox, scoped secret, or explicit approval gates over deleting code.`,
    acceptanceCriteria: [
      "The risky capability remains documented in WhatTheAgent output.",
      "The missing control is represented by a policy, allowlist, approval gate, or scoped secret.",
      "The change is reviewable and does not execute untrusted code during validation."
    ],
    relatedQuickFixes: [fix.id],
    category: "fix_ready",
    confidence: fix.confidence ?? "medium",
    impact: fix.impact ?? "fix_recommended",
    verificationCommands: ["npm run typecheck", "npm run build", "npm run dev -- understand ."],
    doNotDo: [
      "Do not remove useful agent functionality unless the user explicitly approves.",
      "Do not execute real external sends, payments, or destructive commands in tests.",
      "Do not print or persist secret values."
    ],
    why: fix.rationale
  }));
}

function buildUnderstandGraph(
  baseGraph: CapabilityGraph,
  controls: Control[],
  controlGaps: ControlGap[],
  quickFixes: QuickFix[],
  implementationTasks: ImplementationTask[],
  surfaces: AgentSurface[],
  observations: Observation[],
  expected: Observation[]
): CapabilityGraph {
  const nodes: GraphNode[] = [...baseGraph.nodes];
  const edges: GraphEdge[] = [...baseGraph.edges];

  for (const control of controls) {
    nodes.push({ id: control.id, type: "Control", label: control.label, metadata: { status: control.status, control: control.type } });
  }

  for (const observation of [...observations, ...expected]) {
    nodes.push({
      id: observation.id,
      type: "Observation",
      label: observation.message,
      metadata: {
        category: observation.category,
        confidence: observation.confidence,
        impact: observation.impact,
        capability: observation.capability,
        expected: observation.expected
      }
    });
    edges.push({ from: observation.componentId, to: observation.id, type: "DEFINED_IN", evidence: observation.evidence[0] });
  }

  for (const surface of surfaces) {
    for (const controlType of surface.controls) {
      edges.push({ from: surface.id, to: stableId("control", controlType), type: "PROTECTED_BY" });
    }
  }

  for (const gap of controlGaps) {
    nodes.push({ id: gap.id, type: "ControlGap", label: humanize(gap.control), metadata: { risk: gap.risk, message: gap.message, control: gap.control } });
    edges.push({ from: gap.componentId, to: gap.id, type: "MISSING_CONTROL", evidence: gap.evidence[0] });
    edges.push({ from: gap.id, to: stableId("control", gap.control), type: "DEFINED_IN" });
  }

  for (const fix of quickFixes) {
    nodes.push({ id: fix.id, type: "QuickFix", label: fix.title, metadata: { kind: fix.kind, risk: fix.risk } });
    for (const gapId of fix.controlGaps) {
      edges.push({ from: gapId, to: fix.id, type: "CAN_BE_FIXED_BY" });
    }
  }

  for (const task of implementationTasks) {
    nodes.push({ id: task.id, type: "ImplementationTask", label: task.title, metadata: { priority: task.priority, targetFiles: task.targetFiles } });
    for (const fixId of task.relatedQuickFixes) {
      edges.push({ from: fixId, to: task.id, type: "IMPLEMENTED_BY" });
    }
  }

  return {
    nodes: sortGraphNodes(dedupeNodes(nodes)),
    edges: sortGraphEdges(dedupeEdges(edges))
  };
}

function capabilitiesForComponent(findings: Finding[], componentId: string): Capability[] {
  return [...new Set(findings.filter((finding) => finding.componentId === componentId).map((finding) => finding.capability))].sort();
}

function controlsForCapabilities(capabilities: Capability[], detectedControls: ControlType[]): ControlType[] {
  const relevant = new Set<ControlType>();
  for (const capability of capabilities) {
    for (const rule of gapRulesForCapability(capability)) {
      relevant.add(rule.control);
    }
  }
  return detectedControls.filter((control) => relevant.has(control)).sort();
}

function humanize(value: string): string {
  return value.replace(/_/g, " ");
}

function dedupeNodes(nodes: GraphNode[]): GraphNode[] {
  return [...new Map(nodes.map((node) => [node.id, node])).values()];
}

function dedupeEdges(edges: GraphEdge[]): GraphEdge[] {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    const key = `${edge.from}:${edge.to}:${edge.type}:${edge.evidence?.file ?? ""}:${edge.evidence?.line ?? ""}:${edge.evidence?.pattern ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
