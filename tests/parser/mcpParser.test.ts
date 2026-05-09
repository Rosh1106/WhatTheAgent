import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseMcpConfig } from "../../src/parser/mcpParser.js";

let workdir: string;

beforeEach(async () => {
  workdir = await fs.mkdtemp(path.join(os.tmpdir(), "wta-mcp-"));
});

afterEach(async () => {
  await fs.rm(workdir, { recursive: true, force: true });
});

async function writeConfig(name: string, json: unknown): Promise<string> {
  const file = path.join(workdir, name);
  await fs.writeFile(file, JSON.stringify(json, null, 2));
  return file;
}

describe("parseMcpConfig", () => {
  it("parses an mcpServers map and emits one server component per entry", async () => {
    const file = await writeConfig(".mcp.json", {
      mcpServers: {
        "tool-a": { command: "node", args: ["server.js"], env: {} },
        "tool-b": { command: "python", args: ["-m", "tool"], env: {} }
      }
    });
    const result = await parseMcpConfig(workdir, file);
    expect(result.servers.map((s) => s.label).sort()).toEqual(["tool-a", "tool-b"]);
    expect(result.servers.every((s) => s.type === "mcp_server")).toBe(true);
  });

  it("redacts environment values in the parsed metadata", async () => {
    const file = await writeConfig(".mcp.json", {
      mcpServers: {
        api: {
          command: "node",
          args: [],
          env: { GITHUB_TOKEN: "ghp_realsecretvalue1234567890", FOO: "bar" }
        }
      }
    });
    const result = await parseMcpConfig(workdir, file);
    const env = result.servers[0]?.metadata.env ?? {};
    expect(env["GITHUB_TOKEN"]).toBe("[redacted]");
    expect(env["FOO"]).toBe("[redacted]");
  });

  it("flags unpinned npx packages", async () => {
    const file = await writeConfig(".mcp.json", {
      mcpServers: {
        unpinned: { command: "npx", args: ["some-mcp-server"], env: {} }
      }
    });
    const result = await parseMcpConfig(workdir, file);
    expect(result.servers[0]?.metadata.riskFlags).toContain("unpinned_package");
  });

  it("does not flag pinned npx packages", async () => {
    const file = await writeConfig(".mcp.json", {
      mcpServers: {
        pinned: { command: "npx", args: ["some-mcp-server@1.2.3"], env: {} }
      }
    });
    const result = await parseMcpConfig(workdir, file);
    expect(result.servers[0]?.metadata.riskFlags).not.toContain("unpinned_package");
  });

  it("flags servers with secret-shaped env keys as sensitive_env", async () => {
    const file = await writeConfig(".mcp.json", {
      mcpServers: {
        api: { command: "node", args: [], env: { STRIPE_SECRET_KEY: "x" } }
      }
    });
    const result = await parseMcpConfig(workdir, file);
    expect(result.servers[0]?.metadata.riskFlags).toContain("sensitive_env");
  });

  it("flags remote MCP via http url in args", async () => {
    const file = await writeConfig(".mcp.json", {
      mcpServers: {
        remote: { command: "node", args: ["--endpoint", "https://example.com/mcp"], env: {} }
      }
    });
    const result = await parseMcpConfig(workdir, file);
    expect(result.servers[0]?.metadata.riskFlags).toContain("remote_mcp");
  });

  it("emits a payment finding when args mention stripe", async () => {
    const file = await writeConfig(".mcp.json", {
      mcpServers: {
        finance: { command: "node", args: ["--mode", "stripe-charge"], env: {} }
      }
    });
    const result = await parseMcpConfig(workdir, file);
    const capabilities = result.findings.map((f) => f.capability);
    expect(capabilities).toContain("payment");
    expect(capabilities).toContain("execute_code");
  });

  it("emits an order_placement finding when args mention order", async () => {
    const file = await writeConfig(".mcp.json", {
      mcpServers: {
        commerce: { command: "node", args: ["--place-order"], env: {} }
      }
    });
    const result = await parseMcpConfig(workdir, file);
    expect(result.findings.map((f) => f.capability)).toContain("order_placement");
  });

  it("returns no servers for an empty or malformed config", async () => {
    const file = await writeConfig(".mcp.json", {});
    const result = await parseMcpConfig(workdir, file);
    expect(result.servers).toEqual([]);
  });
});
