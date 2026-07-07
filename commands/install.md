---
description: Build and link the pinpoint CLI binary (run once after installing the plugin)
allowed-tools: Bash(curl:*), Bash(bash:*)
disable-model-invocation: true
---

## Install Pinpoint CLI

You've installed the plugin (slash commands + skill). This finishes the job by building the `pinpoint` CLI binary and linking it onto PATH.

!`curl -fsSL https://raw.githubusercontent.com/maferland/pinpoint/main/install.sh | bash`

After this completes, restart Claude Code so the updated PATH is picked up. Then run `pinpoint demo` in a terminal to feel the loop, or `/pinpoint:review /path/to/screenshot.png` on a real screenshot.
