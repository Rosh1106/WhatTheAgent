import { describe, expect, it } from "vitest";
import { sensitivityForFinding } from "../../src/risk/sensitivity.js";
import type { Capability, Component, Finding } from "../../src/core/types.js";

describe("sensitivityForFinding", () => {
  it("treats payment as critical regardless of evidence", () => {
    expect(sensitivityForFinding(finding("payment", "any.md"))).toBe("critical");
  });

  it("treats order_placement as critical", () => {
    expect(sensitivityForFinding(finding("order_placement", "any.md"))).toBe("critical");
  });

  it("treats approval_bypass as sensitive", () => {
    expect(sensitivityForFinding(finding("approval_bypass", "rule.md"))).toBe("sensitive");
  });

  it("treats execute_code as sensitive", () => {
    expect(sensitivityForFinding(finding("execute_code", "skill.md"))).toBe("sensitive");
  });

  it("treats credential_access on a .env path as sensitive", () => {
    expect(sensitivityForFinding(finding("credential_access", "config/.env"))).toBe("sensitive");
  });

  it("treats credential_access on a benign path as normal", () => {
    expect(sensitivityForFinding(finding("credential_access", "skills/notes/SKILL.md"))).toBe("normal");
  });

  it("treats credential_access containing a token snippet as sensitive", () => {
    const f = finding("credential_access", "skills/x/SKILL.md");
    f.evidence.snippet = "uses GITHUB_TOKEN to authorize";
    expect(sensitivityForFinding(f)).toBe("sensitive");
  });

  it("treats write_file on .ssh as sensitive", () => {
    expect(sensitivityForFinding(finding("write_file", "/home/u/.ssh/id_rsa"))).toBe("sensitive");
  });

  it("treats plain read_file as normal", () => {
    expect(sensitivityForFinding(finding("read_file", "docs/notes.md"))).toBe("normal");
  });

  it("treats external_send with sensitive snippet as sensitive", () => {
    const f = finding("external_send", "skills/x/SKILL.md");
    f.evidence.snippet = "POST customer payload to webhook";
    expect(sensitivityForFinding(f)).toBe("sensitive");
  });

  it("treats external_send with innocuous snippet as normal", () => {
    expect(sensitivityForFinding(finding("external_send", "x.md"))).toBe("normal");
  });

  it("treats database_access as sensitive", () => {
    expect(sensitivityForFinding(finding("database_access", "x.md"))).toBe("sensitive");
  });

  it("treats broad MCP tool servers as sensitive based on metadata", () => {
    const component: Component = {
      id: "mcp.broad",
      type: "mcp_server",
      label: "broad",
      metadata: { command: "npx", args: ["broad-mcp", "--upload"], env: { GITHUB_TOKEN: "[redacted]" } }
    };
    const f = finding("read_file", "mcp.json");
    expect(sensitivityForFinding(f, component)).toBe("sensitive");
  });
});

function finding(capability: Capability, file: string): Finding {
  return {
    id: `${capability}-${file}`,
    componentId: "c",
    capability,
    risk: "low",
    evidence: { file, pattern: capability }
  };
}
