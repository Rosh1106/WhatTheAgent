import type { Capability } from "../core/types.js";

export interface CapabilityPattern {
  capability: Capability;
  pattern: string;
  regex: RegExp;
}

export const scriptPatterns: CapabilityPattern[] = [
  { capability: "external_send", pattern: "requests.post", regex: /\brequests\.post\b/ },
  { capability: "network_access", pattern: "requests.post", regex: /\brequests\.post\b/ },
  { capability: "external_send", pattern: "requests.put", regex: /\brequests\.put\b/ },
  { capability: "network_access", pattern: "requests.put", regex: /\brequests\.put\b/ },
  { capability: "external_send", pattern: "fetch(", regex: /\bfetch\s*\(/ },
  { capability: "network_access", pattern: "fetch(", regex: /\bfetch\s*\(/ },
  { capability: "external_send", pattern: "axios.", regex: /\baxios\./ },
  { capability: "network_access", pattern: "axios.", regex: /\baxios\./ },
  { capability: "external_send", pattern: "curl", regex: /(^|\s)curl(\s|$)/ },
  { capability: "network_access", pattern: "curl", regex: /(^|\s)curl(\s|$)/ },
  { capability: "external_send", pattern: "wget", regex: /(^|\s)wget(\s|$)/ },
  { capability: "network_access", pattern: "wget", regex: /(^|\s)wget(\s|$)/ },
  { capability: "network_access", pattern: "http.client", regex: /\bhttp\.client\b/ },
  { capability: "network_access", pattern: "urllib.request", regex: /\burllib\.request\b/ },
  { capability: "execute_code", pattern: "exec(", regex: /\bexec\s*\(/ },
  { capability: "execute_code", pattern: "spawn(", regex: /\bspawn\s*\(/ },
  { capability: "execute_code", pattern: "child_process", regex: /\bchild_process\b/ },
  { capability: "execute_code", pattern: "subprocess", regex: /\bsubprocess\b/ },
  { capability: "execute_code", pattern: "os.system", regex: /\bos\.system\b/ },
  { capability: "execute_code", pattern: "eval(", regex: /\beval\s*\(/ },
  { capability: "execute_code", pattern: "new Function(", regex: /\bnew\s+Function\s*\(/ },
  { capability: "read_file", pattern: "fs.readFile", regex: /\bfs\.readFile\b/ },
  { capability: "read_file", pattern: "readFileSync", regex: /\breadFileSync\b/ },
  { capability: "read_file", pattern: "open(", regex: /\bopen\s*\(/ },
  { capability: "read_file", pattern: "cat ", regex: /(^|\s)cat\s+/ },
  { capability: "write_file", pattern: "fs.writeFile", regex: /\bfs\.writeFile\b/ },
  { capability: "write_file", pattern: "writeFileSync", regex: /\bwriteFileSync\b/ },
  { capability: "write_file", pattern: "open(..., \"w\")", regex: /\bopen\s*\([^)]*,\s*["'][wa+]+["']/ },
  { capability: "write_file", pattern: "echo ... >", regex: /(^|\s)echo\s+.+>/ },
  { capability: "credential_access", pattern: "process.env", regex: /\bprocess\.env\b/ },
  { capability: "credential_access", pattern: "os.environ", regex: /\bos\.environ\b/ },
  { capability: "credential_access", pattern: "API_KEY", regex: /\bAPI_KEY\b/i },
  { capability: "credential_access", pattern: "TOKEN", regex: /\bTOKEN\b/i },
  { capability: "credential_access", pattern: "SECRET", regex: /\bSECRET\b/i },
  { capability: "credential_access", pattern: "PASSWORD", regex: /\bPASSWORD\b/i },
  { capability: "credential_access", pattern: "PRIVATE_KEY", regex: /\bPRIVATE_KEY\b/i },
  { capability: "credential_access", pattern: "DATABASE_URL", regex: /\bDATABASE_URL\b/i },
  { capability: "credential_access", pattern: "STRIPE_SECRET_KEY", regex: /\bSTRIPE_SECRET_KEY\b/i },
  { capability: "credential_access", pattern: "GITHUB_TOKEN", regex: /\bGITHUB_TOKEN\b/i },
  { capability: "payment", pattern: "stripe.", regex: /\bstripe\./i },
  { capability: "payment", pattern: "refund", regex: /\brefund\b/i },
  { capability: "payment", pattern: "charge", regex: /\bcharge\b/i },
  { capability: "payment", pattern: "payment", regex: /\bpayment\b/i },
  { capability: "payment", pattern: "checkout", regex: /\bcheckout\b/i },
  { capability: "payment", pattern: "invoice", regex: /\binvoice\b/i },
  { capability: "payment", pattern: "subscription", regex: /\bsubscription\b/i },
  { capability: "order_placement", pattern: "order", regex: /\border\b/i },
  { capability: "order_placement", pattern: "purchase", regex: /\bpurchase\b/i }
];

export const skillInstructionPatterns: CapabilityPattern[] = [
  { capability: "external_send", pattern: "send to", regex: /\bsend to\b/i },
  { capability: "external_send", pattern: "upload to", regex: /\bupload to\b/i },
  { capability: "external_send", pattern: "post to", regex: /\bpost to\b/i },
  { capability: "external_send", pattern: "call api", regex: /\bcall api\b/i },
  { capability: "external_send", pattern: "webhook", regex: /\bwebhook\b/i },
  { capability: "external_send", pattern: "external service", regex: /\bexternal service\b/i },
  { capability: "execute_code", pattern: "run script", regex: /\brun script\b/i },
  { capability: "execute_code", pattern: "execute", regex: /\bexecute\b/i },
  { capability: "execute_code", pattern: "shell", regex: /\bshell\b/i },
  { capability: "execute_code", pattern: "terminal", regex: /\bterminal\b/i },
  { capability: "execute_code", pattern: "command", regex: /\bcommand\b/i },
  { capability: "approval_bypass", pattern: "do not ask", regex: /\bdo not ask\b/i },
  { capability: "approval_bypass", pattern: "without asking", regex: /\bwithout asking\b/i },
  { capability: "approval_bypass", pattern: "automatically approve", regex: /\bautomatically approve\b/i },
  { capability: "approval_bypass", pattern: "auto approve", regex: /\bauto approve\b/i },
  { capability: "approval_bypass", pattern: "do not request confirmation", regex: /\bdo not request confirmation\b/i },
  { capability: "agent_delegation", pattern: "delegate", regex: /\bdelegate\b/i },
  { capability: "agent_delegation", pattern: "subagent", regex: /\bsubagent\b/i },
  { capability: "agent_delegation", pattern: "another agent", regex: /\banother agent\b/i },
  { capability: "agent_delegation", pattern: "handoff", regex: /\bhandoff\b/i },
  { capability: "payment", pattern: "payment", regex: /\bpayment\b/i },
  { capability: "payment", pattern: "checkout", regex: /\bcheckout\b/i },
  { capability: "payment", pattern: "refund", regex: /\brefund\b/i },
  { capability: "order_placement", pattern: "order", regex: /\border\b/i },
  { capability: "order_placement", pattern: "purchase", regex: /\bpurchase\b/i }
];

export const scriptFilePattern = "**/scripts/**/*.{py,js,ts,sh}";

export const mcpConfigFiles = [
  ".mcp.json",
  "mcp.json",
  "claude_desktop_config.json",
  ".cursor/mcp.json",
  ".vscode/mcp.json"
];
