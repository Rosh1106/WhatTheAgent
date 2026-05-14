import { describe, expect, it } from "vitest";
import { evaluateFailOn, parseFailOnThreshold } from "../../src/core/failOn.js";
import type { ControlGap, RiskChain, UnderstandResult } from "../../src/core/types.js";

function baseResult(overrides: Partial<UnderstandResult> = {}): UnderstandResult {
  const empty: UnderstandResult = {
    schemaVersion: "0.1",
    workspace: { root: "." },
    inventory: { workspaceRoot: ".", surfaces: [], toolServers: [], counts: { skills: 0, scripts: 0, toolServers: 0, findings: 0, riskChains: 0 } },
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
      summary: { componentsByType: {} as never, capabilities: {} as never, riskChainsByRisk: {} as never }
    },
    summary: { capabilityCount: 0, controlGapCount: 0, quickFixCount: 0, implementationTaskCount: 0, criticalRiskChains: 0, highRiskChains: 0 }
  };
  return { ...empty, ...overrides };
}

function chain(risk: RiskChain["risk"], id = "c1"): RiskChain {
  return { id, name: "Data Exfiltration", componentId: "skill.x", capabilities: ["credential_access", "external_send"], risk, message: "x", evidence: [] };
}

function gap(risk: ControlGap["risk"], impact: ControlGap["impact"], id = "g1"): ControlGap {
  return { id, control: "human_approval", componentId: "skill.x", risk, message: "x", evidence: [], impact };
}

describe("parseFailOnThreshold", () => {
  it("defaults to none when no value is provided", () => {
    expect(parseFailOnThreshold(undefined)).toBe("none");
    expect(parseFailOnThreshold("")).toBe("none");
  });

  it("accepts the five canonical thresholds case-insensitively", () => {
    expect(parseFailOnThreshold("none")).toBe("none");
    expect(parseFailOnThreshold("LOW")).toBe("low");
    expect(parseFailOnThreshold("Medium")).toBe("medium");
    expect(parseFailOnThreshold("high")).toBe("high");
    expect(parseFailOnThreshold("CRITICAL")).toBe("critical");
  });

  it("accepts SARIF-style aliases (note/warning/error)", () => {
    expect(parseFailOnThreshold("note")).toBe("low");
    expect(parseFailOnThreshold("warning")).toBe("medium");
    expect(parseFailOnThreshold("warn")).toBe("medium");
    expect(parseFailOnThreshold("error")).toBe("high");
  });

  it("accepts off / never as aliases for none", () => {
    expect(parseFailOnThreshold("off")).toBe("none");
    expect(parseFailOnThreshold("never")).toBe("none");
  });

  it("throws on invalid values with a helpful message", () => {
    expect(() => parseFailOnThreshold("blocker")).toThrow(/Invalid --fail-on value/);
    expect(() => parseFailOnThreshold("9001")).toThrow(/Invalid --fail-on value/);
  });
});

describe("evaluateFailOn", () => {
  it("never fails when threshold is none", () => {
    const decision = evaluateFailOn(baseResult({ riskChains: [chain("critical")] }), "none");
    expect(decision.shouldFail).toBe(false);
  });

  it("passes when there are no findings at or above the threshold", () => {
    const decision = evaluateFailOn(baseResult({ riskChains: [chain("medium")] }), "critical");
    expect(decision.shouldFail).toBe(false);
    expect(decision.message).toMatch(/CI gate passes/);
  });

  it("fails on a critical chain when threshold is critical", () => {
    const decision = evaluateFailOn(baseResult({ riskChains: [chain("critical")] }), "critical");
    expect(decision.shouldFail).toBe(true);
    expect(decision.chainCount).toBe(1);
    expect(decision.message).toMatch(/1 risk chain/);
  });

  it("fails on a high chain when threshold is high", () => {
    const decision = evaluateFailOn(baseResult({ riskChains: [chain("high")] }), "high");
    expect(decision.shouldFail).toBe(true);
  });

  it("treats threshold as inclusive (high threshold catches critical)", () => {
    const decision = evaluateFailOn(baseResult({ riskChains: [chain("critical")] }), "high");
    expect(decision.shouldFail).toBe(true);
  });

  it("ignores informational control gaps even at low threshold", () => {
    const decision = evaluateFailOn(baseResult({ controlGaps: [gap("high", "informational")] }), "low");
    expect(decision.shouldFail).toBe(false);
  });

  it("counts fix_required and fix_recommended gaps separately from chains", () => {
    const decision = evaluateFailOn(baseResult({
      riskChains: [chain("medium")],
      controlGaps: [gap("high", "fix_required")]
    }), "medium");
    expect(decision.shouldFail).toBe(true);
    expect(decision.chainCount).toBe(1);
    expect(decision.gapCount).toBe(1);
    expect(decision.message).toMatch(/1 risk chain.*1 control gap/);
  });

  it("medium threshold passes on a low-risk chain", () => {
    const decision = evaluateFailOn(baseResult({ riskChains: [chain("low")] }), "medium");
    expect(decision.shouldFail).toBe(false);
  });
});
