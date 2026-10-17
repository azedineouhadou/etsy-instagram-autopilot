# Queue

Posts waiting to publish. Claude fills this during the weekly batch; you review
it in the PR and merge.

```
queue/<YYYY-MM-DD>-<slug>/
  post.json     type, listing ID, schedule, caption, approval flag
  render.json   template + on-image text and which product images to use
  media/        rendered PNG(s) or MP4 — output of npm run render, don't edit
```

Templates (`render.json` → `template`):

| Template | Output | Use for |
|---|---|---|
| `spotlight` | 1 image, 1080×1350 | new listing, seasonal push |
| `carousel` | 2–6 slides (5–6 recommended), 1080×1350 | cover → pages → CTA |
| `page-flip-reel` | MP4 1080×1920 + cover | hook → pages flying in → CTA |

`npm run render` renders every post that has a `render.json` and writes the
`media` field in its `post.json`. Add `--post <folder>` to render just one.
See `examples/queue/` for one of each.

- Only posts with `"approved": true` publish. Set it to `false` in the PR to hold one back.
- `scheduledAt` needs an explicit offset, e.g. `2026-11-02T18:00:00+01:00`.
- After publishing, the post moves to `published/`.

Run `npm run validate` before opening the PR. See `examples/queue/` for samples.
