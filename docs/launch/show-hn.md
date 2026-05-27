# Show HN draft

## Title options (pick one)

- **Show HN: Pinpoint – click-to-annotate screenshots for your coding agent**
- **Show HN: Pinpoint – portable visual feedback sessions for AI coding agents**
- **Show HN: Annotate a screenshot, send the .zip, get it back with pins**

(I'd go with the third. Most specific, most novel-mechanism, most likely to get clicks from people who don't yet care about AI coding tools.)

## Body

Hi HN,

When I'm working with Claude Code on UI changes, I spend a lot of time describing what's wrong in prose. "The second card in the grid has the wrong padding, looks like maybe 4px too much on the right, and the heading inside it is misaligned with the body text." It's slow, and I'm not always right about what I'm seeing.

Pinpoint replaces that prose with pins and boxes on a screenshot. You run a slash command, your browser opens, you click where the problem is, type a comment, hit Send. The agent gets back structured JSON with coordinates as percentages and your comment. Then it fixes it. The whole round-trip is usually under a minute.

The mechanism is borrowed from Plannotator: a slash command shells out to a CLI binary, the CLI blocks until you signal done, the agent picks up structured stdout. What's new is that visual review is now a first-class step in the loop, and the session is portable.

That portability is the part I'm proudest of. A review packages into a `.pinpoint.zip` — manifest plus raw image bytes. You can hand it to a designer, a PM, anyone. They open it locally, add their pins, send it back. You re-import. None of that requires them to install the same agent you're using, or set up the same project, or even know what MCP is.

Two ways to use it:

1. Claude Code slash command. `/pinpoint:review /tmp/screenshot.png`. Easiest if you're already in that ecosystem.
2. MCP server. Works with any MCP-capable agent (Cursor, Aider, raw API, anything that speaks MCP). Same browser UI, same return shape.

There's also a `pinpoint open assets/demo.pinpoint.zip` you can run right after install to see the UI without taking your own screenshot first.

Repo: https://github.com/maferland/pinpoint
v0.6.0 is the export/import release.

Built in TypeScript + Bun + React. CLI bundles to ~750KB. MIT licensed. Happy to answer anything.

## Notes for posting

- Post Tuesday or Wednesday, between 7-10am Pacific. Avoid Mondays (busy) and Fridays (dead).
- First comment should be a screenshot or short GIF. HN allows image links in comments; people scroll comments more than they scroll the original post.
- If someone asks about the security model of running a local HTTP server on `localhost:4747`, the answer is the same as VS Code's localhost servers, dev servers, anything that binds locally. Mention `--port 0` for random port if they care.
- If someone asks "why not just describe the screenshot in text", be honest: you can, and for simple stuff it works fine. Pinpoint pays off when the problem is hard to describe in prose, or when you're handing the session to someone who isn't using the same agent.
- Don't oversell. People will downvote a launch that reads like marketing.
