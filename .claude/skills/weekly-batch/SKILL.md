---
name: weekly-batch
description: Create next week's Instagram posts for the PixoraPrintsCrafts shop — plan days, US times and books, write captions in the shop voice, render the images and reels, validate, and hand the owner a review summary. Use when the owner says "weekly batch", "plan next week", "make this week's posts" or runs /weekly-batch.
---

# Weekly batch

Produces one week of posts in `queue/`, ready for the owner to review and
merge. Nothing is published here: merging is the owner's go-ahead, and
GitHub Actions publishes each post at its time.

The owner may add instructions after the command, e.g. "5 posts, feature the
horror book twice, no reel on Friday". Their instructions win over the
defaults below, but never over the ground rules in `CLAUDE.md`.

## 1. Pre-flight

1. `git status` (read-only). If `main` is behind `origin/main`, ask the owner to
   run `git switch main && git pull` first — the publish bot commits there.
2. `npm run intake`. If a book is waiting for `product.json`, run the
   "process new books" procedure from `CLAUDE.md` first, or ask.
3. `npm run validate`. Fix or report errors before adding more posts.

## 2. Plan

```bash
npm run plan:week                       # next week, 5 posts
npm run plan:week -- --posts 4 --days mon,wed,thu,sun --week 2026-11-02
```

- Use the **`scheduledAt` values exactly as printed**. They carry the correct
  US Eastern offset (`-04:00` / `-05:00`); never type an offset by hand.
- The planner already spreads books by the rotation rules and suggests a format
  mix (reels, carousels, single images). If the owner asked for specific books
  or formats, swap them in, then let `npm run validate` re-check rotation.
- Show the owner the plan table before writing if they asked to approve it;
  otherwise continue.

## 3. Write each post

For each planned post:

1. **Read the book's `product.json` in full, including `notes`.** Notes can
   forbid images (e.g. a mockup showing resale badges) or claims.
2. **Look at the images** before choosing them: make small copies in the
   scratchpad with `sips -Z 400 <file> --out <scratchpad>/…` and read them.
   Pick pages that look good small, and describe them accurately.
3. **Audience:** `ageRange.min >= 18` → adults who color; otherwise parents
   (plus teachers/homeschoolers if the listing says so). Write to that one
   audience only, as `brand/voice.md` says.
4. **Write the copy with the Instagram skills:**
   - reel → `ig-reel` for the hook (≤ 48 characters) and subline
   - carousel → `ig-carousel` for the cover and slide captions
   - every post → `ig-caption` for the caption and hashtags
   - every caption and on-image line → `ig-human` last
5. **Hard rules for all copy:**
   - Facts only from `product.json` (page counts, sizes, formats, ages). No
     invented numbers, reviews or claims.
   - Never mention PLR, MRR, KDP, Amazon, print-on-demand, reselling,
     "commercial use" or income — **even when the listing sells those rights**;
     no therapy, treatment, cure or guarantee claims; no trademarked
     characters; "free" only if it is. `npm run validate` blocks these words
     (list in `src/schemas/content-rules.ts`).
   - Caption ends with "Link in bio"; at most **5 hashtags**; caption +
     hashtags ≤ 2,200 characters.
   - Vary hooks and headlines across the week; don't reuse last week's.
6. **Create the folder** `queue/<date>-<short-name>/` (e.g.
   `queue/2026-10-26-horror-reel/`) with:
   - `post.json`: `id` = folder name, `listingId`, `scheduledAt` from the plan,
     `approved: true` (unless the owner asked to hold it), `media` placeholder of
     the right type (the renderer overwrites it), `caption`, `hashtags`, and
     `altText` for single images.
   - `render.json`: one of the three templates. Copy the shape from
     `examples/queue/*/render.json`; limits are enforced by
     `src/render/spec.ts`:

     | Template | Key fields and limits |
     |---|---|
     | `spotlight` | `background` (pink/peach/butter/mint/sky/lavender), `eyebrow` ≤ 32, `headline` ≤ 60, `subline` ≤ 90, `mockup`, `badges` ≤ 3 × 28 |
     | `carousel` | 5–6 `slides`: `cover` (headline ≤ 60, image), `page` × 3–4 (caption ≤ 70, interior image), `cta` (headline ≤ 50, ≤ 3 points × 48) |
     | `page-flip-reel` | `hook` ≤ 48, `subline` ≤ 70, `pagesTitle` ≤ 40, `pagesBadge` ≤ 20, `pages` 2–6 interior images, `mockup`, `points` ≤ 3 × 48 |

## 4. Render and check

1. Render **only the new posts** — a plain `npm run render` would also
   re-render posts already merged:

   ```bash
   npm run render -- --post <folder> --post <folder> …
   ```

2. **Look at the output**: every carousel slide and single image
   (`sips -Z 700` copies), and for reels the cover plus two frames
   (`npx remotion still src/video/index.ts PageFlipReel <out> --frame=<n>
   --props=<json> --public-dir=.cache/render-public`). Check: no text over
   images, nothing cut off, the right pages, readable at phone size. Fix
   `render.json` and re-render until clean.

## 5. Validate and dry-run

```bash
npm run validate
npm run publish -- --now <one hour after the last post's scheduledAt>
```

Validation must end with `✓ valid`. Explain every warning in plain words
(rotation warnings are expected while the library has fewer than 3 books).
The dry run should list the week's posts in order.

## 6. Hand over

Give the owner:

- a table: day, time (ET and Morocco), format, book, headline/hook, first line
  of the caption, folder
- anything they should decide (warnings, held posts, weak images)
- the git commands, which the owner runs:

  ```bash
  git checkout -b posts/<monday-date>
  git add queue && git commit -m "posts: week of <monday-date>"
  git push -u origin posts/<monday-date>
  ```

- the reminder: **merging is the go-ahead**; to hold a post later, merge a
  change setting `"approved": false` before its time.

Then tick the README roadmap if this was the first real week.
