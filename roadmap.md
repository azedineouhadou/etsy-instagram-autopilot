# Roadmap

Tick a box (`- [x]`) when a step is done. Claude ticks its own steps when it
finishes them; the owner ticks theirs. **Owner** = you, **Claude** = Claude Code.

Current focus: **Push phases 1–2 → first real book → Phase 3**

---

## Phase 0 — Setup & decisions

- [x] Create the GitHub repo and clone it — Owner
- [x] Install the instagram-agent plugin for the repo — Owner
- [x] Finalize `brand/voice.md` — Owner
- [x] Link `~/.claude/instagram/voice.md` to `brand/voice.md` — Claude
- [ ] Push phases 1–2 (`setup/foundation-and-templates` branch → PR → merge) — Owner
- [ ] Approve the brand look in `brand/brand.json` (colours, fonts, pink tape, dark CTA button), add logo if any — Owner
- [ ] Decide on music for reels: royalty-free source, or silent for now — Owner
- [ ] Decide whether to keep the rendered example media in the repo (~3.6 MB) — Owner
- [ ] Decide on the extra "What you get" carousel slide — Owner

## Phase 1 — Foundation ✅

- [x] Node + TypeScript project, `.gitignore`, `.env` / `.env.example` — Claude
- [x] `product.json` and `post.json` formats — Claude
- [x] Validator (`npm run validate`) — Claude
- [x] Rotation rules: 3-day gap, max 2 per book per week, counts published history — Claude
- [x] Carousel rule: 2–6 slides, aim for 5–6 — Claude
- [x] Sample product and posts in `examples/` — Claude

## Phase 2 — Templates & rendering ✅

- [x] Brand theme, fonts, shared visuals — Claude
- [x] `spotlight` single-image template — Claude
- [x] `carousel` template (cover / page / CTA slides) — Claude
- [x] `page-flip-reel` Remotion template, kept clear of Instagram's bottom overlay — Claude
- [x] `npm run render` → writes media and fills `post.json` — Claude
- [x] Book intake: folder + `link.txt` → `npm run intake` → Claude writes `product.json` — Claude
- [x] `README.md` newcomer guide and `CLAUDE.md` procedures — Claude

## Phase 2.5 — First real book

- [ ] Add the first book folder (`link.txt`, `mockups/`, `interior/`) on a new branch — Owner
- [ ] "process new books" → check `product.json` facts — Owner + Claude
- [ ] Render one post of each template with the real book — Claude
- [ ] Tune the templates on real artwork (sizes, crops, colours) — Claude
- [ ] Approve the real renders — Owner
- [ ] Add the rest of the catalog (can continue in the background) — Owner

## Phase 3 — Publisher (dry run, nothing sent)

- [ ] Instagram API client: image, carousel and reel containers → wait for processing → publish — Claude
- [ ] Pick due posts: `approved: true` and `scheduledAt` passed, oldest first — Claude
- [ ] `--dry-run` mode that prints every request without sending — Claude
- [ ] After publishing: move the post to `published/`, record publish time and Instagram media ID — Claude
- [ ] Safety: daily publish limit check, clear errors, a failed post never blocks the others — Claude
- [ ] Dry run on the examples shows the expected requests — Claude
- [ ] Review the dry-run output — Owner

## Phase 4 — Meta & Instagram setup

- [ ] Instagram account is Professional (Business or Creator) — Owner
- [ ] Meta developer account + app with "API setup with Instagram login" — Owner
- [ ] Generate a long-lived token; fill `.env` (never share it in chat) — Owner, Claude guides
- [ ] Set the bio link to the Etsy shop — Owner
- [ ] First real test post: one single image, published manually from the script — Owner says go, Claude runs
- [ ] Confirm: Instagram accepts the GitHub media URLs — Claude
- [ ] Test a carousel and a reel; confirm a reel without audio is accepted — Claude
- [ ] Check on a phone that reel text clears Instagram's bottom overlay — Owner

## Phase 5 — Automation (GitHub Actions)

- [ ] Add repo secrets (Instagram keys, `GH_SECRETS_TOKEN`) in GitHub settings — Owner
- [ ] Publish workflow on a cron — Claude
- [ ] Token refresh workflow (~every 50 days) — Claude
- [ ] Failure notification (GitHub email on failed run) — Claude
- [ ] One scheduled post goes out with nobody at the keyboard — Owner + Claude

## Phase 6 — Weekly routine

- [ ] One command/prompt for the weekly batch (plan → write → render → validate) — Claude
- [ ] First real week: 4–5 posts generated, reviewed, merged — Owner + Claude
- [ ] Adjust the routine after the first week (timing, mix, tone) — Owner + Claude

## Later (optional)

- [ ] Monthly `ig-audit` on Instagram insights: what to make more of — Owner + Claude
- [ ] Check Etsy Stats for Instagram traffic; test UTM links — Owner
- [ ] More templates (seasonal, "what you get" slide, before/after coloring) — Claude
- [ ] Optimize the profile with `ig-profile` — Owner + Claude
