# Blog post draft

Working title: **The visual feedback loop is the missing piece in AI coding**

Target: 800-1200 words. Personal narrative + the specific mechanism + a clear "try it" at the end. Suitable for a personal site, dev.to, Substack, or wherever you publish.

---

For the last six months I've been using Claude Code as my primary tool for frontend work, and there's one task it consistently fights me on: making things look right.

The model is genuinely good at writing the code. Tailwind classes, Flexbox layouts, accessibility attributes — all fine. The problem is the gap between "the code compiles and renders something" and "the code renders the thing I actually wanted." That gap is visual. It's "the spacing between these two cards is off by 4px" and "the CTA's text is one shade lighter than every other heading on the page" and "the modal closes one beat too fast."

Describing those in prose is exhausting. You end up writing a paragraph for what your eye sees in a half-second. And the model has to parse the paragraph back into something visual it can't actually see. Information is lost in both directions.

I started taking screenshots and pasting them in as images. Better, but still slow. Now the model can *see* what's there, but I still have to type the diagnosis. "Look at the second button in the navigation. The padding on the right is wider than the others. Fix that." Plus a sentence about which button I meant, because there are three.

What I actually wanted was: point at the thing. Type a sentence. Done.

## The pattern that made it work

Around the time I was solving this for myself, I came across [Plannotator](https://github.com/backnotprop/plannotator), a tool by @backnotprop for annotating plans. The mechanism stuck with me: a slash command shells out to a CLI binary, the binary blocks until the user signals done, structured stdout flows back into the conversation. The agent's loop is paused while the user does something in a different surface. When the user is finished, the agent picks up where it left off, now with structured data.

That's the right shape for visual feedback. The agent generates the code, I take a screenshot, I run a slash command, my browser opens, I click on the thing, type a sentence, hit Done. The slash command returns JSON with coordinates as percentages and my comment as the source of truth. The agent reads each annotation as a discrete task and works through them.

The implementation is small. An HTTP server bound to localhost. A React app served by it. The CLI spawns the server, opens the browser, and waits for a finalize signal. Coordinates are percentages so they're resolution-independent. No native dependencies, no Electron, no app to install. Just `bun run build` and a binary.

I called it Pinpoint. v0.1 worked end-to-end after a weekend. I've been using it daily since.

## What changed in v0.6

The thing I shipped this week is the part I'm proudest of, and the part that wasn't obvious until I'd been using the tool for a while: portable sessions.

Here's what happens. I'm working on a UI. I have Claude generate a first pass. I take a screenshot, run the slash command, pin a few issues, fix them, repeat. Three rounds in, the UI looks good *to me*, and I want a second pair of eyes. Usually a designer, sometimes a PM, sometimes my partner.

In the old version, I'd send a screenshot in Slack and ask "anything off about this?" They'd reply with prose. Then I'd type that prose back into Claude. Same lossy translation, just now with a human in the middle.

The new version: I click an Export button in the toolbar. Out comes a `.pinpoint.zip`, which is a small archive with a `review.json` manifest and the raw image bytes. I send the file. The recipient runs `pinpoint open the-file.pinpoint.zip` and gets the same browser UI I had, with my pins already on the screenshot. They add their own pins, click Done, export, send back. I open their file. Claude sees both sets and acts on the union.

What I like about this is that nobody else has to use Claude. Or know what MCP is. Or have a Claude account. They install Pinpoint (one curl, requires Bun) and they can participate. Visual review is decoupled from whatever agent is doing the fixing.

## Why I'm telling you

You can install Pinpoint with:

```bash
curl -fsSL https://raw.githubusercontent.com/maferland/pinpoint/main/install.sh | bash
```

After install there's a demo bundle you can open without taking your own screenshot:

```bash
pinpoint open assets/demo.pinpoint.zip
```

That opens a real session in your browser with a few starter pins on a real screenshot. Edit them, draw your own, click Done, see the JSON. It's the fastest way to feel the loop.

If you use Claude Code, the slash command `/pinpoint-review <image>` is the easiest entry point. If you use Cursor, Aider, or anything else that speaks MCP, the MCP server registers with the same `pinpoint` command and exposes four tools (`create_review`, `add_image`, `get_annotations`, `list_reviews`).

If you build it into your workflow and find rough edges, open an issue. If you ship a Pinpoint session to a designer and it actually closes a loop that used to take three Slack messages, send me a note. I want to hear it.

Repo: https://github.com/maferland/pinpoint

## Notes for publishing

- Add a short bio + photo at the bottom if your platform supports it.
- The GIF should appear right after the section header "The pattern that made it work". That's where readers are deciding whether to keep going.
- Cross-post: dev.to with canonical URL pointing back to your site, then a tweet linking to the original, then submit to HN if it's getting traction (≥ 50 organic reads in the first day).
- If you cross-post to Substack, the email subject should be the working title, not the H1.
