import { describe, expect, it } from "vitest";
import { levelForRisk, renderSarifReport } from "../../src/output/sarifReport.js";
import type { ControlGap, RiskChain, UnderstandResult } from "../../src/core/types.js";

function baseResult(overrides: Partial<UnderstandResult> = {}): UnderstandResult {
  const empty: UnderstandResult = {
    schemaVersion: "0.1",
    workspace: { root: "/repo/example" },
    inventory: {
      workspaceRoot: "/repo/example",
      surfaces: [],
      toolServers: [],
      counts: { skills: 0, scripts: 0, toolServers: 0, findings: 0, riskChains: 0 }
    },
    capabilities: [],
    observations: [],
    expected: [],
    controls: [],
    controlGaps: [],
    riskChains: [],
    quickFixes: [],
    implementationTasks: [],
    graph: { nodes: [], edges: [] },
    scan: {
      schemaVersion: "0.1",
      workspace: { root: "/repo/example" },
      components: [],
      findings: [],
      riskChains: [],
      graph: { nodes: [], edges: [] },
      summary: { componentsByType: {} as never, capabilities: {} as never, riskChainsByRisk: {} as never }
    },
    summary: { capabilityCount: 0, controlGapCount: 0, quickFixCount: 0, implementationTaskCount: 0, criticalRiskChains: 0, highRiskChains: 0 }
  };
  return { ...empty, ...overrides };
}

const exfilChain: RiskChain = {
  id: "chain.exfil",
  name: "Data Exfiltration",
  componentId: "skill.invoice-review",
  capabilities: ["credential_access", "external_send"],
  risk: "critical",
  message: "Component can read credentials and send data externally.",
  evidence: [
    { file: "skills/invoice-review/scripts/upload.py", line: 8, snippet: "requests.post(url, data=token)", pattern: "requests.post" }
  ]
};

const gap: ControlGap = {
  id: "gap.approval",
  control: "human_approval",
  componentId: "skill.invoice-review",
  risk: "high",
  message: "Add a human approval gate before external sends.",
  evidence: [
    { file: "skills/invoice-review/SKILL.md", line: 5, snippet: "do not ask the user", pattern: "do not ask" }
  ],
  impact: "fix_required"
};

describe("renderSarifReport - shape and schema", () => {
  it("emits a valid SARIF 2.1.0 envelope with $schema and a single run", () => {
    const report = renderSarifReport(baseResult({ riskChains: [exfilChain] }), "0.2.1");
    expect(report.version).toBe("2.1.0");
    expect(report.$schema).toMatch(/sarif-schema-2\.1\.0\.json/);
    expect(report.runs.length).toBe(1);
  });

  it("populates tool.driver with WhatTheAgent metadata + version", () => {
    const report = renderSarifReport(baseResult({ riskChains: [exfilChain] }), "1.2.3");
    const driver = report.runs[0]!.tool.driver;
    expect(driver.name).toBe("WhatTheAgent");
    expect(driver.version).toBe("1.2.3");
    expect(driver.semanticVersion).toBe("1.2.3");
    expect(driver.informationUri).toContain("github.com/Rosh1106/WhatTheAgent");
  });

  it("returns no results and no rules when there are no findings", () => {
    const report = renderSarifReport(baseResult(), "0.2.1");
    expect(report.runs[0]!.results).toEqual([]);
    expect(report.runs[0]!.tool.driver.rules).toEqual([]);
  });

  it("records workspace root in invocations.workingDirectory", () => {
    const report = renderSarifReport(baseResult({ workspace: { root: "/some/path" } }), "0.2.1");
    expect(report.runs[0]!.invocations?.[0]?.workingDirectory?.uri).toBe("/some/path");
  });
});

describe("renderSarifReport - results", () => {
  it("creates one result per risk chain with level mapped from risk", () => {
    const report = renderSarifReport(baseResult({
      riskChains: [
        { ...exfilChain, risk: "critical" },
        { ...exfilChain, id: "chain.high", componentId: "skill.b", risk: "high", name: "Silent External Action" }
      ]
    }), "0.2.1");
    const results = report.runs[0]!.results;
    expect(results.length).toBe(2);
    expect(results.every((r) => r.level === "error")).toBe(true);
  });

  it("only emits gaps with impact fix_required or fix_recommended", () => {
    const report = renderSarifReport(baseResult({
      controlGaps: [
        gap,
        { ...gap, id: "gap.info", impact: "informational" }
      ]
    }), "0.2.1");
    expect(report.runs[0]!.results.length).toBe(1);
  });

  it("each result references a rule that is also present in tool.driver.rules", () => {
    const report = renderSarifReport(baseResult({ riskChains: [exfilChain], controlGaps: [gap] }), "0.2.1");
    const ruleIds = new Set(report.runs[0]!.tool.driver.rules.map((rule) => rule.id));
    for (const result of report.runs[0]!.results) {
      expect(ruleIds.has(result.ruleId)).toBe(true);
    }
  });

  it("includes a stable partialFingerprint so re-runs deduplicate", () => {
    const report = renderSarifReport(baseResult({ riskChains: [exfilChain] }), "0.2.1");
    expect(report.runs[0]!.results[0]?.partialFingerprints?.id).toBe("chain.exfil");
  });

  it("attaches physical locations with startLine and snippet", () => {
    const report = renderSarifReport(baseResult({ riskChains: [exfilChain] }), "0.2.1");
    const location = report.runs[0]!.results[0]?.locations[0]?.physicalLocation;
    expect(location?.artifactLocation.uri).toBe("skills/invoice-review/scripts/upload.py");
    expect(location?.region?.startLine).toBe(8);
    expect(location?.region?.snippet?.text).toContain("requests.post");
  });

  it("falls back to a workspace-root location when evidence is missing", () => {
    const report = renderSarifReport(baseResult({ riskChains: [{ ...exfilChain, evidence: [] }] }), "0.2.1");
    const location = report.runs[0]!.results[0]?.locations[0]?.physicalLocation;
    expect(location?.artifactLocation.uri).toBe(".");
  });

  it("dedupes rule definitions when many chains share the same rule type", () => {
    const report = renderSarifReport(baseResult({
      riskChains: [
        { ...exfilChain, id: "chain.a", componentId: "skill.a" },
        { ...exfilChain, id: "chain.b", componentId: "skill.b" },
        { ...exfilChain, id: "chain.c", componentId: "skill.c" }
      ]
    }), "0.2.1");
    const rules = report.runs[0]!.tool.driver.rules;
    expect(rules.length).toBe(1);
    expect(report.runs[0]!.results.length).toBe(3);
  });
});

describe("renderSarifReport - level mapping", () => {
  it("maps risk levels to SARIF levels correctly", () => {
    expect(levelForRisk("critical")).toBe("error");
    expect(levelForRisk("high")).toBe("error");
    expect(levelForRisk("medium")).toBe("warning");
    expect(levelForRisk("low")).toBe("note");
  });
});

describe("renderSarifReport - determinism and stability", () => {
  it("produces identical output for identical input", () => {
    const a = renderSarifReport(baseResult({ riskChains: [exfilChain], controlGaps: [gap] }), "0.2.1");
    const b = renderSarifReport(baseResult({ riskChains: [exfilChain], controlGaps: [gap] }), "0.2.1");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("sorts rules by id and results stably so diffs are clean", () => {
    const report = renderSarifReport(baseResult({
      riskChains: [
        { ...exfilChain, id: "chain.z", componentId: "skill.z", name: "Remote Execution", capabilities: ["execute_code", "network_access"] },
        { ...exfilChain, id: "chain.a", componentId: "skill.a", name: "Data Exfiltration" }
      ]
    }), "0.2.1");
    const ruleIds = report.runs[0]!.tool.driver.rules.map((rule) => rule.id);
    expect([...ruleIds].sort()).toEqual(ruleIds);
  });
});
