import { describe, expect, it } from "vitest";
import { renderHtmlReport } from "../../src/output/htmlReport.js";
import type { ControlGap, Observation, RiskChain, UnderstandResult } from "../../src/core/types.js";

function baseResult(overrides: Partial<UnderstandResult> = {}): UnderstandResult {
  const empty: UnderstandResult = {
    schemaVersion: "0.1",
    workspace: { root: "/repo/example" },
    inventory: {
      workspaceRoot: "/repo/example",
      surfaces: [],
      toolServers: [],
      counts: { skills: 2, scripts: 1, toolServers: 1, findings: 7, riskChains: 0 }
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

const exfilChain: RiskChain = {
  id: "chain.exfil",
  name: "Data Exfiltration",
  componentId: "skill.invoice-review",
  capabilities: ["credential_access", "external_send"],
  risk: "critical",
  message: "Component can read credentials and send data externally.",
  evidence: [
    { file: "skills/invoice-review/scripts/upload.py", line: 8, snippet: "requests.post(...)", pattern: "requests.post" }
  ]
};

const gap: ControlGap = {
  id: "gap.approval",
  control: "human_approval",
  componentId: "skill.invoice-review",
  risk: "high",
  message: "Add a human approval gate before external sends.",
  evidence: [],
  impact: "fix_required"
};

describe("renderHtmlReport", () => {
  it("renders a self-contained HTML document", () => {
    const html = renderHtmlReport(baseResult());
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("</html>");
    expect(html).not.toMatch(/<link[^>]+href=/);
    expect(html).not.toMatch(/<script[^>]+src=/);
  });

  it("shows the workspace path in the header", () => {
    const html = renderHtmlReport(baseResult({ workspace: { root: "/repo/example" } }));
    expect(html).toContain("/repo/example");
  });

  it("shows zero-state headline when nothing needs attention", () => {
    const html = renderHtmlReport(baseResult());
    expect(html).toContain("No urgent capability risks");
  });

  it("shows a risk-chain entry with the chain flow when chains exist", () => {
    const html = renderHtmlReport(baseResult({ riskChains: [exfilChain] }));
    expect(html).toContain("Data Exfiltration");
    expect(html).toContain("credential_access");
    expect(html).toContain("external_send");
    expect(html).toContain('class="entry-flow"');
    expect(html).toContain('class="arrow"');
  });

  it("does not embed the visual chains SVG inline (editorial restraint; the SVG file remains at visual-chains.svg)", () => {
    const html = renderHtmlReport(baseResult({ riskChains: [exfilChain] }));
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("visual-wrap");
  });

  it("does not render the risk section when no chains exist", () => {
    const html = renderHtmlReport(baseResult());
    expect(html).not.toContain('id="risk"');
  });

  it("renders meaningful control gaps under the needs-attention section", () => {
    const html = renderHtmlReport(baseResult({ controlGaps: [gap] }));
    expect(html).toContain('id="attention"');
    expect(html).toContain("Missing · Human Approval");
    expect(html).toContain("Add a human approval gate before external sends");
  });

  it("renders the expected section only when observations are present", () => {
    const expected: Observation = {
      id: "obs.expected",
      componentId: "mcp.github",
      capability: "network_access",
      category: "inventory",
      confidence: "high",
      impact: "informational",
      message: "GitHub MCP is allowed by policy.",
      evidence: [],
      expected: true
    };
    const withExpected = renderHtmlReport(baseResult({ expected: [expected] }));
    expect(withExpected).toContain("id=\"expected\"");
    expect(withExpected).toContain("GitHub MCP is allowed by policy");

    const withoutExpected = renderHtmlReport(baseResult());
    expect(withoutExpected).not.toContain("id=\"expected\"");
  });

  it("escapes HTML in chain names, component labels, and paths", () => {
    const malicious: RiskChain = {
      ...exfilChain,
      name: "<script>alert(1)</script>",
      componentId: "skill.malicious"
    };
    const result = baseResult({
      riskChains: [malicious],
      scan: {
        ...baseResult().scan,
        components: [{
          id: "skill.malicious",
          type: "skill",
          label: "<img src=x onerror=alert(1)>",
          path: "<svg/onload=alert(1)>"
        }]
      }
    });
    const html = renderHtmlReport(result);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x onerror");
    expect(html).not.toContain("<svg/onload");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
  });

  it("includes the four-item summary block with correct counts in the masthead", () => {
    const html = renderHtmlReport(baseResult({
      riskChains: [exfilChain],
      controlGaps: [gap]
    }));
    expect(html).toContain('class="summary"');
    expect(html).toContain("Risk chains");
    expect(html).toContain("Needs attention");
    expect(html).toContain("Acknowledged");
    expect(html).toContain("Inventory findings");
    // No coloured pill chrome; counts are plain numbers in <dd>.
    expect(html).not.toContain("pill-crit");
    expect(html).not.toContain("pill-warn");
  });

  it("leads each entry with the component label and type, demoting the slug ID", () => {
    const result = baseResult({
      riskChains: [exfilChain],
      scan: {
        ...baseResult().scan,
        components: [{
          id: "skill.invoice-review",
          type: "skill",
          label: "invoice-review",
          path: "skills/invoice-review/SKILL.md"
        }]
      }
    });
    const html = renderHtmlReport(result);
    expect(html).toContain('class="entry-label"');
    expect(html).toContain("invoice-review");
    expect(html).toContain('class="entry-type"');
    expect(html).toContain(">Skill<");
    expect(html).toContain("skills/invoice-review/SKILL.md");
  });

  it("falls back to (unknown component) when the chain references an id not in the scan", () => {
    const html = renderHtmlReport(baseResult({ riskChains: [exfilChain] }));
    expect(html).toContain("(unknown component)");
  });

  it("is light-mode only — no prefers-color-scheme:dark block, declares color-scheme:light", () => {
    const html = renderHtmlReport(baseResult());
    expect(html).not.toContain("@media (prefers-color-scheme: dark)");
    expect(html).toContain("color-scheme: light");
  });

  it("uses numbered editorial section headers (01, 02, ...) instead of icon/coloured pills", () => {
    const html = renderHtmlReport(baseResult({ riskChains: [exfilChain], controlGaps: [gap] }));
    expect(html).toContain('class="section-number"');
    expect(html).toContain(">01<");
    expect(html).toContain('class="section-title"');
  });

  it("does not import the Inter typeface (impeccable.style flags Inter-everywhere as an anti-pattern)", () => {
    const html = renderHtmlReport(baseResult());
    expect(html).not.toContain("Inter");
    expect(html).not.toContain("fonts.googleapis.com");
  });

  it("is deterministic: same input produces same output", () => {
    const result = baseResult({ riskChains: [exfilChain] });
    expect(renderHtmlReport(result)).toBe(renderHtmlReport(result));
  });
});
