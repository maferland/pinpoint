# Reddit posts

Two versions: one for r/ClaudeAI (Claude-specific audience), one for r/ChatGPTPro / r/LocalLLaMA (broader, MCP-curious audience).

---

## r/ClaudeAI

**Title:** I built a slash command for visual feedback. You click on a screenshot, Claude fixes what you clicked.

I've been working on a tool called Pinpoint for a few months. The motivation was simple: when Claude generates UI code and something's off, describing it in text is slow and lossy. "The button on the right is misaligned" is fine. "The CTA's padding has 4px more on the right than the left, and the heading inside it sits 2px below the baseline of the body text" is what you actually need to say, and nobody types that.

Pinpoint replaces that with a slash command. You run `/pinpoint:review /tmp/screenshot.png`, the browser opens, you click where the problem is, type a comment, hit Send. Claude gets the coordinates as percentages plus your comment, and acts on each one as a discrete task.

What I just shipped in v0.6.0 is portable sessions. A review packages into a `.pinpoint.zip` (manifest plus raw image bytes). You can hand it to a designer or PM, they open it locally (no Claude account needed), add their pins, send it back. Then you import and Claude sees both sets.

Install:

```
curl -fsSL https://raw.githubusercontent.com/maferland/pinpoint/main/install.sh | bash
```

After install you can poke the UI without taking your own screenshot:

```
pinpoint open assets/demo.pinpoint.zip
```

Repo: https://github.com/maferland/pinpoint

MIT, built with TypeScript + Bun + React. Built on the same architecture pattern as Plannotator (slash command → CLI binary → blocking stdout). Happy to answer questions about how the loop works or why I made certain trade-offs.

---

## r/ChatGPTPro or r/LocalLLaMA (broader, MCP-focused)

**Title:** Pinpoint — visual annotation via MCP, works with any agent that speaks the protocol

If you've ever wanted your coding agent to act on visual feedback instead of prose ("the button is misaligned" vs "the second item in the grid has 8px too much padding on the right"), Pinpoint might be useful.

It exposes an MCP server with four tools:

- `create_review` — opens a browser UI, returns a session id
- `add_image` — append another screenshot to an existing review
- `get_annotations` — read the structured feedback back
- `list_reviews` — list active sessions

The agent calls `create_review`, the browser opens for the user, the user pins/boxes regions and adds comments, the agent reads `get_annotations` and acts on each one. Coordinates are percentages so they're resolution-independent.

What's new in v0.6.0: a session exports to a `.pinpoint.zip` you can share. The recipient doesn't need to use the same agent. They just need Pinpoint installed.

I've tested it with Claude Code (slash command wrapper) and the MCP server should work with any MCP-capable agent. If you wire it up to Cursor, Aider, or anything else, I'd love to hear how it goes.

Repo: https://github.com/maferland/pinpoint

## Notes for posting

- Reddit dislikes self-promotion. Lead with the problem, not the product. The first paragraph should make someone nod before they see a link.
- Check each subreddit's self-promo rules. r/ClaudeAI is pretty open. r/LocalLLaMA is stricter; frame it as "tool that uses MCP" rather than "my project."
- Reply in the comments to every question for the first 24 hours. The algorithm rewards engagement.
- If someone asks about privacy / what it sends where: the server is fully local, no telemetry, screenshots never leave your machine unless you export and share the zip yourself.
