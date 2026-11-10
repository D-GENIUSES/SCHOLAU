# PHY 101 Chapters 1–4

Source: `PHY 101 CH 1-4.pdf` (67 scanned pages, no text layer, ~31 MB).

Gemini inline ingestion rejects the full file, so pages were recompressed and split:

| File | Pages |
|------|-------|
| `PHY101-CH-part1-p1-16.pdf` | 1–16 |
| `PHY101-CH-part2-p17-33.pdf` | 17–33 |
| `PHY101-CH-part3-p34-50.pdf` | 34–50 |
| `PHY101-CH-part4-p51-67.pdf` | 51–67 |

Ingest + publish:

```
node --env-file=apps/web/.env.local apps/web/scripts/run-phy101-ingestion.mjs
```
