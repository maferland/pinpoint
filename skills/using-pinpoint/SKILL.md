---
name: using-pinpoint
description: Use when reviewing UI visually, getting design feedback, or when the user wants to annotate screenshots. Triggers on "review this page", "what's wrong with this UI", "annotate", "visual feedback", screenshot review workflows, or after making UI changes that need verification.
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

### 2. Invoke pinpoint via Bash — DO NOT just emit `/pinpoint-review` as text

Plain text like `/pinpoint-review /tmp/foo.png` is just text — it doesn't run anything. To actually open the annotation UI you must call the `pinpoint` CLI through the Bash tool:

```
Bash(command="pinpoint review /tmp/screenshot.png --context 'Login page after auth changes — suspect spacing bug under .form-row'")
```

Multiple images:

```
Bash(command="pinpoint review /tmp/before.png /tmp/after.png --context '...'")
```

The Bash call:
- prints the URL on stderr and opens the user's browser
- blocks until the user clicks **Done** in the browser
- prints the structured annotations as JSON on stdout

Always pass `--context` — it shows in the toolbar and orients the user.

The user can also invoke the slash command `/pinpoint-review <image>...` themselves; the slash command is just a thin wrapper around the same CLI.

### 3. Track every annotation as a task — BEFORE fixing anything

The moment the JSON returns with annotations, your **first** action is to call `TaskCreate` with one task per annotation. Use the annotation number + comment as the task title (e.g. `#3: tag gap sucks, let's fix`). Then work them one at a time — mark `in_progress` when you start, `completed` when you finish.

Why this is mandatory:
- Past sessions have silently skipped findings about "surrounding page chrome" while addressing the in-card issues, because the model batched fixes and lost track. A task list makes the skip visible.
- The user reads the diff against the task list, not against the original pinpoint output.

A `PostToolUse` hook bundled with the plugin will inject a reminder when annotations come back. Don't wait for it — task-list as soon as you see the JSON.

### 4. Read the returned JSON and act

stdout looks like:

```json
{
  "context": "Login page after auth changes",
  "images": [{ "path": "/tmp/screenshot.png", "width": 1440, "height": 900 }],
  "annotations": [
    {
      "number": 1,
      "image": "/tmp/screenshot.png",
      "imageIndex": 0,
      "pin": { "x": 60.0, "y": 80.1 },
      "box": { "x": 60.0, "y": 80.1, "width": 12.0, "height": 5.0 },
      "comment": "Footer spacing too tight"
    }
  ]
}
```

Each annotation has:
- **number** — order placed
- **image** — absolute path to the image
- **pin** + optional **box** — position as percentages (0–100) of image dimensions
- **comment** — the user's feedback

Classify intent (bug, change request, question, approval) yourself from the comment text. There's no severity field — judge urgency from wording.

### 5. Fix and iterate

After every task on the list is `completed`, capture a fresh screenshot and call `pinpoint review` again. Repeat until the user closes the loop without new annotations.

## MCP fallback

There's also an MCP server (registered as `pinpoint`) exposing `create_review`, `add_image`, `get_annotations`, `list_reviews` — useful for non-interactive scripting. The CLI is the recommended path; only reach for MCP if you need to programmatically build a review without user interaction.

## Tips

- Always provide `--context` — it shows in the toolbar and helps the user orient
- Coordinates are percentages — resolution-independent
- The user can switch dark/light theme in the toolbar
- The "Auto-close" preference is persisted across sessions in `~/.pinpoint/preferences.json`
- Box-drag covers a region; click drops a pin at one point

## Do NOT

- Don't emit `/pinpoint-review …` as plain text expecting it to run — it won't. Call `Bash(pinpoint review …)` instead.
- Don't add preamble around the call ("Click Done in the browser when finished") — the user knows the flow
- Don't tell the user to type "done" — clicking Done in the UI handles the handoff
- Don't try to call MCP tools mid-review — the Bash call blocks until Done
- Don't guess what the user sees — let them annotate
