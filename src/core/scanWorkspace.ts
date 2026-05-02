import path from "node:path";
import type { AgentProfile, Capability, CompatibilityInfo, Component, ComponentType, Finding, RiskLevel, ScanOptions, ScanResult, ScanSummary } from "./types.js";
import { wellKnownClients } from "../clients/wellKnownClients.js";
import { buildGraph } from "../graph/graphBuilder.js";
import { detectRiskChains } from "../risk/chainDetector.js";
import { scanMcpConfigs } from "../scanner/mcpScanner.js";
import { scanPersonalAgentSurfaces } from "../scanner/personalAgentScanner.js";
import { scanSkills } from "../scanner/skillScanner.js";
import { scanScript } from "../scanner/scriptScanner.js";
import { findFiles } from "../utils/fileWalker.js";
import { scriptFilePattern } from "../utils/patterns.js";
import { relativePath, sortComponents, sortFindings, sortRiskChains } from "../utils/normalize.js";

const componentTypes: ComponentType[] = ["skill", "mcp_server", "script", "prompt", "rule", "memory", "config", "env_var", "api_endpoint", "capability"];
const capabilities: Capability[] = [
  "read_file",
  "write_file",
  "delete_file",
  "execute_code",
  "network_access",
  "external_send",
  "credential_access",
  "database_access",
  "payment",
  "order_placement",
  "agent_delegation",
  "approval_bypass"
];
const riskLevels: RiskLevel[] = ["low", "medium", "high", "critical"];

export async function scanWorkspace(workspacePath: string, options: ScanOptions = {}): Promise<ScanResult> {
  const root = path.resolve(workspacePath);
  const skillScan = await scanSkills(root);
  const mcpScan = await scanMcpConfigs(root, options.allowMcpExec);
  const personalScan = await scanPersonalAgentSurfaces(root, options.profile);
  const standaloneScripts = await scanStandaloneScripts(root, new Set(skillScan.scripts.map((script) => script.component.path ?? "")));

  const components = sortComponents([
    ...skillScan.skills,
    ...personalScan.components,
    ...skillScan.scripts.map((script) => script.component),
    ...standaloneScripts.map((script) => script.component),
    ...mcpScan.servers
  ]);
  const findings = sortFindings([
    ...skillScan.findings,
    ...personalScan.findings,
    ...skillScan.scripts.flatMap((script) => script.findings),
    ...standaloneScripts.flatMap((script) => script.findings),
    ...mcpScan.findings
  ]);
  const riskChains = sortRiskChains(detectRiskChains(components, findings));
  const graph = buildGraph(path.basename(root) || root, components, findings, riskChains);
  const compatibility = withProfileCompatibility(mcpScan.compatibility, options.profile, personalScan.components);

  return {
    schemaVersion: "0.1",
    workspace: {
      root: "."
    },
    components,
    findings,
    riskChains,
    graph,
    compatibility,
    summary: buildSummary(components, findings, riskChains)
  };
}

async function scanStandaloneScripts(root: string, knownScriptPaths: Set<string>) {
  const scriptPaths = await findFiles(root, scriptFilePattern);
  const standalone = scriptPaths.filter((scriptPath) => !knownScriptPaths.has(relativePath(root, scriptPath)));
  const results = [];
  for (const scriptPath of standalone) {
    results.push(await scanScript(root, scriptPath));
  }
  return results;
}

function buildSummary(components: Component[], findings: Finding[], riskChains: ScanResult["riskChains"]): ScanSummary {
  const componentsByType = Object.fromEntries(componentTypes.map((type) => [type, 0])) as Record<ComponentType, number>;
  for (const component of components) {
    componentsByType[component.type] += 1;
  }

  const capabilityCounts = Object.fromEntries(capabilities.map((capability) => [capability, 0])) as Record<Capability, number>;
  for (const finding of findings) {
    capabilityCounts[finding.capability] += 1;
  }

  const riskChainsByRisk = Object.fromEntries(riskLevels.map((risk) => [risk, 0])) as Record<RiskLevel, number>;
  for (const chain of riskChains) {
    riskChainsByRisk[chain.risk] += 1;
  }

  return {
    componentsByType,
    capabilities: capabilityCounts,
    riskChainsByRisk
  };
}

function withProfileCompatibility(
  compatibility: CompatibilityInfo,
  profile: AgentProfile | undefined,
  personalComponents: Component[]
): CompatibilityInfo {
  if ((profile !== "openclaw" && profile !== "hermes") || personalComponents.length === 0) {
    return compatibility;
  }

  const client = wellKnownClients.find((candidate) => candidate.id === profile);
  if (!client || compatibility.detectedClients.some((detected) => detected.id === client.id)) {
    return compatibility;
  }

  return {
    ...compatibility,
    detectedClients: [
      ...compatibility.detectedClients,
      {
        id: client.id,
        name: client.name,
        detectedFiles: personalComponents.map((component) => component.path).filter((file): file is string => Boolean(file)).sort(),
        mcpConfigFiles: [],
        skillsDirs: []
      }
    ].sort((a, b) => a.name.localeCompare(b.name))
  };
}
