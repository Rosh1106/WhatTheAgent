import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ackBatchInPolicy, ackInPolicy, insertExpectedEntries, parseAckBatchInput } from "../../src/core/ackPolicy.js";
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

describe("parseAckBatchInput", () => {
  it("parses an array of items with componentId and reason", () => {
    const items = parseAckBatchInput('[{"componentId":"mcp.a","reason":"x"},{"componentId":"skill.b","reason":"y"}]');
    expect(items).toEqual([
      { componentId: "mcp.a", reason: "x" },
      { componentId: "skill.b", reason: "y" }
    ]);
  });

  it("preserves an explicit per-item capability", () => {
    const items = parseAckBatchInput('[{"componentId":"mcp.a","capability":"execute_code","reason":"x"}]');
    expect(items[0]?.capability).toBe("execute_code");
  });

  it("treats whitespace-only fields as missing", () => {
    const items = parseAckBatchInput('[{"componentId":"mcp.a","reason":"   "}]');
    expect(items[0]?.reason).toBeUndefined();
  });

  it("rejects non-array input", () => {
    expect(() => parseAckBatchInput('{"componentId":"mcp.a"}')).toThrow(/array/i);
  });

  it("rejects items missing componentId", () => {
    expect(() => parseAckBatchInput('[{"reason":"x"}]')).toThrow(/componentId/);
  });

  it("rejects empty input", () => {
    expect(() => parseAckBatchInput("")).toThrow(/empty/i);
  });

  it("rejects malformed JSON with a clear error", () => {
    expect(() => parseAckBatchInput("[{not json}]")).toThrow(/parse/i);
  });
});

describe("ackBatchInPolicy", () => {
  const sharedScan: ScanResult = {
    schemaVersion: "0.1",
    workspace: { root: "." },
    components: [
      { id: "mcp.burp", type: "mcp_server", label: "burp" },
      { id: "skill.invoice", type: "skill", label: "invoice" }
    ],
    findings: [
      { id: "f1", componentId: "mcp.burp", capability: "execute_code", risk: "high", evidence: { file: "x", pattern: "command" } },
      { id: "f2", componentId: "mcp.burp", capability: "network_access", risk: "low", evidence: { file: "x", pattern: "url" } },
      { id: "f3", componentId: "skill.invoice", capability: "external_send", risk: "high", evidence: { file: "y", pattern: "post" } }
    ],
    riskChains: [],
    graph: { nodes: [], edges: [] },
    summary: { componentsByType: {} as never, capabilities: {} as never, riskChainsByRisk: {} as never }
  };

  it("acknowledges all detected capabilities for each component when none is specified", async () => {
    const result = await ackBatchInPolicy({
      workspaceRoot: workdir,
      policyFile,
      items: [{ componentId: "mcp.burp", reason: "Burp ok" }, { componentId: "skill.invoice", reason: "ours" }],
      scan: sharedScan
    });
    expect(result.added.length).toBe(3);
    expect(result.added.map((entry) => `${entry.componentId}:${entry.capability}`).sort()).toEqual([
      "mcp.burp:execute_code",
      "mcp.burp:network_access",
      "skill.invoice:external_send"
    ]);
  });

  it("uses --reason as the default for items that omit their own reason", async () => {
    const result = await ackBatchInPolicy({
      workspaceRoot: workdir,
      policyFile,
      items: [{ componentId: "mcp.burp" }, { componentId: "skill.invoice" }],
      defaultReason: "approved batch",
      scan: sharedScan
    });
    expect(result.added.length).toBe(3);
    const content = await fs.readFile(policyFile, "utf8");
    expect(content).toContain('reason: "approved batch"');
  });

  it("lets per-item reason override the default", async () => {
    const result = await ackBatchInPolicy({
      workspaceRoot: workdir,
      policyFile,
      items: [{ componentId: "skill.invoice", reason: "specific" }],
      defaultReason: "default",
      scan: sharedScan
    });
    expect(result.added.length).toBe(1);
    const content = await fs.readFile(policyFile, "utf8");
    expect(content).toContain('reason: "specific"');
    expect(content).not.toContain('reason: "default"');
  });

  it("dedupes against an existing policy in a single batch", async () => {
    await ackBatchInPolicy({
      workspaceRoot: workdir,
      policyFile,
      items: [{ componentId: "mcp.burp", capability: "execute_code", reason: "first" }],
      scan: sharedScan
    });
    const second = await ackBatchInPolicy({
      workspaceRoot: workdir,
      policyFile,
      items: [
        { componentId: "mcp.burp", capability: "execute_code", reason: "duplicate attempt" },
        { componentId: "mcp.burp", capability: "network_access", reason: "new" }
      ],
      scan: sharedScan
    });
    expect(second.added.length).toBe(1);
    expect(second.added[0]?.capability).toBe("network_access");
    expect(second.alreadyPresent.length).toBe(1);
  });

  it("dedupes within a single batch (same item supplied twice)", async () => {
    const result = await ackBatchInPolicy({
      workspaceRoot: workdir,
      policyFile,
      items: [
        { componentId: "skill.invoice", capability: "external_send", reason: "first" },
        { componentId: "skill.invoice", capability: "external_send", reason: "duplicate" }
      ],
      scan: sharedScan
    });
    expect(result.added.length).toBe(1);
  });

  it("skips items that have no reason at all and reports them clearly", async () => {
    const result = await ackBatchInPolicy({
      workspaceRoot: workdir,
      policyFile,
      items: [{ componentId: "mcp.burp" }],
      scan: sharedScan
    });
    expect(result.added.length).toBe(0);
    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0]?.reason).toMatch(/no reason/i);
  });

  it("skips items whose component has no detected capabilities and no explicit one", async () => {
    const result = await ackBatchInPolicy({
      workspaceRoot: workdir,
      policyFile,
      items: [{ componentId: "skill.unknown", reason: "approved" }],
      scan: sharedScan
    });
    expect(result.added.length).toBe(0);
    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0]?.reason).toMatch(/not found|no detected/i);
  });

  it("returns a no-op result for an empty input array", async () => {
    const result = await ackBatchInPolicy({
      workspaceRoot: workdir,
      policyFile,
      items: [],
      scan: sharedScan
    });
    expect(result).toEqual({ policyFile, added: [], alreadyPresent: [], skipped: [], itemCount: 0 });
  });
});
