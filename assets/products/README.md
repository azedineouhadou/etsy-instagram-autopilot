# Product library

One folder per Etsy listing. Posts are built only from what is in here, so a book
that isn't in the library can't be featured.

## Add a book

```
assets/products/<any name>/
  link.txt     the Etsy listing link, pasted as-is
  mockups/     1–3 images: cover and lifestyle mockups
  interior/    3–10 images: sample inside pages
```

Then tell Claude "process new books". `npm run intake` renames the folder to
`<listingId>-<slug>`, and Claude reads the listing in Chrome and writes
`product.json`. Check the facts in it, then run `npm run validate`.

Full instructions: README.md, section 3.
