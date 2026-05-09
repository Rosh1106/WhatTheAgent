import { describe, expect, it } from "vitest";
import { buildDiffChatSummary, buildUnderstandChatSummary } from "../../src/output/chatSummary.js";
import type { PersonalAgentBaselineDiff, RiskChain, UnderstandResult } from "../../src/core/types.js";

function baseUnderstand(overrides: Partial<UnderstandResult> = {}): UnderstandResult {
  const empty: UnderstandResult = {
    schemaVersion: "0.1",
    workspace: { root: "/repo/example" },
    inventory: {
      workspaceRoot: "/repo/example",
      surfaces: [],
      toolServers: [],
      counts: { skills: 1, scripts: 0, toolServers: 1, findings: 0, riskChains: 0 }
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
  evidence: []
};

function baseDiff(overrides: Partial<PersonalAgentBaselineDiff> = {}): PersonalAgentBaselineDiff {
  const empty: PersonalAgentBaselineDiff = {
    schemaVersion: "0.1",
    profile: "hermes",
    workspace: { root: "/repo/example" },
    baselineCreatedAt: "2026-01-01T00:00:00Z",
    newSkills: [],
    removedSkills: [],
    addedCapabilities: [],
    addedRiskChains: [],
    policyProposal: { profile: "hermes", file: "wta.policy.yaml", summary: "", yaml: "", recommendedControls: [], appliesTo: [] },
    agentPrompt: "",
    summary: { newSkillCount: 0, removedSkillCount: 0, addedCapabilityCount: 0, addedRiskChainCount: 0 }
  };
  return { ...empty, ...overrides };
}

describe("buildUnderstandChatSummary", () => {
  it("emits an all-clear message when nothing needs attention", () => {
    const summary = buildUnderstandChatSummary(baseUnderstand());
    expect(summary.items).toEqual([]);
    expect(summary.summary.highestSeverity).toBe("none");
    expect(summary.message).toContain("Nothing urgent");
  });

  it("creates one item per risk chain, leading with the component label and path", () => {
    const summary = buildUnderstandChatSummary(baseUnderstand({
      riskChains: [exfilChain],
      scan: {
        ...baseUnderstand().scan,
        components: [{ id: "skill.invoice-review", type: "skill", label: "invoice-review", path: "skills/invoice-review/SKILL.md" }]
      }
    }));
    expect(summary.items.length).toBe(1);
    const item = summary.items[0]!;
    expect(item.label).toBe("invoice-review");
    expect(item.path).toBe("skills/invoice-review/SKILL.md");
    expect(item.type).toBe("skill");
    expect(item.highestRisk).toBe("critical");
    expect(item.riskChainName).toBe("Data Exfiltration");
  });

  it("provides exact wta ack command in actions, with USER_REASON placeholder", () => {
    const summary = buildUnderstandChatSummary(baseUnderstand({ riskChains: [exfilChain] }));
    expect(summary.items[0]!.actions.approve.command).toBe('wta ack skill.invoice-review --reason "<USER_REASON>"');
    expect(summary.items[0]!.actions.guardrail.hint).toContain("human_approval");
  });

  it("renders the user-facing message with severity bullets and the three-option footer", () => {
    const summary = buildUnderstandChatSummary(baseUnderstand({ riskChains: [exfilChain] }));
    expect(summary.message).toContain("🔴 1 risk chain");
    expect(summary.message).toContain("approve");
    expect(summary.message).toContain("guardrail");
    expect(summary.message).toContain("remove");
  });

  it("sorts items by severity (critical first)", () => {
    const understand = baseUnderstand({
      riskChains: [
        { ...exfilChain, id: "chain.high", risk: "high", componentId: "skill.b", name: "Silent External" },
        { ...exfilChain, id: "chain.crit", risk: "critical", componentId: "skill.a", name: "Data Exfil" }
      ]
    });
    const summary = buildUnderstandChatSummary(understand);
    expect(summary.items[0]?.highestRisk).toBe("critical");
    expect(summary.items[1]?.highestRisk).toBe("high");
  });

  it("dedupes when the same component has both a chain and a control gap", () => {
    const understand = baseUnderstand({
      riskChains: [exfilChain],
      controlGaps: [{
        id: "gap.x",
        control: "human_approval",
        componentId: "skill.invoice-review",
        risk: "high",
        message: "Add approval gate.",
        evidence: [],
        impact: "fix_required"
      }]
    });
    const summary = buildUnderstandChatSummary(understand);
    expect(summary.items.length).toBe(1);
  });
});

describe("buildDiffChatSummary", () => {
  it("emits a no-changes message when the diff is empty", () => {
    const summary = buildDiffChatSummary(baseDiff());
    expect(summary.items).toEqual([]);
    expect(summary.message).toContain("No changes since the last baseline");
  });

  it("lists each new skill with capabilities and an approve command", () => {
    const summary = buildDiffChatSummary(baseDiff({
      summary: { newSkillCount: 1, removedSkillCount: 0, addedCapabilityCount: 2, addedRiskChainCount: 0 },
      newSkills: [{
        componentId: "skill.invoice-review",
        label: "invoice-review",
        path: "skills/invoice-review/SKILL.md",
        status: "added",
        capabilities: ["credential_access", "external_send"],
        findings: [],
        riskChains: [{ id: "c1", name: "Data Exfiltration", componentId: "skill.invoice-review", capabilities: ["credential_access", "external_send"], risk: "critical", message: "msg", evidence: [] }]
      }]
    }));
    expect(summary.items.length).toBe(1);
    const item = summary.items[0]!;
    expect(item.label).toBe("invoice-review");
    expect(item.highestRisk).toBe("critical");
    expect(item.capabilities).toEqual(["credential_access", "external_send"]);
    expect(item.actions.approve.command).toContain('wta ack skill.invoice-review --reason "<USER_REASON>"');
  });

  it("includes the headline counts and severity icon", () => {
    const summary = buildDiffChatSummary(baseDiff({
      summary: { newSkillCount: 2, removedSkillCount: 1, addedCapabilityCount: 5, addedRiskChainCount: 1 },
      newSkills: [
        { componentId: "skill.a", label: "a", path: "x", status: "added", capabilities: ["read_file"], findings: [], riskChains: [] },
        { componentId: "skill.b", label: "b", path: "y", status: "added", capabilities: ["external_send"], findings: [], riskChains: [] }
      ],
      addedRiskChains: [{ id: "c1", name: "Data Exfiltration", componentId: "skill.b", capabilities: ["credential_access", "external_send"], risk: "critical", message: "x", evidence: [] }]
    }));
    expect(summary.message).toMatch(/2 new skills/);
    expect(summary.message).toMatch(/1 new risk chain/);
    expect(summary.message).toMatch(/1 removed/);
    expect(summary.message).toContain("🔴");
  });
});
