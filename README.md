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

## Run from source (dev)

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

## Build a Windows `.exe`

```bash
npm install
npm run dist:win
```

The installer is generated in `release/` as:

- `AI-Screenshots-Setup-<version>.exe`

> Important: run the **Setup** `.exe` installer. Do not run a copied app `.exe` without its packaged runtime files.

## Get the `.exe` from GitHub (recommended)

Do **not** commit `.exe` binaries directly to git history. Use GitHub Actions artifacts/Releases.

### Option A: Manual artifact

1. Push your branch to GitHub.
2. Open **Actions → Build Windows EXE → Run workflow**.
3. Download artifact: `ai-screenshots-installer`.
4. Run `AI-Screenshots-Setup-<version>.exe`.

### Option B: Tagged release

1. Create and push a version tag, e.g. `v0.1.0`.
2. The workflow builds and attaches installer assets to the GitHub Release.
3. Download and run `AI-Screenshots-Setup-<version>.exe` from Releases.

## Install and run on your computer

1. Download `AI-Screenshots-Setup-<version>.exe`.
2. Double-click installer and complete setup.
3. Launch **AI Screenshots** from Start Menu.
4. App minimizes to tray when the window is closed.


## Troubleshooting

### `debug.log` shows `Invalid file descriptor to ICU data received`

This usually means the wrong executable was launched (for example, a copied app `.exe` without its packaged runtime files).

Use this flow:

1. Download and run only `AI-Screenshots-Setup-<version>.exe`.
2. Complete install.
3. Launch the installed app from Start Menu/Desktop shortcut.
4. Do **not** run a loose `.exe` copied out of build folders.

## Next engineering steps

- Integrate bundled local OCR (Tesseract English model) for true image text extraction.
- Add Windows Hello guarded unblur/reveal flow for sensitive regions.
