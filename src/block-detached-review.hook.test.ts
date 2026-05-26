import { describe, expect, test } from "bun:test";
import { spawn } from "bun";

const HOOK = `${import.meta.dir}/../hooks/block-detached-review.ts`;

async function runHook(input: unknown): Promise<{ stdout: string; exitCode: number }> {
  const proc = spawn(["bun", HOOK], { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
  proc.stdin.write(JSON.stringify(input));
  await proc.stdin.end();
  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  return { stdout, exitCode };
}

function denyReason(stdout: string): string | null {
  if (!stdout.trim()) return null;
  const parsed = JSON.parse(stdout);
  if (parsed?.hookSpecificOutput?.permissionDecision !== "deny") return null;
  return parsed.hookSpecificOutput.permissionDecisionReason;
}

describe("block-detached-review hook", () => {
  describe.each([
    ["trailing &", "pinpoint review /tmp/foo.png --context test &"],
    ["nohup prefix", "nohup pinpoint review /tmp/foo.png"],
    ["disown suffix", "pinpoint review /tmp/foo.png ; disown"],
    ["zsh &!", "pinpoint review /tmp/foo.png &!"],
    ["& with stmt after", "pinpoint review /tmp/foo.png & echo done"],
    ["& with redirects", "pinpoint review /tmp/foo.png >/dev/null 2>&1 &"],
  ])("denies %s", (_, command) => {
    test("emits deny decision with helpful reason", async () => {
      const { stdout } = await runHook({ tool_name: "Bash", tool_input: { command } });
      const reason = denyReason(stdout);
      expect(reason).not.toBeNull();
      expect(reason).toContain("run_in_background");
    });
  });

  describe.each([
    ["foreground review", "pinpoint review /tmp/foo.png"],
    ["foreground with context", "pinpoint review /tmp/a.png /tmp/b.png --context 'x'"],
    ["unrelated bash", "ls -la"],
    ["unrelated background", "sleep 5 &"],
    ["pinpoint export (no review)", "pinpoint export abc123 &"],
    ["review mentioned in double-quoted arg", `gh release edit v0.8.0 --notes "blocks \`pinpoint review\` with trailing \`&\` now"`],
    ["review mentioned in single-quoted arg", `echo 'pinpoint review needs foreground &'`],
    ["non-Bash tool", null],
  ])("allows %s", (label, command) => {
    test("emits no deny decision", async () => {
      const input =
        label === "non-Bash tool"
          ? { tool_name: "Read", tool_input: { file_path: "/tmp/x" } }
          : { tool_name: "Bash", tool_input: { command } };
      const { stdout } = await runHook(input);
      expect(denyReason(stdout)).toBeNull();
    });
  });

  test("invalid JSON input exits cleanly without denying", async () => {
    const proc = spawn(["bun", HOOK], { stdin: "pipe", stdout: "pipe" });
    proc.stdin.write("not json");
    await proc.stdin.end();
    const stdout = await new Response(proc.stdout).text();
    await proc.exited;
    expect(denyReason(stdout)).toBeNull();
  });
});
