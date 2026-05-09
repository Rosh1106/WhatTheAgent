import { describe, expect, it } from "vitest";
import { compactSnippet, redactSecrets, redactedRecord, slugify, stableId } from "../../src/utils/normalize.js";

describe("redactSecrets", () => {
  it("redacts named GitHub tokens", () => {
    expect(redactSecrets("export GITHUB_TOKEN=ghp_abcdef1234567890abcdef")).not.toMatch(/ghp_abcdef/);
  });

  it("redacts stripe live keys by pattern", () => {
    expect(redactSecrets("key = sk_live_abcdef1234567890")).toContain("[redacted-stripe-key]");
  });

  it("redacts openai sk- keys", () => {
    expect(redactSecrets("OPENAI_API_KEY=sk-abcdef1234567890abcdef")).toContain("[redacted");
  });

  it("redacts api_key=value pattern", () => {
    expect(redactSecrets("api_key=verysecretvalue")).toContain("[redacted]");
  });

  it("redacts standalone Bearer tokens", () => {
    expect(redactSecrets("header = Bearer abcdef.ghijkl-mnopqr"))
      .toContain("Bearer [redacted]");
  });

  it("does not redact ordinary text", () => {
    const out = redactSecrets("This is a sentence with no secrets.");
    expect(out).toContain("This is a sentence with no secrets.");
  });
});

describe("redactedRecord", () => {
  it("replaces every value with [redacted] and sorts keys", () => {
    const out = redactedRecord({ FOO: "x", BAR: "y" });
    expect(Object.keys(out)).toEqual(["BAR", "FOO"]);
    expect(out.FOO).toBe("[redacted]");
    expect(out.BAR).toBe("[redacted]");
  });
});

describe("slugify", () => {
  it("lowercases and dashifies", () => {
    expect(slugify("Hello World!")).toBe("hello-world");
  });

  it("strips leading and trailing separators", () => {
    expect(slugify("--foo--")).toBe("foo");
  });
});

describe("stableId", () => {
  it("prefixes the slug with the type", () => {
    expect(stableId("skill", "my agent")).toBe("skill.my-agent");
  });

  it("falls back to .root for empty input", () => {
    expect(stableId("skill", "")).toBe("skill.root");
  });
});

describe("compactSnippet", () => {
  it("truncates long ordinary content to at most 160 chars", () => {
    const long = "word ".repeat(80);
    expect(compactSnippet(long).length).toBeLessThanOrEqual(160);
  });

  it("collapses runs of whitespace", () => {
    expect(compactSnippet("a   b\t\tc")).toBe("a b c");
  });

  it("redacts secrets inside snippets", () => {
    expect(compactSnippet("api_key=verysecret here")).not.toContain("verysecret");
  });
});
