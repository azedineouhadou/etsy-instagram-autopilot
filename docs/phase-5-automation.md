# Phase 5 — Automation on GitHub Actions

After this phase, merging an approved post into `main` is all it takes: GitHub
publishes it at its `scheduledAt` time and records the result in the repo.

| Workflow | When | What it does |
|---|---|---|
| **Publish due posts** (`.github/workflows/publish.yml`) | Every hour at :17 | Publishes up to 2 due, approved posts, moves them to `published/` and commits that back to `main` |
| **Refresh Instagram token** (`.github/workflows/refresh-token.yml`) | Mondays 04:23 UTC | Swaps the Instagram token for a fresh 60-day one and saves it as a secret |

Both can also be started by hand from the **Actions** tab (**Run workflow**).
Manual publish runs default to **dry-run**.

Time: about 15 minutes.

---

## 1. Create `GH_SECRETS_TOKEN`

The refresh job has to overwrite a secret, and GitHub's built-in token isn't
allowed to do that — so it needs this one.

- [ ] GitHub → your profile picture → **Settings** → **Developer settings** →
  **Personal access tokens** → **Fine-grained tokens** → **Generate new token**
- [ ] **Name:** `etsy-instagram-autopilot secrets` · **Expiration:** 1 year
  (put a reminder in your calendar a week before)
- [ ] **Repository access:** *Only select repositories* → `etsy-instagram-autopilot`
- [ ] **Permissions** → *Repository permissions* → **Secrets: Read and write**
  (nothing else)
- [ ] **Generate token** and keep the page open for step 2

## 2. Add the secrets

Repo on GitHub → **Settings** → **Secrets and variables** → **Actions**.

**Secrets** tab → **New repository secret**, one per row (copy values from
your `.env`; nothing gets pasted anywhere else):

- [ ] `INSTAGRAM_USER_ID` = the number from `npm run ig:whoami`
- [ ] `INSTAGRAM_ACCESS_TOKEN` = the token in `.env`
- [ ] `GH_SECRETS_TOKEN` = the token from step 1

**Variables** tab → **New repository variable** (optional — `v25.0` is the default):

- [ ] `INSTAGRAM_API_VERSION` = `v25.0`

`INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET` are **not** needed on GitHub.

## 3. Check repo settings

- [ ] **Settings** → **Actions** → **General** → *Workflow permissions*: if a
  run later fails at "Save results to the repo" with a 403, select
  **Read and write permissions** and save.
- [ ] **Branch protection:** if you protected `main` (Settings → Branches /
  Rules), the bot's commits will be refused. Either allow
  **github-actions** to bypass, or tell Claude so it can switch to a
  different approach.
- [ ] **Failure emails:** GitHub → your profile picture → **Settings** →
  **Notifications** → *Actions* → tick **Email** and **Only notify for failed
  workflows**.

## 4. Merge and test

- [ ] Merge the phase 5 PR. Scheduled workflows only run from `main`.
- [ ] **Actions** tab → **Publish due posts** → **Run workflow** → mode
  **dry-run** → open the run. It should end with `Nothing due.` (or list what
  would be sent) and **Save results to the repo** should say
  `Nothing published, nothing to save`.
- [ ] **Actions** tab → **Refresh Instagram token** → **Run workflow**. It
  should print `✓ Token refreshed, valid for 60 more days` and
  `✓ Secret updated`. If it says the token is too new, wait until it's over
  24 hours old and run it again.
- [ ] Ask Claude for one real post scheduled a few hours ahead, merge it, and
  check that it goes out on its own — the last step of phase 5.

---

## Good to know

- **Timing:** GitHub's scheduler can run late, sometimes by 10–30 minutes at
  busy times. A post goes out at the first hourly run after its
  `scheduledAt`, so treat times as "around".
- **Your local `.env` token** isn't refreshed — only the GitHub secret is. It
  expires 60 days after you generated it. That's fine: publishing now happens
  on GitHub, and dry runs need no token. Generate a new one only if you want
  to publish from your computer again.
- **Inactivity:** GitHub pauses scheduled workflows in repos with no activity
  for 60 days. Your weekly post PRs keep it active; if it ever pauses, the
  Actions tab shows an **Enable workflow** button.
- **Cost:** Actions on public repositories run on GitHub's free standard
  runners.
- **Holding a post after merging:** set `"approved": false` in its `post.json`
  in a new PR, or delete its folder from `queue/`.
