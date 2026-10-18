# Phase 4 — Meta & Instagram setup

What you need by the end: three values in `.env` and one real test post.

| `.env` key | Where it comes from | Step |
|---|---|---|
| `INSTAGRAM_ACCESS_TOKEN` | App Dashboard → **Generate token** | 8 |
| `INSTAGRAM_USER_ID` | `npm run ig:whoami` | 10 |
| `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` | App Dashboard → Instagram setup page | 6 |

Time: about 20–30 minutes. Meta changes its dashboard often, so menu names may
differ slightly — the order of steps stays the same.

> **Avoid old tutorials** that mention the **"Instagram Basic Display API"** —
> Meta shut it down in December 2024. You want **"Instagram API with Instagram
> Login"** (also shown as "API setup with Instagram business login").

> **Never paste the token or app secret into chat, a commit, an issue or a
> screenshot.** They only go in `.env` (and, in phase 5, GitHub secrets). If one
> leaks, generate a new token right away.

---

## A. Instagram account

- [ ] **1. Make it a professional account.** In the Instagram app: Profile →
  ☰ → *Settings and activity* → *Account type and tools* → *Switch to
  professional account* → choose **Business** (or Creator) → category e.g.
  "Shopping & retail". The account must be **public**.
- [ ] **2. Set the bio link** to `https://www.etsy.com/shop/PixoraPrintsCrafts`
  (Profile → *Edit profile* → *Links*). Every post says "Link in bio".

## B. Meta developer account

- [ ] **3. Register as a developer.** Go to <https://developers.facebook.com>,
  click **Get started** / **Log in**, sign in with Facebook, and confirm your
  email/phone when asked.

## C. Create the app

- [ ] **4. Create the app.** **My Apps** → **Create app**.
  - Name: something neutral like `Pixora Autopilot` — guides warn that names
    containing "Instagram" or "Facebook" can be rejected.
  - Use case: **Manage messaging & content on Instagram** if offered, otherwise
    **Other**.
  - App type: **Business**. (Meta's docs: the Instagram Login API needs a
    Business-type app.)
  - Business portfolio: you can skip it / choose "I don't want to connect".
- [ ] **5. Add Instagram.** On the app dashboard, find **Instagram** → **Set up**,
  then open **API setup with Instagram business login** in the left menu.
  Don't pick the *Facebook Login* variant — that one is for Facebook Pages.
- [ ] **6. Copy the app ID and secret** shown at the top of that page
  (**Instagram app ID**, **Instagram app secret** → *Show*) into `.env` as
  `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET`.

## D. Connect your Instagram account

- [ ] **7. Give your account a role on the app** (if the dashboard asks for it).
  **App roles** → **Roles** → **Add people** → **Instagram Tester** → enter
  `pixoraprintscrafts`. Then accept in Instagram: *Settings and activity* →
  *Website permissions* / *Apps and websites* → **Tester invites** → Accept.
  Recent guides disagree on whether this is still required — if step 8 works
  without it, skip it.
- [ ] **8. Generate the token.** Back on **API setup with Instagram business
  login** → section **1. Generate access tokens** → **Add account** → log in
  to Instagram → allow the permissions (they should include
  `instagram_business_basic` and `instagram_business_content_publish`) →
  **Generate token** → copy it.
- [ ] **9. Save it.** Open `.env` and paste it after `INSTAGRAM_ACCESS_TOKEN=`.
  Check `INSTAGRAM_API_VERSION=v25.0` is there too (copy it from
  `.env.example` if not).
- [ ] **10. Get your account ID.** In the repo folder run:

  ```bash
  npm run ig:whoami
  ```

  It should print `✓ Token works for @pixoraprintscrafts (Business)` and a line
  `INSTAGRAM_USER_ID=…` — copy that line into `.env`.

Tokens from the dashboard last **60 days**. Phase 5 adds a job that refreshes
them automatically; until then, note the date you generated it.

## E. First real test post — with Claude

- [ ] **11. Tell Claude "phase 4 keys are in".** Claude prepares one single-image
  post from the autumn book in `queue/` and shows it to you.
- [ ] **12. Merge it to `main`.** Instagram downloads the image from the public
  repo, so the post must be merged before publishing.
- [ ] **13. Say "yes, publish it live".** Claude runs
  `npm run publish -- --live --max 1` — only after your yes.
- [ ] **14. Check on your phone:** image, caption, hashtags and the Etsy link in bio.
- [ ] **15. Repeat for a carousel and a reel.** The reel test also answers
  whether Instagram accepts a reel without music, and whether the text clears
  Instagram's buttons and caption at the bottom.

---

## Troubleshooting

| Problem | Likely fix |
|---|---|
| No **Instagram** product / only Facebook Login options | The app isn't Business type — create a new app and pick **Business** |
| **Generate token** button missing or greyed out | Do step 7 (Instagram Tester role + accept the invite), then reload |
| Token error: "Invalid OAuth access token" | Copied with a space or cut short — generate again and re-paste |
| `npm run ig:whoami` shows `account_type` other than Business/Creator | Redo step 1 |
| "The user is not an Instagram Business" when publishing | Account is personal or private — step 1 |
| "Media download has failed" / "Only photo or video can be accepted" | The post isn't merged to `main` yet, or the file isn't JPEG/MP4 |
| "Application request limit reached" | Wait an hour; we post at most 2 per run |

## Notes

- **App review:** Meta's docs say App Review is needed for *Advanced Access*.
  Publishing only to your own account, which has a role on the app, should
  work without it — this is the part to confirm in step 13.
- Written guides used to cross-check these steps (dashboards change, so trust
  what you see over any screenshot):
  [Meta — Instagram Platform](https://developers.facebook.com/documentation/instagram-platform/create-an-instagram-app),
  [Bricks Academy](https://academy.bricksbuilder.io/integrations/instagram-access-token/),
  [WP Social Ninja](https://wpsocialninja.com/instagram-access-token/),
  [The Plus Addons (2026)](https://theplusaddons.com/blog/get-instagram-access-token/).
