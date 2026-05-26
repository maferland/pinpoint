# X / Twitter thread

Six tweets. Hook → demo → mechanism → portability angle → install → close. Replace `[GIF]` with the loop recording.

---

**1/ (hook)**

I got tired of describing UI bugs to Claude in prose. "Second card, padding's wrong, heading misaligned with body, looks like 4px..."

Pinpoint replaces that with pins on a screenshot. Click. Comment. Done. Claude fixes it.

[GIF of the loop]

---

**2/ (what it actually does)**

Slash command opens your browser. You annotate. Click Done. The agent gets structured JSON back: coordinates as percentages, your comment as the source of truth.

Whole round-trip usually under a minute.

---

**3/ (the new part in v0.6.0)**

A session packages into a `.pinpoint.zip` you can hand to anyone.

Designer flags issues. PM marks rough edges. You import their file, agent sees the pins, fixes them. None of that requires them to share your setup.

---

**4/ (mechanism credit)**

The slash-command-shells-out-to-CLI pattern is from @backnotprop's Plannotator. I just applied it to image annotation.

The portable session zip is the new piece. Visual review without locking everyone into the same agent.

---

**5/ (install)**

```
curl -fsSL https://raw.githubusercontent.com/maferland/pinpoint/main/install.sh | bash
```

Works with Claude Code (slash command) or anything that speaks MCP (Cursor, Aider, raw API).

---

**6/ (try without installing)**

After install, there's a demo bundle you can open immediately:

```
pinpoint open assets/demo.pinpoint.zip
```

Real screenshot, three starter pins, see the UI in ten seconds.

Repo: https://github.com/maferland/pinpoint

## Notes

- Tweet 1 is the only one that has to land. Most readers won't get past it. Lead with the pain you've felt.
- If the GIF is over 5MB, X will compress it badly. Aim for 3-4MB, ~10 seconds.
- Quote-retweet @backnotprop on tweet 4 if he's still active. Gives the thread a bump and credits properly.
- Reply to the thread with a screenshot of the `.pinpoint.zip` extracted (review.json + images/) for the people who care about file formats.
- Pin the thread for a week.
