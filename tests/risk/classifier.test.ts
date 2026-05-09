import { describe, expect, it } from "vitest";
import { classifyCapability, componentCapabilities, highestRiskLevel } from "../../src/risk/classifier.js";
import type { Finding } from "../../src/core/types.js";

describe("classifyCapability", () => {
  it("classifies payment as critical", () => {
    expect(classifyCapability("payment")).toBe("critical");
  });

  it("classifies order_placement as critical", () => {
    expect(classifyCapability("order_placement")).toBe("critical");
  });

  it("classifies external_send as high", () => {
    expect(classifyCapability("external_send")).toBe("high");
  });

  it("classifies execute_code as high", () => {
    expect(classifyCapability("execute_code")).toBe("high");
  });

  it("classifies approval_bypass as high", () => {
    expect(classifyCapability("approval_bypass")).toBe("high");
  });

  it("classifies write_file as medium", () => {
    expect(classifyCapability("write_file")).toBe("medium");
  });

  it("classifies credential_access as medium", () => {
    expect(classifyCapability("credential_access")).toBe("medium");
  });

  it("classifies read_file as low", () => {
    expect(classifyCapability("read_file")).toBe("low");
  });

  it("classifies network_access as low", () => {
    expect(classifyCapability("network_access")).toBe("low");
  });
});

describe("highestRiskLevel", () => {
  it("returns critical when present", () => {
    expect(highestRiskLevel(["low", "high", "critical", "medium"])).toBe("critical");
  });

  it("returns high when no critical", () => {
    expect(highestRiskLevel(["low", "high", "medium"])).toBe("high");
  });

  it("falls back to low for empty input", () => {
    expect(highestRiskLevel([])).toBe("low");
  });
});

describe("componentCapabilities", () => {
  it("returns the unique capabilities for a single component", () => {
    const findings: Finding[] = [
      makeFinding("c1", "read_file"),
      makeFinding("c1", "write_file"),
      makeFinding("c1", "read_file"),
      makeFinding("c2", "execute_code")
    ];
    const caps = componentCapabilities(findings, "c1");
    expect(caps).toEqual(new Set(["read_file", "write_file"]));
  });
});

function makeFinding(componentId: string, capability: Finding["capability"]): Finding {
  return {
    id: `${componentId}-${capability}`,
    componentId,
    capability,
    risk: "low",
    evidence: { file: "x", pattern: capability }
  };
}
