#!/usr/bin/env bun
// PreToolUse hook: block `pinpoint review` invocations that detach with `&`,
// `nohup`, or `disown` — those throw away stdout, so Claude never sees the
// JSON when the user clicks Done. Past sessions repeatedly spawned the CLI
// this way and then forgot to read the result.
//
// Valid patterns:
//   - Foreground Bash call (default) — blocks until Done, JSON returns in stdout.
//   - Bash with `run_in_background: true` — Claude is notified on completion
//     and reads stdout via BashOutput. Command string has no `&`, so this hook
//     doesn't fire.

interface ToolInput { command?: string }
interface HookInput { tool_name?: string; tool_input?: ToolInput }

const raw = await Bun.stdin.text();
let input: HookInput;
try { input = JSON.parse(raw); } catch { process.exit(0); }

if (input.tool_name !== "Bash") process.exit(0);

const cmd = input.tool_input?.command ?? "";
if (!/\bpinpoint\s+review\b/.test(cmd)) process.exit(0);

// Detect shell-detached forms. The CLI's stdout JSON is the whole point —
// any of these throw it away.
//
// Backgrounding `&` is a standalone token: preceded by something other than
// `&` (to avoid `&&`), and either ends the command or is followed by another
// statement separator / token. zsh `&!` and `&|` also detach.
const trimmed = cmd.trim();
const detached =
  /[^&]&\s*$/.test(trimmed) ||                 // trailing &
  /^&\s*$/.test(trimmed) ||                    // (unlikely) lone &
  /[^&]&\s*[;\n]/.test(cmd) ||                 // & ; next-stmt
  /[^&]&\s+\S/.test(cmd) ||                    // & next-token (e.g. & echo)
  /\bnohup\b/.test(cmd) ||                     // nohup pinpoint review ...
  /\bdisown\b/.test(cmd) ||                    // ... ; disown
  /&!\s*$/.test(trimmed) ||                    // zsh &!
  /&\|\s*$/.test(trimmed);                     // zsh &|

if (!detached) process.exit(0);

const reason = [
  `Refusing to run \`pinpoint review\` detached.`,
  ``,
  `The CLI prints the user's annotations as JSON on stdout when they click Done. Detaching with \`&\` / \`nohup\` / \`disown\` throws that output away — past sessions spawned it this way and then forgot to read the result.`,
  ``,
  `Use one of:`,
  `  1. Foreground Bash call — blocks until Done, JSON returns directly.`,
  `  2. Bash with \`run_in_background: true\` (the tool parameter, not shell \`&\`) — the harness notifies you on completion and you read stdout via BashOutput.`,
].join("\n");

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: reason,
  },
}));
