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
  { capability: "payment", pattern: "stripe.", regex: /\bstripe\.\w/i },
  { capability: "payment", pattern: "stripe import", regex: /\bfrom\s+["']stripe["']/i },
  { capability: "payment", pattern: "process_payment(", regex: /\bprocess[_-]?payment\s*\(/i },
  { capability: "payment", pattern: "charge customer", regex: /\bcharge[_-]?(card|customer|payment)\s*\(/i },
  { capability: "payment", pattern: "issue refund", regex: /\b(issue|process|create)[_-]?refund\s*\(/i },
  { capability: "payment", pattern: "mode: payment", regex: /mode\s*[:=]\s*["']payment["']/i },
  { capability: "payment", pattern: "payments.create", regex: /\bpayments?\.\w*create\b/i },
  { capability: "payment", pattern: "checkout.sessions", regex: /\bcheckout\.\w*sessions?\b/i },
  { capability: "order_placement", pattern: "placeOrder(", regex: /\bplace[_-]?order\s*\(/i },
  { capability: "order_placement", pattern: "submitOrder(", regex: /\bsubmit[_-]?order\s*\(/i },
  { capability: "order_placement", pattern: "createOrder(", regex: /\bcreate[_-]?order\s*\(/i }
];

export const skillInstructionPatterns: CapabilityPattern[] = [
  { capability: "external_send", pattern: "send to", regex: /\bsend (it |the .+? )?to\s+(http|an? |the )/i },
  { capability: "external_send", pattern: "upload to", regex: /\bupload\s+(it|the\s+\w+|file|invoice|data|payload|results?)\s+to\b/i },
  { capability: "external_send", pattern: "post to", regex: /\bpost\s+(it|the\s+\w+|data|payload|results?)\s+to\b/i },
  { capability: "external_send", pattern: "call api", regex: /\bcall\s+(an? |the )?api\b/i },
  { capability: "external_send", pattern: "webhook", regex: /\bwebhook\s+(url|endpoint|call)|to\s+(?:a\s+|the\s+)?webhook\b/i },
  { capability: "external_send", pattern: "external service", regex: /\b(?:to|from)\s+(?:an?\s+)?external\s+(?:service|endpoint|api)\b/i },
  { capability: "execute_code", pattern: "run the script", regex: /\brun\s+(?:this|the|a|that)\s+(?:script|command|shell command)\b/i },
  { capability: "execute_code", pattern: "execute the command", regex: /\bexecute\s+(?:this|the|a|that)\s+(?:command|script|shell command|code|binary)\b/i },
  { capability: "execute_code", pattern: "shell out", regex: /\bshell\s+out\b/i },
  { capability: "approval_bypass", pattern: "without asking", regex: /\bwithout\s+(?:asking|confirmation|approval|user\s+consent)\b/i },
  { capability: "approval_bypass", pattern: "automatically approve", regex: /\bautomatically\s+approve\b/i },
  { capability: "approval_bypass", pattern: "auto approve", regex: /\bauto[- ]approve\b/i },
  { capability: "approval_bypass", pattern: "do not ask before", regex: /\bdo\s+not\s+ask\s+(?:before|the\s+user|first|for\s+(?:approval|confirmation|permission))\b/i },
  { capability: "approval_bypass", pattern: "do not request confirmation", regex: /\bdo\s+not\s+request\s+(?:confirmation|approval|permission)\b/i },
  { capability: "agent_delegation", pattern: "delegate to", regex: /\bdelegate\s+(?:this|that|the\s+task|to\s+\w+)\b/i },
  { capability: "agent_delegation", pattern: "spawn agent", regex: /\bspawn\s+(?:an?\s+|the\s+)?(?:sub)?agent\b/i },
  { capability: "agent_delegation", pattern: "handoff to", regex: /\bhand\s*off\s+to\s+(?:an?\s+|the\s+)?(?:other\s+|sub)?agent\b/i },
  { capability: "agent_delegation", pattern: "use another agent", regex: /\buse\s+(?:an|another|the\s+other)\s+agent\b/i },
  { capability: "payment", pattern: "process payment", regex: /\bprocess\s+(?:a\s+|the\s+)?(?:payment|refund|charge)\b/i },
  { capability: "payment", pattern: "issue refund", regex: /\bissue\s+(?:a\s+|the\s+)?refund\b/i },
  { capability: "payment", pattern: "charge customer", regex: /\bcharge\s+(?:the\s+|a\s+)?(?:customer|card|user|\$\d)\b/i },
  { capability: "payment", pattern: "make payment", regex: /\bmake\s+(?:a\s+|the\s+)?payment\b/i },
  { capability: "payment", pattern: "stripe payment", regex: /\bstripe\s+(?:payment|charge|checkout)\b/i },
  { capability: "order_placement", pattern: "place order", regex: /\bplace\s+(?:an?\s+|the\s+)?(?:purchase\s+)?orders?\b/i },
  { capability: "order_placement", pattern: "submit order", regex: /\bsubmit\s+(?:an?\s+|the\s+)?(?:purchase\s+)?orders?\b/i },
  { capability: "order_placement", pattern: "complete purchase", regex: /\b(?:complete|make|finalize)\s+(?:a\s+|the\s+)?purchase\b/i }
];

export const scriptFilePattern = "**/scripts/**/*.{py,js,ts,sh}";

export const mcpConfigFiles = [
  ".mcp.json",
  "mcp.json",
  "claude_desktop_config.json",
  ".cursor/mcp.json",
  ".vscode/mcp.json"
];
