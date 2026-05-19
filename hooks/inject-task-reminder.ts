#!/usr/bin/env bun
// PostToolUse hook: after a `pinpoint review` Bash call returns N annotations,
// emit a system-reminder telling Claude to TaskCreate one task per annotation
// before doing anything else. Past sessions silently skipped findings #1/#2
// when batching fixes — tracked tasks make that visible.

interface ToolInput { command?: string }
interface ToolResponse { stdout?: string; exitCode?: number }
interface HookInput { tool_name?: string; tool_input?: ToolInput; tool_response?: ToolResponse }

const raw = await Bun.stdin.text();
let input: HookInput;
try { input = JSON.parse(raw); } catch { process.exit(0); }

if (input.tool_name !== "Bash") process.exit(0);

const cmd = input.tool_input?.command ?? "";
if (!cmd.includes("pinpoint review")) process.exit(0);

const stdout = input.tool_response?.stdout ?? "";
let count = 0;
try {
  const parsed = JSON.parse(stdout);
  if (Array.isArray(parsed?.annotations)) count = parsed.annotations.length;
} catch { /* not JSON — review may have errored out */ }

if (count === 0) process.exit(0);

const plural = count === 1 ? "annotation" : "annotations";
const additionalContext = [
  `Pinpoint returned ${count} ${plural}.`,
  ``,
  `Before any other tool call, create ONE TaskCreate task per annotation (use the comment as the task title, prefix with the annotation number). Then work through them one at a time — mark each task in_progress when you start it, completed when you finish.`,
  ``,
  `Do NOT batch fixes across annotations without tracked tasks. Past sessions skipped findings (e.g. items about page chrome) when "addressing them all in one pass" — a task list catches that.`,
].join("\n");

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext,
  },
}));
