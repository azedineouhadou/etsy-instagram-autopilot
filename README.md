# etsy-instagram-autopilot

Turns PixoraPrintsCrafts' Etsy coloring and activity books into Instagram posts
(single images, carousels and motion-graphic reels), then publishes them on a
schedule to drive traffic to the Etsy shop.

```
 You                     Claude Code                    GitHub
 ───                     ───────────                    ──────
 add a book  ──────────▶ write captions + layouts ──┐
 (images + link)         render images / reels      │
                         validate everything        │
                                                    ▼
 review & merge the PR ◀──────────────────── PR with the week's posts
        │
        └──────────────────────────────────▶ cron publishes each post
                                              at its scheduled time
```

## What works today

| Part | Status |
|---|---|
| Product library, post format, validator | ✅ Ready |
| Templates: single image, carousel, reel (Remotion) | ✅ Ready |
| Publisher (sends posts to Instagram) | ✅ Built — dry run only until phase 4 |
| Meta app + Instagram token | ⏳ Phase 4 (owner does this) |
| Scheduled publishing on GitHub Actions | ⏳ Phase 5 |
| One-command weekly batch prompt | ⏳ Phase 6 |

Until phases 4–5 land, you can build, render, review and dry-run posts, but
nothing is sent to Instagram. Progress is tracked in `roadmap.md`.

---

## 1. One-time setup

### What you need

- **Node.js 22 or newer** — check with `node -v`
- **Git** and access to this GitHub repo
- **Claude Code**, opened from this repo's folder (the Instagram skills are
  enabled for this folder only)
- **Claude in Chrome** extension — Claude uses it to read Etsy listings

### Install

```bash
git clone https://github.com/azedineouhadou/etsy-instagram-autopilot.git
cd etsy-instagram-autopilot
npm install
cp .env.example .env
```

`.env` holds the Instagram keys. You can leave it empty until phase 4.
**Never commit `.env` — this repo is public.**

### Link the shop voice

The Instagram skills read `~/.claude/instagram/voice.md`. Point it at the
repo's copy so edits are picked up automatically:

```bash
mkdir -p ~/.claude/instagram && ln -sf "$PWD/brand/voice.md" ~/.claude/instagram/voice.md
```

### Check it works

```bash
npm run render:examples
npm run validate:examples
```

The first render downloads a headless Chrome (~170 MB, once per machine). When
it's done, open `examples/queue/*/media/` to see a sample image, carousel and
reel. You should see `✓ valid` at the end of the second command.

---

## 2. Where things live

```
assets/
  products/        ← your books, one folder each (you add these)
  audio/           ← optional royalty-free music for reels
brand/
  brand.json       ← colours, fonts, handle, post sizes
  voice.md         ← how captions should sound
queue/             ← posts waiting to publish (one folder per post)
published/         ← posts already live (moved here by the publisher)
examples/          ← a complete sample of everything above — copy from here
src/               ← code (you don't need to touch it to make posts)
```

---

## 3. Add a book to the library

Do this **once per book**. After that, the book can be featured any week.
You only drop files in a folder — Claude does the rest.

### Step 1 — Make a folder (any name)

```
assets/products/dino book/
  link.txt
  mockups/
  interior/
```

The name doesn't matter — it gets renamed automatically to
`<listing ID>-<short-name>` (e.g. `1234567890-dinosaur-coloring-book`).

### Step 2 — Paste the Etsy link into `link.txt`

Open the book on Etsy, copy the address from the browser bar and paste it into
`link.txt`. Messy links are fine — `?ref=…`, `/fr/` and spaces get cleaned up:

```
https://www.etsy.com/listing/1234567890/dinosaur-coloring-book?ref=shop_home
```

Short `etsy.me/…` share links don't work: open them first and copy the full
`etsy.com/listing/…` address.

### Step 3 — Add the images

| Folder | What to put | How many |
|---|---|---|
| `mockups/` | Cover and lifestyle mockups (book on a table, tablet view…) | 1–3 (at least 1) |
| `interior/` | Sample inside pages, as clean flat images | 3–10 |

Image rules:

- **PNG or JPG** only, at least **1080 px** on the short side
- Name them in the order you want them used: `01.png`, `02.png`, `03.png`…
- Interior pages look best in **portrait**, like a printed page
- No watermarks over the artwork — they show up on every post
- Every image goes **inside** `mockups/` or `interior/`, not loose in the folder

### Step 4 — Ask Claude

In Claude Code (opened in this repo, with Chrome open), say:

> process new books

Claude runs `npm run intake`, which finds every folder with a `link.txt` and no
`product.json`, renames it and cleans the link. Then Claude reads each listing
in Chrome and writes its `product.json` with the facts from the listing.

You can add several books at once — one folder each — and process them
together.

If intake prints `fix` lines, do what they say and ask again:

| Message | Fix |
|---|---|
| `add link.txt with the Etsy listing link` | The folder has no `link.txt` |
| `short etsy.me link …` | Paste the full `etsy.com/listing/…` address |
| `move x.png into mockups/ or interior/` | An image is loose in the book folder |
| `mockups/ needs at least 1 image` | Add a cover or mockup |
| `listing … already has a folder` | That book is already in the library |

### Step 5 — Check what Claude wrote

Open the new `product.json` and check the facts, especially page count and
ages. Captions only use what's written there. Then:

```bash
npm run validate
```

and commit the folder.

<details>
<summary>Writing <code>product.json</code> by hand (without Claude)</summary>

Run `npm run intake` first so the folder is renamed, then copy
`examples/assets/products/9999999999-sample-dino-coloring-book/product.json`
and edit it:

```json
{
  "listingId": "1234567890",
  "title": "Dinosaur Coloring Book for Kids",
  "url": "https://www.etsy.com/listing/1234567890/dinosaur-coloring-book",
  "theme": "dinosaurs",
  "ageRange": { "min": 4, "max": 8 },
  "pageCount": 30,
  "format": "digital",
  "sellingPoints": [
    "30 printable pages, print as many times as you like",
    "Thick, simple outlines for little hands",
    "Instant download, US Letter and A4"
  ],
  "keywords": ["dinosaur coloring pages", "printable coloring book"],
  "mockups": ["mockups/01.png"],
  "interior": ["interior/01.png", "interior/02.png", "interior/03.png"],
  "sourceCheckedAt": "2026-10-17"
}
```

| Field | Meaning |
|---|---|
| `listingId` | The number after `/listing/` in the link (must match the folder name) |
| `url` | The clean link from `link.txt` |
| `ageRange` | `max` can be `null` for "ages 4+". Adult books: `{ "min": 18, "max": null }` |
| `format` | `digital` or `physical` |
| `sellingPoints` | 1–8 short facts **from the listing** — don't add claims it doesn't make |
| `mockups` / `interior` | Every image in those folders, path relative to the book folder |
| `sourceCheckedAt` | Date the facts were checked, `YYYY-MM-DD` |

</details>

---

## 4. The weekly routine

> Until phase 6, steps 2–3 are done by asking Claude in plain words. After
> phase 6 it becomes a single command.

**1. Add any new books** (section 3): drop the folders, then ask Claude to
"process new books". Skip if nothing is new.

**2. Ask Claude for the week**, from Claude Code in this folder:

> Plan next week's posts: 5 posts, Monday to Friday at 18:00. Feature the
> dinosaur and space books. Mix one reel, two carousels and two images.

Claude uses the Instagram skills and your `voice.md` to write each post, then
creates a folder per post in `queue/` (see section 5).

**3. Render and check:**

```bash
npm run render
npm run validate
```

**4. Review.** For each folder in `queue/`:

- Open `media/` and look at every image and the reel
- Read `caption` and `hashtags` in `post.json`
- Want to fix the text on an image? Edit `render.json`, then
  `npm run render -- --post <folder-name>`
- Want to hold a post back? Set `"approved": false`

**5. Open the PR** (you run git; Claude doesn't commit or push):

```bash
git checkout -b posts/2026-11-week-1
git add queue/ assets/
git commit -m "posts: week of 2026-11-02"
git push -u origin posts/2026-11-week-1
```

Open the pull request on GitHub, look through it once more, and merge.

**6. Publishing** — after phase 5, GitHub Actions posts each approved post at its
`scheduledAt` time and moves it to `published/`. Nothing else to do.

To preview what the next run would send, without sending anything:

```bash
npm run publish -- --now 2026-11-03T19:00:00+01:00
```

The posts' media must already be merged to `main` — Instagram downloads it
from the public repo.

---

## 5. Anatomy of a post

Each post is a folder in `queue/` named `<YYYY-MM-DD>-<short-name>`:

```
queue/2026-11-02-dino-carousel/
  post.json     ← caption, schedule, approval
  render.json   ← which template, what text goes on the images
  media/        ← created by npm run render — don't edit by hand
```

### `post.json`

```json
{
  "id": "2026-11-02-dino-carousel",
  "listingId": "1234567890",
  "scheduledAt": "2026-11-02T18:00:00+01:00",
  "approved": true,
  "media": { "type": "carousel", "files": ["media/01.jpg", "media/02.jpg"] },
  "caption": "Which page would they color first? 🦕\n\nLink in bio",
  "hashtags": ["#coloringpages", "#kidsactivities"],
  "altText": "Pages from a dinosaur coloring book."
}
```

| Field | Rule |
|---|---|
| `id` | Same as the folder name |
| `listingId` | A book that exists in `assets/products/` |
| `scheduledAt` | Date and time **with offset** — `+01:00` for Morocco most of the year. Two posts can't share a time |
| `approved` | Only `true` posts get published |
| `media` | Filled in by `npm run render` |
| `caption` + `hashtags` | 2,200 characters max together; at most **5 hashtags** |

### `render.json` — pick a template

**Single image — `spotlight`**

```json
{
  "template": "spotlight",
  "background": "butter",
  "eyebrow": "New in the shop",
  "headline": "Rainy day? Print this.",
  "subline": "30 coloring pages, ready in seconds",
  "mockup": "mockups/01.png",
  "badges": ["Instant download", "Ages 4–8", "Letter & A4"],
  "cta": "Link in bio"
}
```

`background`: `pink`, `peach`, `butter`, `mint`, `sky` or `lavender`.

**Carousel — `carousel`** (2–6 slides, **aim for 5–6**)

```json
{
  "template": "carousel",
  "slides": [
    { "kind": "cover", "eyebrow": "Printable coloring book", "headline": "Which page would they color first?", "image": "mockups/01.png" },
    { "kind": "page", "caption": "1. Sunny day in the garden", "image": "interior/01.png" },
    { "kind": "page", "caption": "2. A sky full of stars", "image": "interior/02.png" },
    { "kind": "page", "caption": "3. Flower party", "image": "interior/03.png" },
    { "kind": "cta", "headline": "30 pages. Hit print. It fits.", "image": "mockups/01.png", "points": ["Instant download", "Thick, simple outlines", "US Letter and A4"], "cta": "Link in bio" }
  ]
}
```

Slide kinds: `cover` (first), `page` (one interior page each), `cta` (last).

**Reel — `page-flip-reel`** (about 9–15 seconds, longer with more pages)

```json
{
  "template": "page-flip-reel",
  "hook": "Rainy day? Print this.",
  "subline": "Screen-free fun in seconds",
  "pagesTitle": "A peek inside",
  "pagesBadge": "30 pages",
  "pages": ["interior/01.png", "interior/02.png", "interior/03.png", "interior/04.png"],
  "mockup": "mockups/01.png",
  "points": ["Instant download", "Thick, simple outlines", "Print as many as you like"],
  "cta": "Link in bio",
  "music": "calm-ukulele.mp3"
}
```

`pages`: 2–6 interior pages. `music` is optional — a file in `assets/audio/`,
royalty-free only.

Image paths are always **inside the book's folder** (`mockups/…` or
`interior/…`). The book is found from `listingId` in `post.json`.

### Text length limits

Text that's too long is rejected so it can't break the layout.

| Field | Max characters |
|---|---|
| `hook` (reel) | 48 |
| `headline` | 60 (cover, spotlight) · 50 (carousel CTA slide) |
| `subline` | 90 (70 in reels) |
| `eyebrow` | 32 |
| `caption` (carousel page slide) | 70 |
| each `badge` | 28 — max 3 badges |
| each `point` | 48 — 1 to 3 points |
| `cta` | 30 |

---

## 6. Commands

| Command | What it does |
|---|---|
| `npm run intake` | Prepares new book folders (reads `link.txt`, renames the folder) |
| `npm run render` | Renders every post in `queue/` that has a `render.json` |
| `npm run render -- --post <folder>` | Renders one post |
| `npm run validate` | Checks books and posts; must end with `✓ valid` |
| `npm run publish` | **Dry run**: shows what would be sent to Instagram right now. Add `--now <date>` to preview a later run |
| `npm run publish -- --live` | Really publishes due posts (needs `.env`; phase 4+) |
| `npm test` | Runs the automated tests |
| `npm run ig:whoami` | Checks the Instagram token in `.env` and prints your account ID (phase 4) |
| `npm run studio` | Opens the templates in a browser to preview and tweak (run a render first so images are staged) |
| `npm run render:examples` / `validate:examples` / `publish:examples` | Same, on the sample data in `examples/` |
| `npm run typecheck` | Checks the code compiles |

---

## 7. Validator messages

**Errors** (`error`) block the batch. **Warnings** (`warn`) are advice.

| Message | What to do |
|---|---|
| `listing … is not in assets/products` | Add the book (section 3) or fix `listingId` |
| `missing product.json — … add link.txt` | New book folder without a link (section 3, step 2) |
| `warn … new book waiting for product.json` | Ask Claude to "process new books" |
| `file not found: …` | Wrong image path, or run `npm run render` |
| `folder must start with "<id>-"` | Rename the book folder to match `listingId` |
| `scheduledAt: Invalid ISO datetime` | Add the offset: `2026-11-02T18:00:00+01:00` |
| `same scheduledAt as …` | Move one post to another time |
| `hashtags: Too big` | 5 hashtags max |
| `warn … featured N day(s) earlier` | Same book less than 3 days apart — consider another book |
| `warn … appears N times in 7 days` | Same book more than twice a week |
| `warn … slides — aim for 5 to 6` | Add slides to the carousel |
| `warn … not approved` | Fine if you meant to hold it back |

---

## 8. Changing the look and voice

- **Colours, fonts, handle:** `brand/brand.json`
- **How captions sound, what never to say, proof numbers:** `brand/voice.md`
  — update the sales and review numbers from time to time
- **Rotation rules** (days between the same book, max per week):
  `src/lib/rotation.ts` → `MIN_GAP_DAYS`, `MAX_PER_WEEK`
- **Carousel length:** `src/schemas/content-rules.ts`

Then run `npm run render:examples` to see the result.

---

## 9. Secrets and safety

- `.env` is ignored by git. The repo is public — never paste keys anywhere else
- Everything in `queue/` is public once pushed, including upcoming posts
- Only use images and music you own or have the rights to
- Never mention trademarked characters, brands or shows — see `brand/voice.md`
