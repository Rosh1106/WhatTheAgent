// SARIF 2.1.0 emitter for WhatTheAgent.
//
// SARIF (Static Analysis Results Interchange Format) is the OASIS standard
// for SAST output. GitHub Code Scanning, GitLab SAST, Snyk Code, and most
// commercial aggregators ingest it natively. Emitting SARIF is what makes
// WhatTheAgent slot into any enterprise CI without a wrapper.
//
// Mapping:
//   risk chains       -> SARIF results, level mapped from chain.risk
//   meaningful gaps   -> SARIF results, level mapped from gap.risk
//                        (only fix_required / fix_recommended; inventory is omitted)
//   risk -> level     -> critical|high -> "error"
//                        medium         -> "warning"
//                        low            -> "note"
//
// We declare one rule per known chain type plus a single generic rule for
// control gaps. Results reference rules by id. Output is deterministic
// (same input -> identical bytes) and includes $schema + version so
// validators accept it.

import type { ControlGap, RiskChain, RiskLevel, UnderstandResult } from "../core/types.js";

export interface SarifReport {
  $schema: string;
  version: "2.1.0";
  runs: SarifRun[];
}

export interface SarifRun {
  tool: { driver: SarifDriver };
  results: SarifResult[];
  invocations?: SarifInvocation[];
}

export interface SarifDriver {
  name: string;
  version: string;
  informationUri: string;
  semanticVersion?: string;
  rules: SarifRule[];
}

export interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription?: { text: string };
  helpUri: string;
  defaultConfiguration: { level: SarifLevel };
  properties?: { tags?: string[]; "security-severity"?: string };
}

export type SarifLevel = "none" | "note" | "warning" | "error";

export interface SarifResult {
  ruleId: string;
  level: SarifLevel;
  message: { text: string };
  locations: SarifLocation[];
  partialFingerprints?: Record<string, string>;
  properties?: Record<string, unknown>;
}

export interface SarifLocation {
  physicalLocation: {
    artifactLocation: { uri: string; uriBaseId?: string };
    region?: { startLine: number; startColumn?: number; snippet?: { text: string } };
  };
}

export interface SarifInvocation {
  executionSuccessful: boolean;
  workingDirectory?: { uri: string };
}

const SCHEMA_URL = "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json";
const TOOL_NAME = "WhatTheAgent";
const TOOL_URI = "https://github.com/Rosh1106/WhatTheAgent";

// Rules — declared up front so SARIF consumers can render them in their rule
// catalogues even before any matching result appears in a run.
const CHAIN_RULES: Record<string, Omit<SarifRule, "id">> = {
  "Data Exfiltration": {
    name: "DataExfiltration",
    shortDescription: { text: "Component can read credentials and send data externally" },
    fullDescription: { text: "A component has both credential_access and external_send capabilities. Regardless of intent, this is the shape of credential exfiltration: secrets can be read AND sent outside the workspace." },
    helpUri: `${TOOL_URI}#risk-chains`,
    defaultConfiguration: { level: "error" },
    properties: { tags: ["security", "agent-security", "data-exfiltration"], "security-severity": "9.0" }
  },
  "Remote Execution": {
    name: "RemoteExecution",
    shortDescription: { text: "Component can execute code and access network resources" },
    fullDescription: { text: "A component has both execute_code and network_access capabilities. An LLM driving it has remote-execution-capable behaviour one prompt away." },
    helpUri: `${TOOL_URI}#risk-chains`,
    defaultConfiguration: { level: "error" },
    properties: { tags: ["security", "agent-security", "remote-execution"], "security-severity": "9.0" }
  },
  "Silent External Action": {
    name: "SilentExternalAction",
    shortDescription: { text: "Component can send data externally while instructions discourage approval" },
    fullDescription: { text: "A component has both approval_bypass and external_send capabilities, meaning an agent can take external action without asking the user." },
    helpUri: `${TOOL_URI}#risk-chains`,
    defaultConfiguration: { level: "error" },
    properties: { tags: ["security", "agent-security", "approval-bypass"], "security-severity": "8.5" }
  },
  "Financial Action": {
    name: "FinancialAction",
    shortDescription: { text: "Component appears capable of financial or commerce actions" },
    fullDescription: { text: "A component references payment or order-placement capabilities. Commerce actions should be gated by explicit human approval and dry-run controls." },
    helpUri: `${TOOL_URI}#risk-chains`,
    defaultConfiguration: { level: "error" },
    properties: { tags: ["security", "agent-security", "payment"], "security-severity": "9.0" }
  }
};

const CONTROL_GAP_RULE: Omit<SarifRule, "id"> = {
  name: "MissingControl",
  shortDescription: { text: "A recommended control is missing for an agent component" },
  fullDescription: { text: "WhatTheAgent expected a guardrail (e.g. human_approval, command_allowlist, secret_scoping) to be declared for this component but did not find it. Either add the control, or acknowledge the capability as expected in wta.policy.yaml." },
  helpUri: `${TOOL_URI}#approval-workflow`,
  defaultConfiguration: { level: "warning" },
  properties: { tags: ["security", "agent-security", "control-gap"], "security-severity": "5.5" }
};

export function renderSarifReport(result: UnderstandResult, toolVersion: string): SarifReport {
  const ruleIds = new Map<string, string>();
  const rules: SarifRule[] = [];

  for (const chain of result.riskChains) {
    if (ruleIds.has(chain.name)) continue;
    const spec = CHAIN_RULES[chain.name];
    if (!spec) continue;
    const id = ruleIdFromName(spec.name);
    ruleIds.set(chain.name, id);
    rules.push({ id, ...spec });
  }

  const meaningfulGaps = result.controlGaps.filter((gap) => gap.impact === "fix_required" || gap.impact === "fix_recommended");
  if (meaningfulGaps.length > 0) {
    const id = ruleIdFromName(CONTROL_GAP_RULE.name);
    ruleIds.set("__control_gap__", id);
    rules.push({ id, ...CONTROL_GAP_RULE });
  }

  rules.sort((a, b) => a.id.localeCompare(b.id));

  const results: SarifResult[] = [];

  for (const chain of result.riskChains) {
    const ruleId = ruleIds.get(chain.name) ?? ruleIdFromName(CHAIN_RULES[chain.name]?.name ?? "Unknown");
    results.push(buildChainResult(chain, ruleId));
  }

  for (const gap of meaningfulGaps) {
    const ruleId = ruleIds.get("__control_gap__") ?? ruleIdFromName(CONTROL_GAP_RULE.name);
    results.push(buildGapResult(gap, ruleId));
  }

  results.sort((a, b) => a.ruleId.localeCompare(b.ruleId) || resultSortKey(a).localeCompare(resultSortKey(b)));

  const run: SarifRun = {
    tool: {
      driver: {
        name: TOOL_NAME,
        version: toolVersion,
        semanticVersion: toolVersion,
        informationUri: TOOL_URI,
        rules
      }
    },
    results,
    invocations: [{
      executionSuccessful: true,
      workingDirectory: { uri: posixUri(result.workspace.root) }
    }]
  };

  return {
    $schema: SCHEMA_URL,
    version: "2.1.0",
    runs: [run]
  };
}

function buildChainResult(chain: RiskChain, ruleId: string): SarifResult {
  const locations = chain.evidence.slice(0, 10).map((evidence): SarifLocation => ({
    physicalLocation: {
      artifactLocation: { uri: posixUri(evidence.file) },
      region: regionFromEvidence(evidence)
    }
  }));
  if (locations.length === 0) {
    locations.push({ physicalLocation: { artifactLocation: { uri: "." } } });
  }

  return {
    ruleId,
    level: levelForRisk(chain.risk),
    message: { text: `${chain.name}: ${chain.message} (capabilities: ${chain.capabilities.join(" + ")}; component: ${chain.componentId})` },
    locations,
    partialFingerprints: { id: chain.id, componentId: chain.componentId },
    properties: {
      risk: chain.risk,
      capabilities: chain.capabilities,
      componentId: chain.componentId,
      chainName: chain.name
    }
  };
}

function buildGapResult(gap: ControlGap, ruleId: string): SarifResult {
  const locations = gap.evidence.slice(0, 10).map((evidence): SarifLocation => ({
    physicalLocation: {
      artifactLocation: { uri: posixUri(evidence.file) },
      region: regionFromEvidence(evidence)
    }
  }));
  if (locations.length === 0) {
    locations.push({ physicalLocation: { artifactLocation: { uri: "." } } });
  }

  return {
    ruleId,
    level: levelForRisk(gap.risk),
    message: { text: `Missing control: ${humanizeControl(gap.control)}. ${gap.message} (component: ${gap.componentId})` },
    locations,
    partialFingerprints: { id: gap.id, componentId: gap.componentId, control: gap.control },
    properties: {
      risk: gap.risk,
      control: gap.control,
      componentId: gap.componentId,
      impact: gap.impact
    }
  };
}

function regionFromEvidence(evidence: { line?: number; snippet?: string }): { startLine: number; snippet?: { text: string } } | undefined {
  if (typeof evidence.line !== "number" || evidence.line <= 0) return undefined;
  const region: { startLine: number; snippet?: { text: string } } = { startLine: evidence.line };
  if (evidence.snippet) region.snippet = { text: evidence.snippet };
  return region;
}

function resultSortKey(result: SarifResult): string {
  const loc = result.locations[0]?.physicalLocation;
  const file = loc?.artifactLocation.uri ?? "";
  const line = loc?.region?.startLine ?? 0;
  return `${file}:${String(line).padStart(8, "0")}:${result.message.text}`;
}

export function levelForRisk(risk: RiskLevel): SarifLevel {
  switch (risk) {
    case "critical":
    case "high":
      return "error";
    case "medium":
      return "warning";
    case "low":
      return "note";
  }
}

function ruleIdFromName(name: string): string {
  return `WTA.${name}`;
}

function humanizeControl(control: string): string {
  return control.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function posixUri(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}
