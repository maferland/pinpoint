<div align="center">

<img src="assets/icon.png" width="128" height="128" alt="Pinpoint">

<h1>Pinpoint</h1>

<p>Point at what's wrong. Claude fixes it.</p>

</div>

---

<p align="center">
  <img src="assets/screenshot-light.png" width="720" alt="Pinpoint annotation UI">
</p>

<!-- TODO: replace screenshot above with a short GIF of the full loop:
     screenshot → pin → comment → Done → Claude applies the fix. -->

Annotate any screenshot in your browser. Click to drop pins, drag to draw boxes, type comments. Send the session back to your coding agent, or export it as a `.pinpoint.zip` and hand it to a designer, a PM, or another reviewer. They open it, add their pins, send it back. No shared tooling required.

Pinpoint works with any visual surface: web pages, iOS simulators, macOS apps, Storybook, design mockups. No target app modification needed.

## Try it in one command

```bash
pinpoint open assets/demo.pinpoint.zip
```

A sample session opens in your browser with a few starter pins on a real screenshot. Edit them, draw your own, click **Done** to see the structured JSON.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/maferland/pinpoint/main/install.sh | bash
```

<details>
<summary>Manual install</summary>

```bash
git clone https://github.com/maferland/pinpoint.git ~/.pinpoint
cd ~/.pinpoint && bun install && bun run build
bun link                                                          # exposes `pinpoint` on PATH
claude plugin marketplace add ~/.pinpoint                         # registers the slash command (Claude Code only)
claude plugin install pinpoint@pinpoint-marketplace
claude mcp add pinpoint -- bun ~/.pinpoint/src/main.ts --stdio    # MCP server, works with any MCP-capable agent
```
</details>

Requires [Bun](https://bun.sh) 1.2+.

## Use it with your agent

Pinpoint speaks two protocols. Pick the one your agent supports.

### Claude Code: slash command

```
/pinpoint-review /tmp/screenshot.png
```

The browser opens, you annotate, click **Done**, the structured JSON lands in the conversation.

### Anywhere with MCP: Cursor, Aider, Continue, raw API, etc.

Register the MCP server once (`claude mcp add pinpoint -- ...` above, or your agent's equivalent), then the agent gets four tools:

| Tool | Description |
|------|-------------|
| `create_review` | Create a review and open the browser. |
| `add_image` | Add another screenshot to an existing review. |
| `get_annotations` | Read structured feedback — coordinates and comments. |
| `list_reviews` | List all review sessions. |

### Anywhere with a shell: direct CLI

```
pinpoint review <image>... [--context "..."] [--port N]
```

Spawns the annotation server, opens the browser, blocks until you click **Done**, prints the structured JSON to stdout. Pipe it wherever you want.

## How the annotation UI works

- **Click** anywhere → drops a pin with a highlight box
- **Drag** → draws a rectangular region
- **Click a pin** → popover with a textarea, type your note
- **⌘Enter** saves, **Esc** cancels
- Multiple screenshots → filmstrip with arrow keys to switch
- **Done** in the toolbar → sends annotations back, closes the loop

What Pinpoint sends back:

```json
{
  "annotations": [
    {
      "number": 1,
      "image": "/tmp/screenshot.png",
      "box": { "x": 10.2, "y": 5.3, "width": 35.0, "height": 12.5 },
      "comment": "Button text is truncated on mobile"
    }
  ]
}
```

Coordinates are percentages, so they're resolution-independent.

## Sharing a session

A review packages into a `.pinpoint.zip` (review manifest plus the raw image bytes). Open it on any machine that has Pinpoint installed.

```bash
pinpoint export <reviewId>                            # writes <reviewId>.pinpoint.zip
pinpoint open path/to/bundle.pinpoint.zip             # someone hands you a session
pinpoint open path/to/bundle.pinpoint.zip --mode new  # keep your local copy untouched
```

The ⬇ button in the toolbar exports the live session straight to your downloads folder. See [the skill docs](skills/using-pinpoint/SKILL.md) for the full flow.

## What's new

See [CHANGELOG.md](CHANGELOG.md). Current version: v0.6.0.

## Credits

Architecture inspired by [plannotator](https://github.com/backnotprop/plannotator): slash command shells out to a CLI binary, blocks until the user signals done, pipes structured stdout back into the conversation. Pinpoint applies that pattern to image annotation, and adds a portable session format on top.

## License

[MIT](LICENSE)
