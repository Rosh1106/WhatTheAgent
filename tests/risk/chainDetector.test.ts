import { describe, expect, it } from "vitest";
import { detectRiskChains } from "../../src/risk/chainDetector.js";
import type { Capability, Component, Finding } from "../../src/core/types.js";

describe("detectRiskChains", () => {
  it("detects data exfiltration when credential_access and external_send coexist", () => {
    const { components, findings } = scenario("skill.invoice", ["credential_access", "external_send"]);
    const chains = detectRiskChains(components, findings);
    expect(chains.map((chain) => chain.name)).toContain("Data Exfiltration");
    const chain = chains.find((entry) => entry.name === "Data Exfiltration")!;
    expect(chain.risk).toBe("critical");
    expect(chain.capabilities).toEqual(["credential_access", "external_send"]);
  });

  it("detects remote execution when execute_code and network_access coexist", () => {
    const { components, findings } = scenario("skill.deploy", ["execute_code", "network_access"]);
    const chains = detectRiskChains(components, findings);
    expect(chains.map((chain) => chain.name)).toContain("Remote Execution");
  });

  it("detects silent external action when approval_bypass and external_send coexist", () => {
    const { components, findings } = scenario("skill.silent", ["approval_bypass", "external_send"]);
    const chains = detectRiskChains(components, findings);
    const chain = chains.find((entry) => entry.name === "Silent External Action");
    expect(chain).toBeDefined();
    expect(chain?.risk).toBe("high");
  });

  it("detects financial action when payment is present alone", () => {
    const { components, findings } = scenario("skill.checkout", ["payment"]);
    const chains = detectRiskChains(components, findings);
    const chain = chains.find((entry) => entry.name === "Financial Action");
    expect(chain).toBeDefined();
    expect(chain?.capabilities).toEqual(["payment"]);
  });

  it("flags both payment and order_placement together in one financial chain", () => {
    const { components, findings } = scenario("skill.checkout", ["payment", "order_placement"]);
    const chains = detectRiskChains(components, findings);
    const chain = chains.find((entry) => entry.name === "Financial Action");
    expect(chain?.capabilities.sort()).toEqual(["order_placement", "payment"]);
  });

  it("returns no chains when capabilities do not combine into a known pattern", () => {
    const { components, findings } = scenario("skill.docs", ["read_file", "write_file"]);
    expect(detectRiskChains(components, findings)).toEqual([]);
  });

  it("rolls child script capabilities into the parent skill's chain analysis", () => {
    const components: Component[] = [
      { id: "skill.parent", type: "skill", label: "parent" },
      { id: "script.child", type: "script", label: "child", parentId: "skill.parent" }
    ];
    const findings: Finding[] = [
      makeFinding("skill.parent", "credential_access"),
      makeFinding("script.child", "external_send")
    ];
    const chains = detectRiskChains(components, findings);
    expect(chains.find((chain) => chain.name === "Data Exfiltration")?.componentId).toBe("skill.parent");
  });
});

function scenario(componentId: string, caps: Capability[]) {
  const components: Component[] = [{ id: componentId, type: "skill", label: componentId }];
  const findings: Finding[] = caps.map((cap) => makeFinding(componentId, cap));
  return { components, findings };
}

function makeFinding(componentId: string, capability: Capability): Finding {
  return {
    id: `${componentId}-${capability}`,
    componentId,
    capability,
    risk: "low",
    evidence: { file: `${componentId}.md`, pattern: capability, line: 1, snippet: capability }
  };
}
