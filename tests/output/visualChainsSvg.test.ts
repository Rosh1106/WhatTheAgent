import { describe, expect, it } from "vitest";
import { renderVisualChainsSvg } from "../../src/output/visualChainsSvg.js";
import type { ControlGap, RiskChain, UnderstandResult } from "../../src/core/types.js";

function baseResult(overrides: Partial<UnderstandResult> = {}): UnderstandResult {
  const empty: UnderstandResult = {
    schemaVersion: "0.1",
    workspace: { root: "." },
    inventory: {
      workspaceRoot: ".",
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
      workspace: { root: "." },
      components: [],
      findings: [],
      riskChains: [],
      graph: { nodes: [], edges: [] },
      summary: {
        componentsByType: {} as never,
        capabilities: {} as never,
        riskChainsByRisk: {} as never
      }
    },
    summary: {
      capabilityCount: 0,
      controlGapCount: 0,
      quickFixCount: 0,
      implementationTaskCount: 0,
      criticalRiskChains: 0,
      highRiskChains: 0
    }
  };
  return { ...empty, ...overrides };
}

describe("renderVisualChainsSvg", () => {
  it("emits a valid-looking SVG document", () => {
    const svg = renderVisualChainsSvg(baseResult());
    expect(svg.startsWith("<?xml")).toBe(true);
    expect(svg).toContain("<svg");
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
  });

  it("shows the empty state when no risk chains or gaps are present", () => {
    const svg = renderVisualChainsSvg(baseResult());
    expect(svg).toContain("NO ACTIVE RISK CHAINS");
    expect(svg).toContain("NO CONTROL GAPS");
  });

  it("renders risk chain card with chain name and capabilities", () => {
    const chain: RiskChain = {
      id: "chain.test",
      name: "Data Exfiltration",
      componentId: "skill.x",
      capabilities: ["credential_access", "external_send"],
      risk: "critical",
      message: "msg",
      evidence: []
    };
    const svg = renderVisualChainsSvg(baseResult({ riskChains: [chain] }));
    expect(svg).toContain("Data Exfiltration");
    expect(svg).toContain("credential_access + external_send");
  });

  it("renders control gap card with humanized control name", () => {
    const gap: ControlGap = {
      id: "gap.1",
      control: "human_approval",
      componentId: "skill.x",
      risk: "high",
      message: "Add approval gate",
      evidence: []
    };
    const svg = renderVisualChainsSvg(baseResult({ controlGaps: [gap] }));
    expect(svg).toContain("HUMAN APPROVAL");
    expect(svg).toContain("Add approval gate");
  });

  it("escapes XML-special characters in user-supplied text", () => {
    const chain: RiskChain = {
      id: "chain.unsafe",
      name: "<script>alert(1)</script>",
      componentId: "skill.x",
      capabilities: ["external_send"],
      risk: "high",
      message: "m",
      evidence: []
    };
    const svg = renderVisualChainsSvg(baseResult({ riskChains: [chain] }));
    expect(svg).not.toContain("<script>alert(1)</script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("limits to top 5 risk chains and top 5 control gaps", () => {
    const chains: RiskChain[] = Array.from({ length: 8 }, (_, i) => ({
      id: `chain.${i}`,
      name: `Chain ${i}`,
      componentId: "skill.x",
      capabilities: ["external_send"],
      risk: "high",
      message: "m",
      evidence: []
    }));
    const svg = renderVisualChainsSvg(baseResult({ riskChains: chains }));
    expect(svg).toContain("Chain 0");
    expect(svg).toContain("Chain 4");
    expect(svg).not.toContain("Chain 5");
  });
});
