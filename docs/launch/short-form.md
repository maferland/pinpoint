# Short-form copy

For Slack channels, Discord servers, LinkedIn, and anywhere you want a one-paragraph version.

## One-liner (Slack / Discord)

Just shipped v0.6.0 of Pinpoint, a slash command for visual feedback to your coding agent. New in this release: a session exports as a `.pinpoint.zip` you can hand to a designer or PM and re-import with their pins. Works with Claude Code or any MCP-capable agent. https://github.com/maferland/pinpoint

## LinkedIn (slightly more buttoned-up)

Visual feedback for AI coding agents is a missing piece in most workflows. You can describe a UI bug in prose, but it's lossy, slow, and information is lost in both directions.

I built Pinpoint to fix that loop. Slash command opens your browser, you click on a screenshot, type a comment, hit Send. The agent gets structured coordinates and your note. Round-trip is under a minute.

v0.6.0 adds a portable session format. Export a review as a `.pinpoint.zip`, share with anyone, re-import with their annotations. Designers and PMs can participate in the visual review without installing the same agent.

Works with Claude Code (slash command) and any MCP-capable agent (Cursor, Aider, etc.).

https://github.com/maferland/pinpoint

## Internal Slack (Carta or similar work context)

Hey, for anyone doing frontend work with AI agents, I just open-sourced something that might help. Pinpoint lets you screenshot a UI, annotate it in a browser (click to pin, drag to box, type comments), and the agent acts on each annotation. Way faster than describing the bug in prose.

If you want to try it: `pinpoint open assets/demo.pinpoint.zip` after install gets you a sample session in 10 seconds.

https://github.com/maferland/pinpoint

## Notes

- For Slack/Discord, drop the GIF in the same message. Most clients auto-expand the link card too, so the screenshot in the README appears for free.
- LinkedIn rewards the first 200 characters before the "see more" cut. Make sure the first paragraph stands alone.
- Don't post the same copy to multiple channels in the same hour. Stagger by a few hours so each one gets its own oxygen.
