# AI Screenshots App (Windows MVP)

Offline-first Windows desktop app that captures screenshots, indexes local metadata/text, and returns top-5 matches.

## Implemented now

- Windows-focused Electron + React desktop app.
- System tray app with close-to-tray behavior.
- Global hotkey handler for `Win + Shift + S` (`Super+Shift+S`).
- Capture modes: region, fullscreen, window.
- Auto-import from `Pictures/Screenshots` on startup.
- Local SQLite storage with FTS5 lexical search.
- Hybrid ranking (FTS + local hash-embedding cosine scoring).
- Top-5 search results dashboard.
- Priority processing queue (high/normal/low).
- Sensitive-token detection from indexed text.

## Local indexing behavior

For each screenshot path, the app indexes:

1. normalized filename tokens,
2. optional local sidecar text (`image.png.txt` or `image.txt`) when present.

This keeps processing fully offline and improves search quality without cloud APIs.

## Quick start

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

## Next engineering steps

- Integrate bundled local OCR (Tesseract English model) for true image text extraction.
- Add Windows Hello guarded unblur/reveal flow for sensitive regions.
- Add Windows packaging (`.exe`) pipeline.
