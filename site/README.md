# Pinpoint marketing site

Static one-pager for `pinpoint.maferland.com`. No build step for the site
itself — `api/share/` adds two Vercel serverless functions (Node, via
`@vercel/blob`) backing `pinpoint share`'s blob-tier relay. Deploying
elsewhere (Netlify, Cloudflare Pages, GitHub Pages) means reimplementing those
two functions on that platform, or dropping the blob tier and relying on
`pinpoint share --server <url>` pointed at a self-hosted relay instead.

## Files

- `index.html` — the page. Single file with inline CSS. Dark mode default, light mode via `prefers-color-scheme`.
- `install.sh` — copied from the repo root so `pinpoint.maferland.com/install.sh` serves it directly. Keep these in sync (a CI step or pre-commit hook is overkill for now; a manual `cp` after editing the root one is fine).
- `assets/icon.png`, `assets/screenshot-light.png` — copies of the repo assets. Same sync caveat.

## Deploy

Pick whichever fits your existing setup.

### Vercel (simplest)

```bash
# from repo root
cd site
vercel --prod
# add pinpoint.maferland.com under the Vercel project's Domains tab
# create a Blob store under Storage and connect it to this project —
# Vercel injects BLOB_READ_WRITE_TOKEN automatically, api/share/* needs it
```

Vercel will serve `index.html` at `/` and any other file at its path. `install.sh` will serve as `text/plain` automatically.

### Netlify

```bash
cd site
netlify deploy --prod --dir .
# add the custom domain in Netlify's dashboard
```

### Cloudflare Pages

Upload the `site/` directory via the Pages dashboard. Wrangler also works:

```bash
cd site
npx wrangler pages deploy . --project-name pinpoint
```

### GitHub Pages (subdirectory)

Less ideal because GitHub Pages doesn't like subdirectories as roots. If you go this route, push `site/` to a separate branch:

```bash
git subtree push --prefix site origin gh-pages
```

Then configure Pages to serve from `gh-pages`.

## After deploy

1. Update `README.md` install instructions to point at `https://pinpoint.maferland.com/install.sh` instead of the raw GitHub URL.
2. Update `site/index.html`'s hero-media to swap in the loop GIF (replace `assets/screenshot-light.png`).
3. Verify `curl -fsSL https://pinpoint.maferland.com/install.sh` returns the script body (not the index page).
4. Test the install flow end-to-end from a fresh terminal.

## Editing

- One file (`index.html`). Edit it directly. No bundler, no dependencies.
- Tested in Chrome, Safari, Firefox at 320px / 768px / 1280px widths.
- Keep the page under 50KB unzipped. Inline CSS is already small; if you add more, consider extracting to `style.css` and adding a `<link>`.

## What's intentionally NOT here

- A blog. The repo has a `CHANGELOG.md` and `docs/launch/blog-post.md`; cross-post from there.
- Analytics. Add later if you want to measure conversion (Plausible or Fathom are lightweight; avoid Google Analytics for a tool whose audience cares about that).
- Pricing. Pinpoint is MIT.
