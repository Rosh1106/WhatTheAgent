import { describe, expect, it } from "vitest";
import { formatPersonalBaselineDiffSummary } from "../../src/output/personalAgentFormatter.js";
import type { PersonalAgentBaselineDiff } from "../../src/core/types.js";

function baseDiff(overrides: Partial<PersonalAgentBaselineDiff> = {}): PersonalAgentBaselineDiff {
  const empty: PersonalAgentBaselineDiff = {
    schemaVersion: "0.1",
    profile: "personal-agent",
    workspace: { root: "." },
    baselineCreatedAt: "2026-01-01T00:00:00Z",
    newSkills: [],
    removedSkills: [],
    addedCapabilities: [],
    addedRiskChains: [],
    policyProposal: { profile: "personal-agent", file: "wta.policy.yaml", summary: "", yaml: "", recommendedControls: [], appliesTo: [] },
    agentPrompt: "",
    summary: { newSkillCount: 0, removedSkillCount: 0, addedCapabilityCount: 0, addedRiskChainCount: 0 }
  };
  return { ...empty, ...overrides };
}

describe("formatPersonalBaselineDiffSummary", () => {
  it("shows a TL;DR line summarizing every change category", () => {
    const out = formatPersonalBaselineDiffSummary(baseDiff({
      summary: { newSkillCount: 2, removedSkillCount: 1, addedCapabilityCount: 5, addedRiskChainCount: 1 }
    }));
    expect(out).toMatch(/2 new skills.*1 removed.*5 added capabilities.*1 added risk chain/);
  });

  it("renders the no-change message when nothing changed", () => {
    const out = formatPersonalBaselineDiffSummary(baseDiff());
    expect(out).toContain("No changes since baseline.");
  });

  it("renders an added risk chain with capability flow", () => {
    const out = formatPersonalBaselineDiffSummary(baseDiff({
      summary: { newSkillCount: 0, removedSkillCount: 0, addedCapabilityCount: 0, addedRiskChainCount: 1 },
      addedRiskChains: [{
        id: "chain.x",
        name: "Data Exfiltration",
        componentId: "skill.x",
        capabilities: ["credential_access", "external_send"],
        risk: "critical",
        message: "Component can read creds and send.",
        evidence: []
      }]
    }));
    expect(out).toContain("[CRITICAL] Data Exfiltration");
    expect(out).toContain("credential_access  -->  external_send");
  });

  it("renders new and removed skills under separate headings", () => {
    const out = formatPersonalBaselineDiffSummary(baseDiff({
      summary: { newSkillCount: 1, removedSkillCount: 1, addedCapabilityCount: 0, addedRiskChainCount: 0 },
      newSkills: [{ componentId: "skill.added", label: "added", path: "skills/added/SKILL.md", status: "added", capabilities: ["read_file"], findings: [], riskChains: [] }],
      removedSkills: [{ componentId: "skill.removed", label: "removed", path: "skills/removed/SKILL.md", status: "removed", capabilities: [], findings: [], riskChains: [] }]
    }));
    expect(out).toContain("New skills");
    expect(out).toContain("+ added");
    expect(out).toContain("Removed skills");
    expect(out).toContain("- removed");
  });

  it("includes the wta ack action hint", () => {
    const out = formatPersonalBaselineDiffSummary(baseDiff({
      summary: { newSkillCount: 1, removedSkillCount: 0, addedCapabilityCount: 1, addedRiskChainCount: 0 }
    }));
    expect(out).toContain("wta ack <component>");
  });
});
