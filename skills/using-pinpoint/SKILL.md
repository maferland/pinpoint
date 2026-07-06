---
name: using-pinpoint
description: This skill should be used when reviewing UI visually, getting design feedback, or annotating screenshots. Triggers on phrases like "review this page", "what's wrong with this UI", "annotate", "visual feedback", screenshot review workflows, or after making UI changes that need verification.
---

# Pinpoint — Visual Annotation CLI

Pinpoint lets the user annotate screenshots in their browser and returns structured feedback for you to act on.

## When to Use

- After making UI/CSS/layout changes — let the user verify visually
- When the user says "review this", "check this page", "what do you think of the UI"
- When you need precise visual feedback (not just "the button looks off")
- For design review workflows — compare before/after screenshots
- When debugging visual bugs — user points at exactly what's wrong

## Workflow

### 1. Capture a screenshot

Use whatever screenshot tool fits the platform:

```bash
# Chrome DevTools MCP
mcp__chrome-devtools__take_screenshot --filePath /tmp/screenshot.png

# Playwright MCP
mcp__playwright__browser_take_screenshot --path /tmp/screenshot.png

# macOS native
screencapture -x /tmp/screenshot.png

# iOS Simulator
xcrun simctl io booted screenshot /tmp/screenshot.png
```

### 2. Invoke pinpoint via Bash — DO NOT just emit `/pinpoint:review` as text

Plain text like `/pinpoint:review /tmp/foo.png` is just text — it doesn't run anything. To actually open the annotation UI you must call the `pinpoint` CLI through the Bash tool.

`--context` is JSON, not a bare string. Before invoking, gather what you already have on hand — you're almost always mid-task when you call this, so this information is cheap:
- `message` (required) — what changed and what you want checked
- `path` — the file you just edited (you know this; you were just in it)
- `branch` — one `git branch --show-current` call
- `url` — the dev server URL, if the change is web-facing

Run it as a shell command through the Bash tool (the JSON's double quotes are already protected by the outer single quotes — no backslash-escaping needed):

```bash
pinpoint review /tmp/screenshot.png --context '{"message":"Login page after auth changes — suspect spacing bug under .form-row","url":"http://localhost:3000/login","path":"src/pages/login.tsx","branch":"maferland/auth-fix"}'
```

Only fall back to a plain string (shown as the message, no metadata row) when you genuinely have nothing beyond the message — e.g. reviewing a screenshot the user handed you with no associated file:

```
Bash(command="pinpoint review /tmp/screenshot.png --context 'User-provided mockup — no source file to reference'")
```

Before/after comparison pairs (`--pair before after`, repeatable) mixed freely with standalone images — same `--context` rules apply:

```bash
pinpoint review --pair /tmp/before.png /tmp/after.png --context '{"message":"Button spacing fix","path":"src/components/Button.tsx","branch":"maferland/button-spacing"}'
```

```bash
pinpoint review --pair /tmp/before.png /tmp/after.png --pair /tmp/old.png /tmp/new.png /tmp/extra.png --context '{"message":"Two comparisons + a standalone"}'
```

Each `--pair` opens a side-by-side Before/After pane; standalone positional args use the normal single-image canvas. All slots share one thumbnail strip; arrow keys navigate between them.

Multiple standalone images without comparison:

```bash
pinpoint review /tmp/step1.png /tmp/step2.png /tmp/step3.png --context '{"message":"...","path":"..."}'
```

The Bash call:
- prints the URL on stderr and opens the user's browser
- blocks until the user hits **Send** in the toolbar
- prints the structured annotations as JSON on stdout

Always pass `--context` — it shows in the toolbar and, when given as JSON, populates the "From your agent" card in the comments rail with clickable/labeled metadata (`url`, `path`, `branch`) instead of just a sentence. That metadata is what lets the user act on the review without re-asking you where the change lives.

Supported fields: `message` (required — the actual context), `url`, `path`, `branch` (all optional).

**Never detach the call.** No trailing `&`, no `nohup`, no `disown`. The CLI's stdout JSON is the whole point — detaching throws it away, the user clicks Send, and you never see the annotations. A `PreToolUse` hook will hard-block detached invocations.

If you need to do other work while the user annotates, use the Bash tool's `run_in_background: true` parameter (not shell `&`). The harness notifies you when it completes and you read stdout via `BashOutput`.

The user can also invoke the slash command `/pinpoint:review <image>...` themselves; the slash command is just a thin wrapper around the same CLI.

### 3. Track every annotation as a task — BEFORE fixing anything

The moment the JSON returns with annotations, your **first** action is to call `TaskCreate` with one task per annotation. Use the annotation number + comment as the task title (e.g. `#3: tag gap sucks, let's fix`). Then work them one at a time — mark `in_progress` when you start, `completed` when you finish.

Why this is mandatory:
- Past sessions have silently skipped findings about "surrounding page chrome" while addressing the in-card issues, because the model batched fixes and lost track. A task list makes the skip visible.
- The user reads the diff against the task list, not against the original pinpoint output.

A `PostToolUse` hook bundled with the plugin will inject a reminder when annotations come back. Don't wait for it — task-list as soon as you see the JSON.

### 4. Read the returned JSON and act

All modes return the same shape. `mode` is `"review"` (all standalone), `"compare"` (all pairs), or `"mixed"` (both):

```json
{
  "mode": "mixed",
  "context": "Two comparisons + a standalone",
  "slots": [
    { "type": "compare", "before": { "path": "/tmp/before.png", "width": 1440, "height": 900 }, "after": { "path": "/tmp/after.png", "width": 1440, "height": 900 } },
    { "type": "single",  "image":  { "path": "/tmp/extra.png",  "width": 1440, "height": 900 } }
  ],
  "images": [ ... ],
  "annotations": [
    {
      "number": 1,
      "image": "/tmp/before.png",
      "imageIndex": 0,
      "slotIndex": 0,
      "side": "before",
      "pin": { "x": 45.0, "y": 32.1 },
      "box": { "x": 45.0, "y": 32.1, "width": 6.0, "height": 6.0 },
      "comment": "Button too small here"
    }
  ]
}
```

Each annotation has:
- **number** — order placed
- **image** — absolute path to the annotated image
- **slotIndex** — which slot (thumbnail) the pin belongs to
- **side** — `"before"` or `"after"` on compare slots; absent on single slots
- **pin** + optional **box** — position as percentages (0–100) of image dimensions
- **comment** — the user's feedback

Classify intent (bug, change request, question, approval) yourself from the comment text. There's no severity field — judge urgency from wording.

### 5. Fix and iterate

After every task on the list is `completed`, capture a fresh screenshot and call `pinpoint review` again. Repeat until the user closes the loop without new annotations.

## Sharing a session

Pinpoint sessions can be packaged into a `.pinpoint.zip` (a real zip with `review.json` + raw image bytes inside) for handoff to another person. The user does the human-side work (clicking, emailing the file); your job is to run the CLI on either end.

**The user hands you a `.pinpoint.zip` (or asks you to open one):**

```
Bash(command="pinpoint open path/to/bundle.pinpoint.zip")
```

Behaves like `pinpoint review` — opens the annotator, blocks until the user hits Send in the toolbar, prints JSON. Follow the same workflow as §3 above: the moment annotations come back, task-list them before fixing anything.

If the bundle's review id collides with one already on disk, pass `--mode`:
- `replace` — incoming wins (use when the file is the new source of truth)
- `append` — keep local annotations, add the bundle's with renumbered ids (parallel annotation)
- `new` — generate a fresh local id, leave the old review untouched

Without `--mode`, the CLI prompts in a TTY or exits 2 in non-interactive contexts. With no collision, `replace` is implied — safe default.

**The user wants to export their current session to send to someone else:**

Tell them about the ⬇ download button in the toolbar (it's the fastest path). If they prefer the command line:

```
Bash(command="pinpoint export <reviewId>")   # writes <reviewId>.pinpoint.zip in cwd
```

The review id is the trailing path segment of the annotator URL (`/review/<id>`).

## MCP fallback

There's also an MCP server (registered as `pinpoint`) exposing `create_review`, `add_image`, `get_annotations`, `list_reviews` — useful for non-interactive scripting. The CLI is the recommended path; only reach for MCP if you need to programmatically build a review without user interaction.

## Tips

- `--context` format is covered in step 2 — default to JSON, not a bare string
- Coordinates are percentages — resolution-independent
- The user can switch dark/light theme in the toolbar
- The "Auto-close" preference is persisted across sessions in `~/.pinpoint/preferences.json`
- Box-drag covers a region; click drops a pin at one point

## Do NOT

- Don't emit `/pinpoint:review …` as plain text expecting it to run — it won't. Call `Bash(pinpoint review …)` instead.
- Don't detach with `&`, `nohup`, or `disown` — stdout is the JSON you need; detaching throws it away. Use foreground or `run_in_background: true`.
- Don't add preamble around the call ("Click the Send button when finished") — the user knows the flow
- Don't tell the user to type "done" — hitting the Send button (labeled "Looks good" or "Send N comments") handles the handoff
- Don't try to call MCP tools mid-review — the Bash call blocks until the user submits
- Don't guess what the user sees — let them annotate
