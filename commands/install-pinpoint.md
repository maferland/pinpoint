---
description: Build and link the pinpoint CLI binary + register the MCP server (run once after installing the plugin)
allowed-tools: Bash(curl:*), Bash(bash:*)
disable-model-invocation: true
---

## Install Pinpoint CLI + MCP

You've installed the plugin (slash commands + skill). This finishes the job by building the `pinpoint` CLI binary, linking it onto PATH, and registering the MCP server.

!`curl -fsSL https://raw.githubusercontent.com/maferland/pinpoint/main/install.sh | bash`

After this completes, restart Claude Code so the new MCP server and updated PATH are picked up. Then try `/pinpoint-review /path/to/screenshot.png`.
