# etsy-instagram-autopilot

Instagram on autopilot for the **PixoraPrintsCrafts** Etsy shop. Claude turns
the shop's coloring and activity books into Instagram posts (single images,
carousels and motion-graphic reels), you review them in a pull request, and
GitHub publishes them on schedule for a US audience. Every post points to the
shop through "Link in bio".

```
 You                         Claude Code                       GitHub
 ───                         ───────────                       ──────
 add a book folder ───────▶  writes captions + layouts  ──┐
 ask for the week            renders images / reels       │
                             validates everything         ▼
 review & merge the PR ◀─────────────────────────── PR with the week's posts
                                                          │
                              hourly job publishes each post at its time,
                              moves it to published/ and commits the result
```

---

## How to use it

### First time on a new computer

You need **Node.js 22+**, **Git**, **Claude Code** (opened from this folder, so
the Instagram skills load) and the **Claude in Chrome** extension.

```bash
git clone https://github.com/azedineouhadou/etsy-instagram-autopilot.git
cd etsy-instagram-autopilot
npm install
cp .env.example .env
mkdir -p ~/.claude/instagram && ln -sf "$PWD/brand/voice.md" ~/.claude/instagram/voice.md
```

`.env` is only needed to publish from your own computer; day to day, GitHub
publishes using its secrets. **Never commit `.env` — this repo is public.**

### 1. Add a book (once per book)

```
assets/products/<any name>/
  link.txt     the Etsy listing link, pasted as-is
  mockups/     1–3 images: cover and lifestyle mockups (at least 1)
  interior/    3–10 images: sample inside pages
```

Images: PNG or JPG, at least 1080 px on the short side, named in order
(`01.png`, `02.png`…), all inside `mockups/` or `interior/`. Drop in full-size
files — intake shrinks anything over 1600 px (black-and-white pages become
compact greyscale, ~5× smaller) so the public repo stays light. Save **mockup
photos as JPG**: PNG photos are ~5× bigger.

Then tell Claude **"process new books"**. It renames the folder to
`<listingId>-<name>`, shrinks oversized images, reads the listing in Chrome and
writes `product.json`.
**Check the facts in `product.json`** — captions only use what's written
there. Books stay in the library and can be featured any week; delete a book
folder only when its listing is gone.

### 2. Make the week's posts

Pull first (the publishing bot commits to `main`):

```bash
git switch main && git pull
```

In Claude Code, run **`/weekly-batch`** — optionally with instructions:

> /weekly-batch 5 posts, feature the horror book twice, no reel on Friday

Claude plans the week (`npm run plan:week`: days, US times with the right
daylight-saving offset, and which book goes where under the rotation rules),
writes each post in the shop voice, renders it, checks the images, validates
and gives you a summary table. To see just the plan: `npm run plan:week`. For
each post folder:

- open `media/` and look at every image and the reel
- read `caption` and `hashtags` in `post.json`
- to change text on an image, edit `render.json` and ask Claude to re-render it
- to hold a post back, set `"approved": false`

### 3. Review and merge

```bash
git checkout -b posts/2026-11-week-1
git add -A && git commit -m "posts: week of 2026-11-02"
git push -u origin posts/2026-11-week-1
```

Open the PR, look through it, merge. **Merging is the go-ahead** — from then on
GitHub publishes each approved post at its time. To stop a merged post, merge
a change that sets `"approved": false` or deletes its folder before its time.

### What a post is

```
queue/<YYYY-MM-DD>-<name>/
  post.json     caption, hashtags, scheduledAt, approved
  render.json   template + text on the image + which book images to use
  media/        rendered JPEG(s) / MP4 — generated, don't edit by hand
```

| Template | Output | Rules |
|---|---|---|
| `spotlight` | 1 image, 1080×1350 | headline ≤ 60 chars, up to 3 badges |
| `carousel` | 2–6 slides (aim for **5–6**) | cover → pages → closing slide |
| `page-flip-reel` | 9–15 s video 1080×1920 + cover | hook ≤ 48 chars, 2–6 pages, no music |

- **Times are US Eastern** with the offset for that date: `-04:00` until
  1 Nov 2026, `-05:00` after (US daylight saving). Example:
  `2026-11-02T18:00:00-05:00`. Posts go out at the first hourly run after their
  time (about :17, sometimes later).
- **Captions:** 2,200 characters max with hashtags, **at most 5 hashtags**.
- **Rotation:** the validator warns when a book appears less than 3 days apart
  or more than twice in 7 days.
- Examples of everything live in `examples/` and are never published.

### Commands

| Command | What it does |
|---|---|
| `npm run intake` | Prepares new book folders and shrinks oversized images (Claude runs it for "process new books") |
| `npm run plan:week` | Proposes next week's slots (US time, correct offset), formats and books (`-- --posts 4 --days mon,wed --week 2026-11-02`) |
| `npm run render` | Renders every post in `queue/` (`-- --post <folder>` for one) |
| `npm run validate` | Checks books and posts — must end with `✓ valid` |
| `npm run publish` | **Dry run**: shows what would be posted now (`-- --now <date>` to preview later) |
| `npm run publish -- --live` | Really publishes due posts from your computer (needs `.env`) |
| `npm run ig:whoami` | Checks the Instagram token in `.env` |
| `npm test` / `npm run typecheck` | Automated tests / type check |
| `npm run studio` | Opens the templates in a browser to preview and tweak |

### Upkeep

| What | When | What to do |
|---|---|---|
| Instagram token | Refreshed **automatically every Monday** | Nothing. If the "Refresh Instagram token" job fails for weeks, generate a new token in the Meta app (Instagram → API setup with Instagram business login → Generate token) and replace the `INSTAGRAM_ACCESS_TOKEN` secret |
| `GH_SECRETS_TOKEN` | Expires **1 year** after you made it | GitHub → Settings → Developer settings → Fine-grained tokens → regenerate (repo `etsy-instagram-autopilot`, **Secrets: Read and write**) and update the secret |
| `.env` token on your computer | Expires 60 days after you made it | Only matters for publishing from your computer; regenerate if needed |
| Proof numbers in `brand/voice.md` | Every few months | Update sales and review counts |
| Scheduled jobs | Paused by GitHub after 60 days without repo activity | Weekly PRs prevent it; otherwise Actions tab → **Enable workflow** |

GitHub secrets (Settings → Secrets and variables → Actions → **Repository**
secrets): `INSTAGRAM_USER_ID`, `INSTAGRAM_ACCESS_TOKEN`, `GH_SECRETS_TOKEN`;
variable `INSTAGRAM_API_VERSION = v25.0`.

### When something fails

| Message | Fix |
|---|---|
| `listing … is not in assets/products` | Add the book, or fix `listingId` |
| `file not found: …` | Wrong image path, or render the post |
| `scheduledAt: Invalid ISO datetime` | Add the offset, e.g. `…T18:00:00-05:00` |
| `hashtags: Too big` | 5 hashtags max |
| `off-limits wording "PLR" …` | Reseller words (PLR, MRR, KDP, Amazon, resell, commercial use…) and health claims (therapy, treatment, cure, guaranteed) never go on Instagram — rewrite that line |
| `warn … featured N day(s) earlier` / `appears N times in 7 days` | Same book too often — consider another book |
| `warn … slides — aim for 5 to 6` | Add slides to the carousel |
| Failed run: `missing INSTAGRAM_USER_ID…` | Secrets must be **Repository** secrets, not Environment secrets |
| Failed run: `403 … Resource not accessible by personal access token` | `GH_SECRETS_TOKEN` needs **Secrets: Read and write** on this repo |
| Failed run: 403 at "Save results to the repo" | Settings → Actions → General → Workflow permissions → **Read and write** |
| Post failed: "Media download has failed" | The post wasn't merged to `main` yet, or the file isn't JPEG/MP4 |

Ask Claude to read the failed run's log — it can see GitHub Actions runs.

### Where to change things

| To change | Edit |
|---|---|
| Colours, fonts, logo, handle | `brand/brand.json`, `brand/logo.png` |
| How captions sound, words to avoid, proof numbers | `brand/voice.md` |
| Posting days and times | `brand/schedule.json` |
| Rotation rules | `src/lib/rotation.ts` (`MIN_GAP_DAYS`, `MAX_PER_WEEK`) |
| Carousel length | `src/schemas/content-rules.ts` |

---

## Roadmap

Tick a box when a step is done. Claude ticks its own steps.
**Next up:** review and merge the first real week (5 posts, 26 Oct – 1 Nov,
branch `posts/2026-10-26`), and confirm the unattended post (Mon 19 Oct, 6 pm ET).

### Done

- [x] Foundation: product and post formats, validator, rotation and carousel rules
- [x] Templates: single image, carousel and page-flip reel (Remotion), self-fitting cards for real artwork
- [x] Book intake from a folder + `link.txt`
- [x] Brand look, logo and shop voice approved
- [x] First real book: Autumn Color by Number (80 pages)
- [x] Publisher with dry run, no-double-post safeguard and 22 automated tests
- [x] Meta app, Instagram Business account, token
- [x] Live tests: single image, 6-slide carousel and silent reel published
- [x] GitHub Actions: hourly publishing and weekly token refresh, secrets in place
- [x] US posting windows saved in `brand/schedule.json`
- [x] Intake shrinks big images (autumn pages 9.5 MB → 2.0 MB, no visible loss)

### Now

- [ ] One scheduled post goes out with nobody at the keyboard (Mon 19 Oct, 6 pm ET) — Owner checks
- [ ] Turn on GitHub email for failed workflows: profile → Settings → Notifications → Actions → Email, failed workflows only — Owner

### Next: weekly routine

- [x] One command for the weekly batch: `/weekly-batch` (plan → write → render → check → validate) — Claude
- [ ] Add the rest of the catalog (one folder + `link.txt` per book) — Owner
- [ ] First real week: 4–5 posts generated, reviewed, merged — Owner + Claude
- [ ] Adjust after the first week (timing, mix, tone) — Owner + Claude

### Later

- [ ] Voiceovers for reels: owner records generic tracks per niche; Claude adds a voiceover option picked by the book's theme — Owner + Claude
- [ ] "What you get" carousel slide (page count, sizes, format) and seasonal templates — Claude
- [ ] Decide whether to keep the rendered example media (~3.6 MB) — Owner
- [ ] Monthly `ig-audit` on Instagram insights: what to make more of — Owner + Claude
- [ ] Check Etsy Stats for Instagram traffic; test UTM links — Owner
- [ ] Optimize the profile with `ig-profile` — Owner + Claude
