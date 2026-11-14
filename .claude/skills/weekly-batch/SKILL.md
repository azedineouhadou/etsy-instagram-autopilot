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
   - reel → `ig-reel` for the hook and the beat script (see "Story reels"
     below): Problem → Solution → Benefit, as `brand/voice.md` "How I frame the
     book" says
   - carousel → `ig-carousel` for the cover and slide captions
   - every post → `ig-caption` for the caption and hashtags
   - every caption and on-image line → `ig-human` last
5. **Hard rules for all copy:**
   - Facts only from `product.json` (page counts, sizes, formats, ages). No
     invented numbers, reviews or claims.
   - Never mention PLR, MRR, KDP, Amazon, print-on-demand, reselling,
     "commercial use" or income — **even when the listing sells those rights**;
     no therapy, treatment, cure or guarantee claims; health and benefit wording
     only as `brand/voice.md` "How I frame the book" allows; no trademarked
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
   - `render.json`: one of the templates below; reels are always `story-reel`
     (`page-flip-reel` stays only for older posts). Copy the shape from
     `examples/queue/*/render.json`; limits are enforced by
     `src/render/spec.ts`:

     | Template | Key fields and limits |
     |---|---|
     | `spotlight` | `background` (pink/peach/butter/mint/sky/lavender), `eyebrow` ≤ 32, `headline` ≤ 60, `subline` ≤ 90, `mockup`, `badges` ≤ 3 × 28 |
     | `carousel` | 5–6 `slides`: `cover` (headline ≤ 60, image), `page` × 3–4 (caption ≤ 70, interior image), `cta` (headline ≤ 50, ≤ 3 points × 48) |
     | `story-reel` | `backdrop` (an image of the book, shown blurred), optional `cover` (beat index), `music` (a file in `assets/audio/`) + optional `musicStart` (seconds to skip), 6–10 `beats`: `say` ≤ 90, `scene`, ≤ 2 `stickers`, ≤ 3 `emphasis` words |

### Story reels

A story reel is told in **beats**: one spoken line each, with its own scene and
stickers, word-synced captions and sound effects, over the book's own art
blurred. **70–80 words over 6–10 beats ≈ 25–28 seconds.** The sample is
`examples/queue/2026-11-11-sample-dino-story/render.json`.

- `say`: the line, spoken and shown as captions. Write numbers as digits
  ("200 pages"): the voiceover spells them out, the captions keep the digits.
  Split joined words the way a transcript writes them ("doom scrolling").
  **Write for breath:** the voice runs at normal speed, so pauses come from
  punctuation — commas where a person would breathe ("Haunted houses, twisted
  creatures, and gothic scenes"), one idea per sentence. A full stop or a
  question mark gives the longest pause; a comma inside a list gives a short
  one; a comma before "for …" or "by …", or "...", barely registers — end the
  sentence instead when a pause matters. Never slow the voice down. The
  last beat ends with exactly "You can grab the printable version right from
  the link in my bio."
- `emphasis`: up to 3 words of `say` drawn in yellow — the word that matters.
- Scenes (`scene.kind`):

  | Scene | Fields | Use it for |
  |---|---|---|
  | `zoom` | `image`, `from`/`to` = `[x, y, scale]` (x, y 0–1 on the image, scale 1–4) | the hook on a detail; any "look at this" line. Two beats zooming on the same image read as one shot (start the second at the first's `to`) |
  | `pages` | `images` (2–4) | "look inside", variety |
  | `cover` | `image` (a mockup) | the reveal: "Meet …" |
  | `contrast` | `before`, `after` (≤ 40 each) | the problem → better habit ("Doom scrolling at 1 am" → "One page before bed") |
  | `reveal` | `from`, `to` | line art → colored. **Only when a mockup really shows that page colored** |
  | `cta` | `image`, `title` ≤ 50, `points` ≤ 2 × 28 | always the last beat |

- Stickers (≤ 2 per beat; add `"on": "<word of say>"` to land it as that
  word is spoken): `count` (`value`, `label`: "200 pages" — from `pageCount`),
  `chips` (≤ 3 × 22, from `sellingPoints`), `stamp` (≤ 28, slams down),
  `pill` (≤ 28, the payoff: "Found them all!"), `checks` (≤ 4 items that tick
  one by one), `circle` (`x`, `y`, `r` on a zoom scene's image).
- **The arc** — use it as a shape, not a template:
  1. **Hook** — `zoom` into the most striking detail + a question or a dare
  2. **Contrast** — the problem, struck out (`contrast`)
  3. **Reveal** — `cover` + `count` sticker
  4. **Benefits** — `pages` or `zoom` + `chips`
  5. **Your turn** — the reader acts: the niche move below
  6. **Payoff** — `pill`, `checks` or `reveal`
  7. **CTA** — `cta` + the spoken CTA

  Hook + Contrast are the Problem, Reveal + Benefits the Solution, Your turn +
  Payoff the Benefit (`brand/voice.md` "How I frame the book").
- **Niche moves.** Invent within the book's niche every week; these are
  starting points, never repeat last week's hook:

  | Niche | Your turn | Payoff / stickers |
  |---|---|---|
  | Horror | "Pick your monster": zoom across 2–3 creatures, a `circle` on each | `stamp`: "Not for the faint-hearted" |
  | Florals, cozy, winter | "Pick your palette": `chips` of colour words | `reveal` line art → colored mockup, if one exists |
  | Color by number | zoom on the numbers | `reveal` numbered page → colored mockup |
  | Word search, puzzles | `circle` on found words | `checks`, `pill`: "Found them all!" |
  | Kids' workbooks | `checks` ticking off the activities | `pill`: "Done before snack time" |
  | Christmas, seasonal | the season's ritual ("Advent evenings") | `stamp` with the season + `count` |

- No `music` by default: the owner prefers the voice alone. Add it only when
  the owner asks, with a track from `assets/audio/` (never the `sfx/` folder);
  loudness is evened out at render and the music dips under the voice on its
  own.
- Pick `backdrop` for mood: a busy, colorful image of the book blurs into a
  rich backdrop; a mostly-white page gives grey.
- Facts on stickers and scenes follow the same rules as captions.

## 4. Render and check

1. For each reel, make the voice first. VoiceStudio must be running on this
   computer; if it isn't, ask the owner to start it:

   ```bash
   npm run voiceover -- --post <folder>
   ```

   It keeps the first take that says the script (it hears each one back) and
   writes `voiceover.wav` plus `voiceover.json` (beat lengths and the time of
   every caption word). Editing a `say` afterwards makes validate fail with
   "voiceover out of date": run it again. If it says a beat is too short,
   lengthen that line or merge it into the next. Claude can't hear audio: tell
   the owner to listen to every reel (voice, caption sync, sound-effect levels).

2. Render **only the new posts** — a plain `npm run render` would also
   re-render posts already merged:

   ```bash
   npm run render -- --post <folder> --post <folder> …
   ```

3. **Look at the output**: every carousel slide and single image
   (`sips -Z 700` copies), and for reels the cover plus one frame per second
   (`npx remotion ffmpeg -ss <s> -i media/reel.mp4 -frames:v 1 -s 270x480
   <scratchpad>/f_<s>.jpg`, tiled into a contact sheet with sharp). Check: every
   beat shows what its line says, stickers don't cover the detail being talked
   about, captions readable, nothing cut off, the right pages. Fix
   `render.json`, re-run the voiceover if a `say` changed, and re-render until
   clean.

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
