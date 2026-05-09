---
name: WhatTheAgent Safety Check
description: When the user adds or changes a skill, MCP server, or script, scan the workspace and ask the user once before approving new agent capabilities.
---

# What this skill does

Use WhatTheAgent to scan the personal-agent workspace, surface anything that needs the user's attention as a phone-readable chat message, listen for the user's reply, and translate that reply into a concrete `wta` command. Never delete files or change capabilities silently. Never approve on the user's behalf.

# When to trigger this skill

- The user mentions adding, installing, or editing a skill / MCP server / script.
- The user asks "is this safe?", "what does X do?", or "what can my agent do?"
- A scheduled daily/weekly check.
- A baseline already exists in `.wta/baseline.json` (use `diff-baseline`); otherwise create one with `wta baseline`.

# Workflow

1. **Decide which command to run.**
   - First-time use, or no baseline yet → run `wta understand . --profile hermes --output .wta --chat --json`.
   - Baseline exists at `.wta/baseline.json` → run `wta diff-baseline . --profile hermes --output .wta --chat --json`.

2. **Parse the JSON output.** It has this shape:

   ```jsonc
   {
     "schemaVersion": "0.1",
     "source": "understand" | "diff-baseline",
     "message": "...phone-readable markdown to send the user verbatim...",
     "items": [
       {
         "componentId": "skill.invoice-review",
         "label": "invoice-review",
         "type": "skill",
         "path": "skills/invoice-review/SKILL.md",
         "capabilities": ["credential_access", "external_send"],
         "riskChainName": "Data Exfiltration",
         "highestRisk": "critical",
         "why": "Component can read credentials and send data externally.",
         "actions": {
           "approve":   { "intent": "...", "command": "wta ack skill.invoice-review --reason \"<USER_REASON>\"" },
           "guardrail": { "intent": "...", "hint":    "Edit wta.policy.yaml to require human_approval ..." },
           "remove":    { "intent": "...", "hint":    "Delete the file at skills/invoice-review/SKILL.md ..." }
         }
       }
     ],
     "summary": { "totalItems": 1, "highestSeverity": "critical", "riskChainCount": 1 }
   }
   ```

3. **Send `message` verbatim to the user.** Do not paraphrase. Do not add commentary. The message is already phone-readable, has severity icons, lists every item with its label/path/chain, and ends with an "approve / guardrail / remove" prompt.

   If `summary.totalItems === 0`, send the all-clear message and stop.

4. **Wait for the user's reply.** Map natural-language intent to one of three branches:

   | User says (examples)                                         | Branch     |
   |---------------------------------------------------------------|------------|
   | "approve", "yes", "fine", "it's ok", "intentional", "I added that" | **approve**   |
   | "add a guardrail", "require approval first", "don't auto-run", "scope it down" | **guardrail** |
   | "remove", "delete", "I don't want it", "uninstall"             | **remove**    |

   If the reply is ambiguous ("idk", "what is this?", "explain"), do not act. Re-send the relevant portion of `message` for that item, or read out `items[i].why` plus the path. Then wait again.

5. **Execute the chosen branch per item.**

   - **approve (one item)**: ask the user *why* (one short sentence), then pipe their reason on stdin to avoid shell-escape pain:

     ```bash
     printf '%s' "<USER_REASON>" | wta ack <componentId> [<capability>] --reason-from-stdin
     ```

     Confirm: "Approved {label}. Saved to wta.policy.yaml."

   - **approve (multiple items / "approve all")**: ask the user for one batch reason (or use a per-item one if they provide it), then send a single `wta ack-batch` call with a JSON array:

     ```bash
     cat <<'JSON' | wta ack-batch --reason "<USER_REASON>"
     [
       { "componentId": "<id1>" },
       { "componentId": "<id2>" }
     ]
     JSON
     ```

     Read the resulting `added` / `alreadyPresent` / `skipped` counts and confirm: "Approved {N} items. {M} already in policy. {K} skipped (see logs)."

   - **guardrail**: do not run any command. Show the user the `actions.guardrail.hint` text, then tell them: "When you're ready, edit `wta.policy.yaml` (I can help) or run `wta init-policy . --from-scan` to seed it." Optionally help them write the YAML edit, but do not write the edit yourself unless the user explicitly says so.

   - **remove**: do not delete files. Show `actions.remove.hint`. If the user says "yes go ahead and delete", and the file is inside the user's own personal-agent skills directory (not a system / marketplace path), show them the `rm` command and ask once more before running it.

6. **Re-scan after any approval.** Run `wta understand . --profile hermes --output .wta --chat --json` again. If `summary.totalItems` is now 0 or has dropped, tell the user: "{N} items still need attention." Otherwise: "All clear."

7. **Update the baseline only when the user says so.** Do not silently rebaseline.

# What NEVER to do

- **Never** run `wta ack` until the user has explicitly approved that specific item *and* given a reason. The reason is the policy audit trail.
- **Never** delete files automatically. Even on "remove" intent, show the command and confirm.
- **Never** paraphrase the chat message. Send `message` verbatim — it's been built to fit a phone screen and carry the severity color cues.
- **Never** hide an item the user hasn't seen. Every item in `items[]` must appear in either the message or a follow-up.
- **Never** start MCP servers, run scripts, or send network requests during this skill. WhatTheAgent is a static scanner; this skill must remain static too.
- **Never** modify SOUL.md, IDENTITY.md, PERSONA.md, MEMORY.md, or AGENTS.md.

# Fallback if the JSON shape changes or parsing fails

Read `.wta/chat-message.md` instead — same content, plain markdown. Send it verbatim and ask the user to reply with `approve <label>`, `guardrail <label>`, or `remove <label>`. Then run the corresponding command from `.wta/chat-actions.json` by hand.

# Example session

```
User: I just installed a new invoice-review skill.

Agent: Let me check what it does.
       (runs: wta diff-baseline . --profile hermes --output .wta --chat --json)

Agent posts (verbatim):
   🔴 1 new skill · 1 new risk chain

   invoice-review (Skill)
      skills/invoice-review/SKILL.md
      credential_access → external_send
      data exfiltration

   Component can read credentials and send data externally.

   What do you want to do?
      ✅ approve — I trust this, add to policy
      🛡  guardrail — require approval / scope it down
      🚫 remove — delete it

User: it's ours, approve

Agent: Got it. Quick reason for the policy log? (e.g. "internal finance pipeline")
User: internal finance pipeline, sends invoices to our staging webhook

Agent: (runs: wta ack skill.invoice-review --reason "internal finance pipeline, sends invoices to our staging webhook")
       Approved invoice-review. Saved to wta.policy.yaml.
       (re-runs diff-baseline)
       All clear.
```
