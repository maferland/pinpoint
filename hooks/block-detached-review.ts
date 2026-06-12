#!/usr/bin/env bun
// PreToolUse hook: deny `pinpoint review` invocations that detach with `&`,
// `nohup`, or `disown`. Those throw away the stdout JSON the agent needs.

interface HookInput { tool_name?: string; tool_input?: { command?: string; run_in_background?: boolean } }

const raw = await Bun.stdin.text();
let input: HookInput = {};
try { input = JSON.parse(raw); } catch {}
if (input.tool_name !== "Bash") process.exit(0);

// The Bash tool's run_in_background captures stdout — JSON is not lost.
if (input.tool_input?.run_in_background) process.exit(0);

// Strip quoted spans so `pinpoint review` inside a string argument doesn't
// count. Replace `&&` / `||` so only standalone `&` survives.
const cmd = (input.tool_input?.command ?? "")
  .replace(/'[^']*'/g, "''")
  .replace(/"(?:[^"\\]|\\.)*"/g, '""')
  .replace(/&&|\|\|/g, "  ");

const invokes = /\bpinpoint\s+review\b/.test(cmd);
const detaches = /&|\bnohup\b|\bdisown\b/.test(cmd);
if (!invokes || !detaches) process.exit(0);

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: [
      "Refusing to run `pinpoint review` detached.",
      "",
      "The CLI prints annotations as JSON on stdout when the user clicks Done. Detaching with `&`, `nohup`, or `disown` throws that output away.",
      "",
      "Use the foreground (blocks until Done) or the Bash tool's `run_in_background: true` parameter (notifies on completion, read stdout via BashOutput).",
    ].join("\n"),
  },
}));
