import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ackInPolicy, insertExpectedEntries } from "../../src/core/ackPolicy.js";
import type { ScanResult } from "../../src/core/types.js";

let workdir: string;
let policyFile: string;

beforeEach(async () => {
  workdir = await fs.mkdtemp(path.join(os.tmpdir(), "wta-ack-"));
  policyFile = path.join(workdir, "wta.policy.yaml");
});

afterEach(async () => {
  await fs.rm(workdir, { recursive: true, force: true });
});

function fakeScan(): ScanResult {
  return {
    schemaVersion: "0.1",
    workspace: { root: "." },
    components: [
      { id: "mcp.burp", type: "mcp_server", label: "burp" }
    ],
    findings: [
      { id: "f1", componentId: "mcp.burp", capability: "execute_code", risk: "high", evidence: { file: "config", pattern: "command" } },
      { id: "f2", componentId: "mcp.burp", capability: "network_access", risk: "low", evidence: { file: "config", pattern: "url" } }
    ],
    riskChains: [],
    graph: { nodes: [], edges: [] },
    summary: { componentsByType: {} as never, capabilities: {} as never, riskChainsByRisk: {} as never }
  };
}

describe("ackInPolicy", () => {
  it("creates a new policy file when none exists and adds the entry", async () => {
    const result = await ackInPolicy({
      workspaceRoot: workdir,
      policyFile,
      componentId: "mcp.burp",
      capability: "execute_code",
      reason: "Burp Suite, intentional.",
      scan: fakeScan()
    });
    expect(result.added.length).toBe(1);
    expect(result.added[0]?.capability).toBe("execute_code");
    const content = await fs.readFile(policyFile, "utf8");
    expect(content).toContain('component: "mcp.burp"');
    expect(content).toContain('capability: "execute_code"');
    expect(content).toContain('reason: "Burp Suite, intentional."');
  });

  it("acks every detected capability when none is specified", async () => {
    const result = await ackInPolicy({
      workspaceRoot: workdir,
      policyFile,
      componentId: "mcp.burp",
      reason: "All Burp capabilities approved.",
      scan: fakeScan()
    });
    expect(result.added.map((entry) => entry.capability).sort()).toEqual(["execute_code", "network_access"]);
  });

  it("does not duplicate an entry that is already present", async () => {
    await ackInPolicy({
      workspaceRoot: workdir,
      policyFile,
      componentId: "mcp.burp",
      capability: "execute_code",
      reason: "first ack",
      scan: fakeScan()
    });
    const second = await ackInPolicy({
      workspaceRoot: workdir,
      policyFile,
      componentId: "mcp.burp",
      capability: "execute_code",
      reason: "duplicate attempt",
      scan: fakeScan()
    });
    expect(second.added.length).toBe(0);
    expect(second.alreadyPresent.length).toBe(1);
    const content = await fs.readFile(policyFile, "utf8");
    expect((content.match(/component: "mcp\.burp"/g) ?? []).length).toBe(1);
  });

  it("throws a clear error if no capability is provided and the component has no findings", async () => {
    const empty: ScanResult = {
      ...fakeScan(),
      components: [],
      findings: []
    };
    await expect(ackInPolicy({
      workspaceRoot: workdir,
      policyFile,
      componentId: "skill.unknown",
      reason: "x",
      scan: empty
    })).rejects.toThrow(/not found/i);
  });

  it("notes when the component is not in the scan but still records the explicit capability", async () => {
    const result = await ackInPolicy({
      workspaceRoot: workdir,
      policyFile,
      componentId: "skill.unscanned",
      capability: "external_send",
      reason: "intentional",
      scan: { ...fakeScan(), components: [], findings: [] }
    });
    expect(result.componentExists).toBe(false);
    expect(result.added.length).toBe(1);
  });
});

describe("insertExpectedEntries", () => {
  it("replaces an empty expected: [] block", () => {
    const yaml = "profile: workspace\n\nexpected:\n  []\n";
    const out = insertExpectedEntries(yaml, [{ componentId: "mcp.x", capability: "read_file", reason: "ok" }]);
    expect(out).toContain('component: "mcp.x"');
    expect(out).not.toContain("[]");
  });

  it("inserts under an existing expected: heading without losing other content", () => {
    const yaml = "profile: workspace\n\nexpected:\n  - component: \"mcp.old\"\n    capability: \"read_file\"\n    reason: \"existing\"\n";
    const out = insertExpectedEntries(yaml, [{ componentId: "mcp.new", capability: "execute_code", reason: "added" }]);
    expect(out).toContain('component: "mcp.new"');
    expect(out).toContain('component: "mcp.old"');
  });

  it("appends an expected: section if missing", () => {
    const yaml = "profile: workspace\n";
    const out = insertExpectedEntries(yaml, [{ componentId: "mcp.x", capability: "read_file", reason: "ok" }]);
    expect(out).toContain("expected:");
    expect(out).toContain('component: "mcp.x"');
  });

  it("escapes quotes in reasons", () => {
    const out = insertExpectedEntries("expected:\n  []\n", [{ componentId: "mcp.x", capability: "read_file", reason: 'has "quoted" text' }]);
    expect(out).toContain('reason: "has \\"quoted\\" text"');
  });
});
