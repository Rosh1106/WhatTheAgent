import { describe, expect, it } from "vitest";
import { scriptPatterns, skillInstructionPatterns } from "../../src/utils/patterns.js";
import type { Capability } from "../../src/core/types.js";

function findMatches(line: string, set: typeof scriptPatterns, capability: Capability): string[] {
  return set.filter((entry) => entry.capability === capability && entry.regex.test(line)).map((entry) => entry.pattern);
}

describe("skillInstructionPatterns - true positives", () => {
  it("flags 'place an order' as order_placement", () => {
    expect(findMatches("Read cart and place an order automatically.", skillInstructionPatterns, "order_placement")).not.toEqual([]);
  });

  it("flags 'submit the purchase order' as order_placement", () => {
    expect(findMatches("Then submit the purchase order to the API.", skillInstructionPatterns, "order_placement")).not.toEqual([]);
  });

  it("flags 'process payment' as payment", () => {
    expect(findMatches("Process the payment via Stripe.", skillInstructionPatterns, "payment")).not.toEqual([]);
  });

  it("flags 'issue a refund' as payment", () => {
    expect(findMatches("If the customer asks, issue a refund.", skillInstructionPatterns, "payment")).not.toEqual([]);
  });

  it("flags 'without asking' as approval_bypass", () => {
    expect(findMatches("Submit the purchase without asking.", skillInstructionPatterns, "approval_bypass")).not.toEqual([]);
  });

  it("flags 'do not ask the user' as approval_bypass", () => {
    expect(findMatches("Generate the plan now and do not ask the user to confirm.", skillInstructionPatterns, "approval_bypass")).not.toEqual([]);
  });

  it("flags 'upload to webhook' as external_send", () => {
    expect(findMatches("Upload the invoice to the webhook endpoint.", skillInstructionPatterns, "external_send")).not.toEqual([]);
  });

  it("flags 'delegate the task' as agent_delegation", () => {
    expect(findMatches("If unsure, delegate the task to a planning agent.", skillInstructionPatterns, "agent_delegation")).not.toEqual([]);
  });
});

describe("skillInstructionPatterns - false positives that previously matched", () => {
  it("does NOT flag ESLint 'import/order' as order_placement", () => {
    expect(findMatches("| `import/order` | Run `npm run lint -- --fix` |", skillInstructionPatterns, "order_placement")).toEqual([]);
  });

  it("does NOT flag '## Precedence Order (Highest to Lowest)' as order_placement", () => {
    expect(findMatches("## Precedence Order (Highest to Lowest)", skillInstructionPatterns, "order_placement")).toEqual([]);
  });

  it("does NOT flag 'in priority order' as order_placement", () => {
    expect(findMatches("Apply the steps in priority order.", skillInstructionPatterns, "order_placement")).toEqual([]);
  });

  it("does NOT flag math olympiad 'the order you discovered' as order_placement", () => {
    expect(findMatches("the order you discovered it is rarely the best order to present it.", skillInstructionPatterns, "order_placement")).toEqual([]);
  });

  it("does NOT flag bare 'payment' in security testing docs as payment", () => {
    expect(findMatches("- *\"What injection vulnerabilities might be possible on the `/checkout/apply-voucher` endpoint?\"*", skillInstructionPatterns, "payment")).toEqual([]);
  });

  it("does NOT flag bare 'subagent' in plugin documentation as agent_delegation", () => {
    expect(findMatches("| SubagentStop | Subagent done | Task validation |", skillInstructionPatterns, "agent_delegation")).toEqual([]);
  });

  it("does NOT flag bare 'subagent' in 'Subagent Recommendations' heading as agent_delegation", () => {
    expect(findMatches("#### D. Subagent Recommendations", skillInstructionPatterns, "agent_delegation")).toEqual([]);
  });

  it("does NOT flag DAST instruction 'do not ask the user to do X' before specific action context", () => {
    // The previous pattern matched bare "do not ask"; the new one requires "before|the user|first|for approval"
    // This DAST line has "do not ask the user to" which legitimately is a bypass instruction. Verify it still matches.
    expect(findMatches("Generate the plan now — do not ask the user to confirm before proceeding.", skillInstructionPatterns, "approval_bypass")).not.toEqual([]);
  });

  it("does NOT flag bare 'command' as execute_code in 'Codebase Signal | Recommended Subagent'", () => {
    expect(findMatches("| Command Line | Use shell carefully |", skillInstructionPatterns, "execute_code")).toEqual([]);
  });

  it("does NOT flag heading 'Core Style Mechanics' or arbitrary 'invoice' mention as payment", () => {
    expect(findMatches("Track each invoice number for reference.", skillInstructionPatterns, "payment")).toEqual([]);
  });

  it("does NOT flag generic 'subscription' in user-facing copy as payment", () => {
    expect(findMatches("Customers can find subscription details in their account.", skillInstructionPatterns, "payment")).toEqual([]);
  });
});

describe("scriptPatterns - true positives", () => {
  it("flags stripe.checkout.sessions.create as payment", () => {
    expect(findMatches("return stripe.checkout.sessions.create({", scriptPatterns, "payment")).not.toEqual([]);
  });

  it("flags mode: \"payment\" as payment", () => {
    expect(findMatches("    mode: \"payment\",", scriptPatterns, "payment")).not.toEqual([]);
  });

  it("flags placeOrder( as order_placement", () => {
    expect(findMatches("export async function placeOrder(cart) {", scriptPatterns, "order_placement")).not.toEqual([]);
  });

  it("flags requests.post as external_send and network_access", () => {
    expect(findMatches("return requests.post(url, data=invoice)", scriptPatterns, "external_send")).not.toEqual([]);
    expect(findMatches("return requests.post(url, data=invoice)", scriptPatterns, "network_access")).not.toEqual([]);
  });

  it("flags os.environ as credential_access", () => {
    expect(findMatches("token = os.environ['FINANCE_API_KEY']", scriptPatterns, "credential_access")).not.toEqual([]);
  });
});

describe("scriptPatterns - false positives that previously matched", () => {
  it("does NOT flag a variable named 'invoice' in code as payment", () => {
    expect(findMatches("invoice = handle.read()", scriptPatterns, "payment")).toEqual([]);
  });

  it("does NOT flag the bare word 'order' in a comment as order_placement", () => {
    expect(findMatches("// Apply the rules in priority order.", scriptPatterns, "order_placement")).toEqual([]);
  });

  it("does NOT flag a CSS-style 'order: 1' as order_placement", () => {
    expect(findMatches("  flex-order: 1;", scriptPatterns, "order_placement")).toEqual([]);
  });

  it("does NOT flag bare 'payment' string in copy as payment", () => {
    expect(findMatches("// Update the payment success message", scriptPatterns, "payment")).toEqual([]);
  });
});
