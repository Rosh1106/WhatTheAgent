import { describe, expect, it } from "vitest";
import { applyFindingLifecycle, classifyFindingLifecycle } from "../../src/core/findingLifecycle.js";
import type { Capability, Component, Finding } from "../../src/core/types.js";

describe("classifyFindingLifecycle", () => {
  it("flags payment findings as needs_attention with fix_required impact", () => {
    const lifecycle = classifyFindingLifecycle(finding("payment", "checkout.js"));
    expect(lifecycle.status).toBe("needs_attention");
    expect(lifecycle.category).toBe("needs_attention");
    expect(lifecycle.impact).toBe("fix_required");
  });

  it("flags order_placement as fix_required", () => {
    const lifecycle = classifyFindingLifecycle(finding("order_placement", "order.js"));
    expect(lifecycle.impact).toBe("fix_required");
  });

  it("flags credential_access on .env as needs_attention", () => {
    const lifecycle = classifyFindingLifecycle(finding("credential_access", ".env"));
    expect(lifecycle.status).toBe("needs_attention");
    expect(lifecycle.impact).toBe("review_recommended");
  });

  it("treats read_file as inventory/informational", () => {
    const lifecycle = classifyFindingLifecycle(finding("read_file", "notes.md"));
    expect(lifecycle.status).toBe("inventory");
    expect(lifecycle.category).toBe("inventory");
    expect(lifecycle.impact).toBe("informational");
  });

  it("treats network_access as inventory/informational", () => {
    const lifecycle = classifyFindingLifecycle(finding("network_access", "x.md"));
    expect(lifecycle.status).toBe("inventory");
  });

  it("falls through to detected/observation for plain write_file", () => {
    const lifecycle = classifyFindingLifecycle(finding("write_file", "out.txt"));
    expect(lifecycle.status).toBe("detected");
    expect(lifecycle.category).toBe("observation");
  });

  it("escalates execute_code to needs_attention via sensitivity", () => {
    const lifecycle = classifyFindingLifecycle(finding("execute_code", "scripts/run.sh"));
    expect(lifecycle.status).toBe("needs_attention");
  });
});

describe("applyFindingLifecycle", () => {
  it("annotates findings with category and impact", () => {
    const components: Component[] = [{ id: "skill.x", type: "skill", label: "x" }];
    const findings: Finding[] = [finding("payment", "x.js", "skill.x")];
    const enriched = applyFindingLifecycle(findings, components);
    expect(enriched[0]?.category).toBe("needs_attention");
    expect(enriched[0]?.impact).toBe("fix_required");
    expect(enriched[0]?.lifecycle.reason).toMatch(/financial/i);
  });
});

function finding(capability: Capability, file: string, componentId = "c"): Finding {
  return {
    id: `${componentId}-${capability}`,
    componentId,
    capability,
    risk: "low",
    evidence: { file, pattern: capability, line: 1, snippet: "" }
  };
}
