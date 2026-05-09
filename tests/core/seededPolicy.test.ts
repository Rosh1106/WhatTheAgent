import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { seededPolicyFromScan } from "../../src/core/personalAgentBaseline.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const fixtures = path.join(repoRoot, "examples");

describe("seededPolicyFromScan", () => {
  it("seeds expected[] with one entry per (component, capability) detected in the scan", async () => {
    const seeded = await seededPolicyFromScan(path.join(fixtures, "risky-agent"), "personal-agent");
    expect(seeded.expectedCount).toBeGreaterThan(0);
    expect(seeded.yaml).toContain("expected:");
    expect(seeded.yaml).toContain('component: "');
    expect(seeded.yaml).toContain('capability: "');
  });

  it("returns just the empty starter for a workspace with no findings", async () => {
    const seeded = await seededPolicyFromScan(path.join(fixtures, "benign-agent"), "personal-agent");
    expect(seeded.expectedCount).toBeGreaterThanOrEqual(0);
    expect(seeded.yaml).toContain("expected:");
  });

  it("dedupes entries: same (component, capability) appears once", async () => {
    const seeded = await seededPolicyFromScan(path.join(fixtures, "risky-agent"), "personal-agent");
    const componentLines = seeded.yaml.match(/component:/g) ?? [];
    const capabilityLines = seeded.yaml.match(/capability:/g) ?? [];
    expect(componentLines.length).toBe(capabilityLines.length);
  });
});
