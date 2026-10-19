# CLAUDE.md

Instagram autopilot for the PixoraPrintsCrafts Etsy shop. Read `README.md` for
the full layout; this file holds the procedures Claude runs.

## Ground rules

- Never commit, push or open PRs — the owner runs all git commands.
- Never read, edit or print `.env`. The repo is public.
- Facts about a book come only from its Etsy listing or `product.json`. Never
  invent numbers, ages, reviews or claims. Follow `brand/voice.md` (no
  trademarks, no "therapy", no "free" unless it is).
- Ask before downloading anything from Etsy (images included).
- Never run `npm run publish -- --live` (or anything else that posts to
  Instagram) unless the owner says yes for that run in their latest message.
  The plain `npm run publish` is a dry run and is always fine.
- Since phase 5, GitHub Actions publishes approved posts in `main` on its own:
  the owner merging a post is the go-ahead. Never merge, never trigger the
  workflows, never set `approved: true` on a post the owner asked to hold.
- Finish every change with `npm run validate` and report its output.
- When a step in the README's **Roadmap** is finished, tick it and update its
  "Next up" line.

## Procedure: "process new books" / "add listing <link>"

1. If the owner gave a link, create `assets/products/<any-name>/link.txt` with it.
2. Run `npm run intake`. It renames each new folder to `<listingId>-<slug>`,
   cleans `link.txt` and shrinks images over 1600 px in place. If it prints
   `fix` lines, tell the owner what to fix and stop for those books.
3. For each folder listed under "Ready", open the link in Claude in Chrome and
   read the listing: title, description, page count, sizes, age range, format.
4. Write `product.json` in that folder (schema: `src/schemas/product.ts`,
   sample: `examples/assets/products/*/product.json`):
   - `listingId`, `url` — from `link.txt`
   - `title` — the listing title, shortened to what a person would call it
   - `theme` — one or two words (e.g. `dinosaurs`, `cozy florals`)
   - `ageRange` — as stated on the listing. Adult books: `{ "min": 18, "max": null }`.
     If the listing doesn't say and it isn't an adult book, ask the owner.
   - `pageCount` — the counted number on the listing, never rounded
   - `format` — `digital` for printables
   - `sellingPoints` — 3–6 short facts taken from the listing
   - `keywords` — 3–6 from the listing's title and tags
   - `mockups`, `interior` — every image in those folders, sorted by name
   - `sourceCheckedAt` — today's date
5. Run `npm run validate` and show the owner each new `product.json` summary.

## Procedure: weekly batch

(Becomes a single command in phase 6.) Use `ig-plan`, `ig-reel`, `ig-caption`,
`ig-carousel` and `ig-human`. Per post create `queue/<YYYY-MM-DD>-<slug>/`
with `post.json` and `render.json` (formats in the README, "What a post is";
full schemas in `src/schemas/post.ts` and `src/render/spec.ts`). Schedule posts
in the windows in `brand/schedule.json` (US Eastern), using the Eastern offset
for that date (`-04:00` or `-05:00` — check, US daylight saving changes), then
`npm run render` and `npm run validate`. Respect the rotation and carousel
warnings unless the owner says otherwise. Set `approved: true` only on posts
the owner hasn't asked to hold.
