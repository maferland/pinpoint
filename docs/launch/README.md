# Launch checklist

What's in this folder, what's done, what's on you.

## Files

- `show-hn.md` — Show HN post draft with title options + posting notes
- `twitter-thread.md` — six-tweet thread with copy and timing notes
- `reddit-post.md` — two versions (r/ClaudeAI and r/LocalLLaMA-style)
- `blog-post.md` — 1,000-word personal narrative
- `short-form.md` — Slack/Discord/LinkedIn one-liners

All drafts. Edit them in your voice before posting.

## What's done

- Versioned and tagged v0.6.0
- CHANGELOG.md (root of repo)
- Demo bundle checked in at `assets/demo.pinpoint.zip` so `pinpoint open assets/demo.pinpoint.zip` works immediately after install
- README rewritten: leads with the review loop, export/import as a follow-on, MCP and slash command as peers, "try it in one command" section
- New `/pinpoint:install` slash command + README documents the in-Claude install path (`/plugin marketplace add` → `/plugin install` → `/pinpoint:install`)
- All Done references fixed to match the actual button text (Looks good / Send N comments)
- Skill docs updated for export/import flow and corrected button text
- All five launch copy drafts in this folder

## Deploy state (pinpoint.maferland.com)

- Vercel project linked under `mafer/web` — rename to `pinpoint` in the dashboard. The repo directory was also renamed from `web/` to `site/` so future `vercel link` runs default to a clean name if you ever recreate the project.
- Production deploy: `https://web-mafer.vercel.app` — currently 401-gated by Vercel's Deployment Protection (will move to the `pinpoint` alias once renamed).
- Custom domain requested. Vercel returned: add `A pinpoint.maferland.com → 76.76.21.21` at your DNS provider (your nameservers are AWS Route 53 / awsdns-*).

To finish:

1. **Disable Deployment Protection.** Vercel dashboard → project `web` → Settings → Deployment Protection → set to "Disabled" or "Standard (Vercel Authentication) Only Preview Deployments". Without this the site returns 401 to anonymous visitors.
2. **Add the DNS A record** at Route 53 (or wherever the maferland.com zone lives): `A pinpoint.maferland.com 76.76.21.21`. Vercel issues the cert automatically once it resolves.
3. **(Optional) Rename the Vercel project** from `web` to `pinpoint`. The custom domain works either way, but the dashboard reads cleaner.

After DNS resolves:

- `curl -fsSL https://pinpoint.maferland.com/install.sh` should return the script body.
- Update root `README.md` install command to point at `https://pinpoint.maferland.com/install.sh` (currently still the raw GitHub URL).

## What's still on you

### Before posting

1. **Record the loop GIF.** This is the biggest single missing piece. Aim for 10-12 seconds, ~3MB. Suggested capture:
   - Take a screenshot of a real UI bug (Storybook story with a misaligned button works well)
   - Run `/pinpoint:review` (Claude Code) or `pinpoint review <file>`
   - Drop one pin, type a comment, hit Send
   - Cut to Claude applying the fix
   - Cut to the after screenshot
   - Tools: CleanShot X record-to-GIF, or `screencapture -v` + ffmpeg
   - Save to `assets/demo.gif`, then update README and the `[GIF]` placeholders in the launch drafts

2. **Edit the copy.** Run a pass through each launch file. Things only you can do:
   - Replace the placeholder GIF references with the real file path
   - Swap in any first-person details that match your actual experience
   - Cut anything that doesn't sound like you
   - Pick the Show HN title you like best

3. **Decide if you want the case study.** I didn't draft one because it needs real before/after screenshots and a real round-trip. Optional for launch, but worth shipping if you have one ready.

### Posting order

The community guides I trust suggest this sequence:

1. **Tuesday or Wednesday morning, US time** is the best HN traction window
2. **Show HN first.** Title is the only thing most people see. Pick the most specific option.
3. **Tweet the thread an hour later**, with a link back to the HN post in the last tweet.
4. **Reddit posts that afternoon or the next day.** Don't drop both subreddits at once; stagger by a day so each gets its own first-hour traction.
5. **Blog post and LinkedIn last** (Thursday or Friday). These have longer half-life and benefit from picking up traffic from the earlier channels.

### After posting

- Reply to every HN comment in the first 6 hours. Karma drops fast otherwise.
- If the GIF link breaks on HN (they don't render media inline), drop the GIF in your first comment with `[image]` syntax.
- Quote-retweet @backnotprop on the Plannotator-credit tweet (tweet 4 of the thread). It's the right thing to do and it'll likely earn you a bump.
- If a tweet hits a few hundred likes, pin the thread for a week.
- Watch for repo stars over the first 48 hours. If you cross 100, that's the threshold where it makes sense to keep promoting. If you're under 30, take a breath and come back with a v0.7 angle.

### Things to NOT do

- Don't post the same copy to multiple subreddits in the same day. Reddit cross-poster detection is aggressive and will shadow-ban the second one.
- Don't argue with people in HN comments who claim "this is just a wrapper." It is, partly. The wrapper is the point. Smile and move on.
- Don't promise a feature in a launch post that isn't shipped. v0.6.0 is what you have. Pin export/import as the headline, not a Future Roadmap section.
- Don't post during a major news cycle. If something else is dominating Hacker News' front page (a Cloudflare outage, a model release), wait a day.

## If things go well

You'll get a handful of GitHub issues in the first 48 hours. Most will be misuse ("how do I install Bun?" → point at https://bun.sh) or environment-specific bugs (paths on Windows, missing browser binary). Triage them, label them, respond.

You'll probably also get one or two people who want to integrate Pinpoint into their own agent. That's the highest-value response. Engage in detail, offer to pair-debug, get them past the first hurdle. Each integration is a multiplier on adoption.
