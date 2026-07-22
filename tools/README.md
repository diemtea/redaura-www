# Redaura translation pipeline

`landing/locales/en.json` is the **only** file you edit. Everything else is generated.

## Workflow

1. Add or change English copy in `landing/index.html` (give new elements a
   `data-i18n="my.key"` attribute) and add the string to `locales/en.json`.
2. Run `DEEPL_API_KEY=xxx node tools/translate.mjs`.
   Only new/changed keys are sent (each locale file remembers the English it
   was translated from under `__source`). `--force` retranslates everything.
3. Done — the nav and in-app pickers read `locales/manifest.json`, which the
   script regenerates, so new languages appear automatically.

## CI (zero manual steps)

```yaml
# .github/workflows/translate.yml
name: Auto-translate
on:
  push:
    paths: ['landing/locales/en.json']
jobs:
  translate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: node tools/translate.mjs
        env: { DEEPL_API_KEY: ${{ secrets.DEEPL_API_KEY }} }
      - uses: stefanzweifel/git-auto-commit-action@v5
        with: { commit_message: 'chore: auto-translate locales' }
```

## SEO note

The runtime sets `<html lang>` dynamically and detects the browser language,
which covers accessibility and on-page semantics. For *indexed* localized SEO,
search engines need one URL per language — generate static copies at deploy
time (e.g. `/nl/index.html` with the dict baked in) and emit
`<link rel="alternate" hreflang="…">` pairs. The locale JSONs produced here are
exactly the input that generator needs.
