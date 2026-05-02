import fs from "node:fs/promises";
import path from "node:path";
import type {
  AgentSurface,
  Capability,
  CapabilityGraph,
  Component,
  Control,
  ControlGap,
  ControlType,
  Finding,
  GraphEdge,
  GraphNode,
  ImplementationTask,
  NormalizedCapability,
  QuickFix,
  RiskLevel,
  ScanOptions,
  ScanResult,
  ToolServer,
  UnderstandResult
} from "./types.js";
import { highestRiskLevel } from "../risk/classifier.js";
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

export async function understandWorkspace(workspacePath: string, options: ScanOptions = {}): Promise<UnderstandResult> {
  const root = path.resolve(workspacePath);
  const scan = await scanWorkspace(root, options);
  const detectedControls = await detectControls(root);
  const controlGaps = buildControlGaps(scan, detectedControls);
  const toolServers = buildToolServers(scan, controlGaps, detectedControls.map((control) => control.type));
  const controls = buildControls(controlGaps, detectedControls);
  const quickFixes = buildQuickFixes(controlGaps, scan);
  const implementationTasks = buildImplementationTasks(quickFixes);
  const surfaces = buildSurfaces(scan, toolServers, controlGaps, controls);
  const capabilities = buildCapabilities(scan.findings);
  const graph = buildUnderstandGraph(scan.graph, controls, controlGaps, quickFixes, implementationTasks, surfaces);

  return {
    schemaVersion: "0.1",
    workspace: {
      root: "."
    },
    inventory: {
      workspaceRoot: ".",
      surfaces,
      toolServers,
      counts: {
        skills: scan.summary.componentsByType.skill,
        scripts: scan.summary.componentsByType.script,
        toolServers: toolServers.length,
        findings: scan.findings.length,
        riskChains: scan.riskChains.length
      }
    },
    capabilities,
    controls,
    controlGaps,
    riskChains: scan.riskChains,
    quickFixes,
    implementationTasks,
    graph,
    scan,
    summary: {
      capabilityCount: capabilities.length,
      controlGapCount: controlGaps.length,
      quickFixCount: quickFixes.length,
      implementationTaskCount: implementationTasks.length,
      criticalRiskChains: scan.riskChains.filter((chain) => chain.risk === "critical").length,
      highRiskChains: scan.riskChains.filter((chain) => chain.risk === "high").length
    }
  };
}

async function detectControls(root: string): Promise<Control[]> {
  const controls = new Map<ControlType, Control>();

  for (const relativeFile of policyFiles) {
    const absolute = path.join(root, relativeFile);
    const content = await readIfExists(absolute);
    if (content === undefined) continue;
    addDetectedControl(controls, "policy_file", relativeFile, "policy file");
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

  return [...controls.values()].sort((a, b) => a.id.localeCompare(b.id));
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

function buildToolServers(scan: ScanResult, controlGaps: ControlGap[], detectedControlTypes: ControlType[] = []): ToolServer[] {
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
      const chainIds = scan.riskChains.filter((chain) => chain.componentId === component.id).map((chain) => chain.id).sort();
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

function buildSurfaces(scan: ScanResult, toolServers: ToolServer[], controlGaps: ControlGap[], controls: Control[]): AgentSurface[] {
  const toolServerById = new Map(toolServers.map((server) => [server.id, server]));
  const detected = controls.filter((control) => control.status === "detected").map((control) => control.type);
  return scan.components
    .filter((component) => component.type === "skill" || component.type === "script" || component.type === "mcp_server")
    .map((component) => {
      const gaps = controlGaps.filter((gap) => gap.componentId === component.id).map((gap) => gap.id).sort();
      const chainIds = scan.riskChains.filter((chain) => chain.componentId === component.id).map((chain) => chain.id).sort();
      const type: AgentSurface["type"] = component.type === "mcp_server"
        ? "tool_server"
        : component.type === "skill"
          ? "skill"
          : "script";
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

function buildCapabilities(findings: Finding[]): NormalizedCapability[] {
  const byCapability = new Map<Capability, Finding[]>();
  for (const finding of findings) {
    byCapability.set(finding.capability, [...(byCapability.get(finding.capability) ?? []), finding]);
  }

  return [...byCapability.entries()]
    .map(([capability, groupedFindings]) => ({
      capability,
      state: "inferred" as const,
      count: groupedFindings.length,
      risk: highestRiskLevel(groupedFindings.map((finding) => finding.risk)),
      evidence: groupedFindings.map((finding) => finding.evidence).slice(0, 20)
    }))
    .sort((a, b) => a.capability.localeCompare(b.capability));
}

function buildControlGaps(scan: ScanResult, detectedControls: Control[]): ControlGap[] {
  const gaps: ControlGap[] = [];
  const seen = new Set<string>();
  const detected = new Set(detectedControls.map((control) => control.type));

  if (!detected.has("policy_file") && scan.findings.length > 0) {
    gaps.push({
      id: stableId("gap", "workspace.root-policy_file"),
      control: "policy_file",
      componentId: "workspace.root",
      risk: "medium",
      message: "No WhatTheAgent policy file was detected for this workspace.",
      evidence: [{ file: ".", pattern: "missing:wta.policy" }]
    });
  }

  if (!detected.has("ci_gate") && scan.riskChains.some((chain) => chain.risk === "critical" || chain.risk === "high")) {
    gaps.push({
      id: stableId("gap", "workspace.root-ci_gate"),
      control: "ci_gate",
      componentId: "workspace.root",
      risk: "medium",
      message: "No CI gate was detected for WhatTheAgent risk checks.",
      evidence: [{ file: ".", pattern: "missing:ci_gate" }]
    });
  }

  for (const finding of scan.findings) {
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
        evidence: [finding.evidence]
      });
    }
  }

  return gaps.sort((a, b) => a.id.localeCompare(b.id));
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
      controlGaps: [gap.id]
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
      return ["Review token permissions and reduce them to the minimum required scope.", "Prefer separate tokens per tool server or skill."];
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
    instructions: `Implement a reviewable control for ${fix.title}. Do not remove functionality silently. Prefer policy, allowlist, or explicit approval gates over deleting code.`,
    acceptanceCriteria: [
      "The risky capability remains documented in WhatTheAgent output.",
      "The missing control is represented by a policy, allowlist, approval gate, or scoped secret.",
      "The change is reviewable and does not execute untrusted code during validation."
    ],
    relatedQuickFixes: [fix.id]
  }));
}

function buildUnderstandGraph(
  baseGraph: CapabilityGraph,
  controls: Control[],
  controlGaps: ControlGap[],
  quickFixes: QuickFix[],
  implementationTasks: ImplementationTask[],
  surfaces: AgentSurface[]
): CapabilityGraph {
  const nodes: GraphNode[] = [...baseGraph.nodes];
  const edges: GraphEdge[] = [...baseGraph.edges];

  for (const control of controls) {
    nodes.push({ id: control.id, type: "Control", label: control.label, metadata: { status: control.status, control: control.type } });
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
