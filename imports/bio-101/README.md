# BIO 101 chapters 1–7

Extracted from the scanned `BIO CH.1-7 .pdf` (63 pages, no text layer) by rendering pages and authoring ScholAu lessons directly. Gemini ingestion was not used.

- Notes: [extracted/NOTES.md](extracted/NOTES.md)
- Page map: [page-map.json](page-map.json)
- Import rows: [../../supabase/content/bio-101-chapters-1-7-lessons-20261031.json](../../supabase/content/bio-101-chapters-1-7-lessons-20261031.json)

Rebuild JSON:

```
python scripts/build-bio101-lessons.py
```

Import and publish (also uploads the PDF as a course download):

```
node --env-file=apps/web/.env.local scripts/import-bio101-lessons.mjs
```
