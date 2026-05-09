import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scanWorkspace } from "../../src/core/scanWorkspace.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const fixtures = path.join(repoRoot, "examples");

describe("scanWorkspace on example fixtures", () => {
  it("detects credential_access + external_send chain in risky-agent", async () => {
    const result = await scanWorkspace(path.join(fixtures, "risky-agent"));
    const chainNames = result.riskChains.map((chain) => chain.name);
    expect(chainNames).toContain("Data Exfiltration");
    const exfil = result.riskChains.find((chain) => chain.name === "Data Exfiltration")!;
    expect(exfil.risk).toBe("critical");
    expect(exfil.capabilities.sort()).toEqual(["credential_access", "external_send"]);
  });

  it("detects financial action chain in critical-payment-agent", async () => {
    const result = await scanWorkspace(path.join(fixtures, "critical-payment-agent"));
    const chain = result.riskChains.find((entry) => entry.name === "Financial Action");
    expect(chain).toBeDefined();
    expect(chain?.risk).toBe("critical");
  });

  it("produces no critical chains on benign-agent", async () => {
    const result = await scanWorkspace(path.join(fixtures, "benign-agent"));
    const critical = result.riskChains.filter((chain) => chain.risk === "critical");
    expect(critical).toEqual([]);
  });

  it("redacts environment values from MCP server metadata in risky-agent", async () => {
    const result = await scanWorkspace(path.join(fixtures, "risky-agent"));
    const mcp = result.components.find((component) => component.type === "mcp_server");
    expect(mcp).toBeDefined();
    const env = (mcp?.metadata as { env: Record<string, string> }).env;
    expect(Object.values(env).every((value) => value === "[redacted]")).toBe(true);
  });

  it("emits a scan summary that counts risk chains by severity", async () => {
    const result = await scanWorkspace(path.join(fixtures, "risky-agent"));
    const total =
      result.summary.riskChainsByRisk.low +
      result.summary.riskChainsByRisk.medium +
      result.summary.riskChainsByRisk.high +
      result.summary.riskChainsByRisk.critical;
    expect(total).toBe(result.riskChains.length);
  });

  it("produces deterministic findings ordering across two runs", async () => {
    const a = await scanWorkspace(path.join(fixtures, "risky-agent"));
    const b = await scanWorkspace(path.join(fixtures, "risky-agent"));
    expect(a.findings.map((f) => f.id)).toEqual(b.findings.map((f) => f.id));
    expect(a.riskChains.map((c) => c.id)).toEqual(b.riskChains.map((c) => c.id));
  });

  it("annotates findings with category and impact via lifecycle", async () => {
    const result = await scanWorkspace(path.join(fixtures, "critical-payment-agent"));
    const paymentFinding = result.findings.find((f) => f.capability === "payment");
    expect(paymentFinding).toBeDefined();
    expect(paymentFinding?.category).toBe("needs_attention");
    expect(paymentFinding?.impact).toBe("fix_required");
  });
});
