## [v0.8.0]

- **Agents can't lose your annotations to a detached `&` anymore.** Past Claude sessions sometimes spawned `pinpoint review` with `&` / `nohup`, the user clicked Done, and the JSON output was thrown away — leaving the agent oblivious to the feedback. A PreToolUse hook now hard-blocks these invocations and points at the right alternatives (foreground or `run_in_background`).

## [v0.7.0]

- **Massive screenshots now render correctly.** Stitched-scroll captures and ultra-wide panoramas no longer go blank past the browser's canvas limit (~16k px). The image downsamples gracefully on the long axis and scrolls.
- **Sharper pins on huge images.** Pin numbers and box borders moved to a DOM overlay so they stay crisp at native DPR even when the image canvas downsamples.
- **Scroll hints with clickable arrows.** When the image extends past the viewport, a subtle fade and a chevron button appear on that edge — click to page through 80% at a time.
- **Smarter fit mode.** Extreme aspect ratios route through single-axis fit instead of collapsing to an unreadable sliver (an 85k-px-tall capture used to render as 4 pixels wide).

## [v0.6.0]

- **Export and import review sessions.** Run `pinpoint export <reviewId>` to bundle pins and raw image bytes into a `.pinpoint.zip`, and `pinpoint open <file.pinpoint.zip>` to load someone else's review into your local store. Use `--mode replace|append|new` to control how an existing review with the same id gets merged.

## [v0.5.0]

- **Fit / Actual view modes.** Toggle between fitting the image into the viewport and seeing it at native resolution.
- **Draggable details panel.** Reposition the pin list anywhere on screen.
- **Hotkeys overlay.** Press `?` to see all keyboard shortcuts.
- **Settings popover.** Preferences moved into an in-canvas popover instead of the menu bar.

## [v0.4.2]

- **Drag-to-box no longer cancels at the image edge.** The box clamps to the boundary, and drags are tracked at the window level so releases outside the canvas don't abandon the in-progress box.

## [v0.4.1]

- **Tall and wide images stop getting squashed.** Single-axis fit kicks in for extreme aspects so content stays legible.
- **Done button shows the total comment count across all images** instead of just the active one.

## [v0.4.0]

- **In-app update banner.** Pinpoint now polls GitHub Releases and prompts you to upgrade when a new version is available, with the install command one click away.

## [v0.3.1]

- **Preferences moved to `~/.config/pinpoint`.** Settings persist in a stable location instead of a temp directory.
- **`install.sh` hardened.** Safer fetch + apply against partial downloads and missing dependencies.

## [v0.3.0]

- **Self-describing Done button.** Reads "Looks good" when there are no pins, "Send N comments" otherwise.
- **New toolbar and README icon** — pin + crosshair design.
- **Server-side auto-close preference** so the setting persists across sessions.
- **Test pyramid filled out** — unit, integration, e2e — and fast-exit / click-outside-to-save behavior.
