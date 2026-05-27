## [v0.8.2]

- **Stray pins don't pad your annotation count anymore.** Drop a pin, type nothing, click away — the pin used to stick around as a numbered marker with no note. Closing the popover with an empty (or whitespace-only) comment now removes the pin.

## [v0.8.1]

- **Commit messages and release notes can mention `pinpoint review &` again.** v0.8.0 matched the pattern anywhere on a Bash line — including inside quoted `--notes` and commit-message arguments — and blocked perfectly fine commands. Quoted spans are now masked before matching.

## [v0.8.0]

- **Your pins no longer vanish when an agent backgrounds the review.** Some agents spawn `pinpoint review` with `&`, `nohup`, or `disown` and lose the annotation JSON when you click Done — leaving them oblivious to your feedback. Pinpoint now blocks those invocations and steers the agent to a foreground call so your work makes it back.

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
