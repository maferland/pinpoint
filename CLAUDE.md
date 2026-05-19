# Pinpoint

Browser annotation UI for visual feedback. Primary surface: `/pinpoint-review` slash command via the `pinpoint` CLI binary. Fallback: MCP server (registered as `pinpoint` via `claude mcp add`) for non-interactive scripting.

## Commands

```bash
bun install          # install deps
bun test             # run unit/integration tests (bun:test)
bun run build        # typecheck → vite singlefile → bun bundle (CLI + MCP + UI)
bun run dev          # watch mode
bun run typecheck    # tsc --noEmit
verdict run          # LLM behavior tests for the using-pinpoint skill
```

## Running

```bash
# CLI (the primary entry point — slash command wraps this)
pinpoint review <image>... [--context "..."] [--port N]

# Server modes (legacy / MCP fallback)
bun src/main.ts --stdio   # MCP stdio + HTTP server on :4747
bun src/main.ts           # HTTP-only mode
PINPOINT_PORT=8080 bun src/main.ts  # custom port
```

## Architecture

- `src/cli.ts` — `pinpoint review` CLI; spawns HTTP server, opens browser, blocks on `waitForFinalize`, prints JSON to stdout
- `src/main.ts` — HTTP server (UI + REST API: GET review, GET image, PUT annotations, POST finalize) + MCP entrypoint
- `src/server.ts` — MCP tool registry (create_review, add_image, get_annotations, list_reviews)
- `src/store.ts` — file-based review persistence under `os.tmpdir()/pinpoint-reviews/`
- `commands/pinpoint-review.md` — slash command (`disable-model-invocation: true`) that shells out to `pinpoint review`
- `skills/using-pinpoint/SKILL.md` — guidance for Claude on when/how to use the slash command

## Constraints

- HTTP server defaults to port 4747 (override with `PINPOINT_PORT`); CLI uses port 0 (random) by default
- Annotation coordinates are percentages (0-100), not pixels
- `images` array (not singular `image`) — supports multi-screenshot reviews
- Annotations are `{ id, number, imageIndex, pin, box?, comment }` — no intent/severity/status fields. Claude classifies from the comment text.
- Canvas uses `hsl(var(--canvas-letterbox))` from CSS for theme support
- Tailwind v4 — custom colors use `hsl(var(--variable))` pattern in global.css, NOT `@theme`

## Releasing

Two delivery paths:
- `install.sh` does `git pull` + rebuild from `main` — fresh installs and manual re-runs get latest immediately, no tag required.
- In-app update banner (`src/use-update-check.ts`) polls the GitHub Releases API and only fires on a new `vX.Y.Z` tag. Without a tag, existing users on the prior version won't be prompted.

Cut a release when you want the banner to surface a change. Steps (run from `main` after the fix is merged):

```bash
# 1. Bump version in package.json (patch for bug fixes, minor for features)
# 2. Commit the bump
git add package.json && git commit -m "vX.Y.Z"
# 3. Tag and push — release.yml builds and publishes auto-generated notes
git tag vX.Y.Z && git push origin main vX.Y.Z
```

The `__APP_VERSION__` constant baked into the bundle comes from `package.json`'s `version` field (see `vite.config.ts`), so keep them in lockstep with the tag.
