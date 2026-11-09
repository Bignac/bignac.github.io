# bignac

A browser-based media studio for real-time image/video cutout, greenscreen, and audio extraction. Everything runs locally — your media never leaves the machine.

## What it does

- **Image cutout** — upload a photo, get a transparent-background PNG (via @imgly/background-removal with MediaPipe selfie segmenter fallback)
- **Video live cutout** — upload a video, watch real-time per-frame cutout (MediaPipe WASM)
- **Greenscreen** — composite the cutout over a solid colour (chroma key, pure green, mint, ink, white, pink, or custom)
- **Audio extraction** — pull the audio track out of a video as WAV
- **Export** — transparent PNG, greenscreen video (WebM), or audio (WAV)

## Local development

```bash
npm install
npm run dev -- --host 127.0.0.1
```

Open  in Chrome (GPU acceleration recommended).

## Build

```bash
npm run build
```

Outputs a self-contained `dist/` directory.

## Deploy to Cloudflare Pages

1. Push this repo to GitHub.
2. In Cloudflare Pages, create a new project pointing at the repo.
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node version: 20 (or later)
3. Save & deploy. The site is live at `https://<project-name>.pages.dev`.

The `base: './'` in `vite.config.ts` ensures all asset paths are relative, so the site works from any sub-path on Cloudflare Pages.

## Project structure

```
├── index.html            # Entry point
├── vite.config.ts        # Vite config (react plugin, base: './')
├── package.json
├── src/
│   ├── App.tsx           # Main app shell and state
│   ├── App.css           # Full Canva-style styling
│   ├── index.css         # Base theme (font, selection, scrollbar)
│   ├── components/
│   │   ├── ui.tsx        # Shared UI primitives (BackdropPicker, etc.)
│   │   ├── Inspector.tsx # Right-panel inspector
│   │   ├── ExportModal.tsx
│   │   └── VideoStage.tsx # Live video cutout + export
│   ├── lib/
│   │   ├── utils.ts      # Video metadata loading, duration helpers
│   │   ├── segmentation.ts # MediaPipe segmentation pipeline
│   │   ├── backgroundRemoval.ts # @imgly/background-removal wrapper
│   │   ├── audio.ts      # Web Audio → WAV extraction
│   │   ├── video.ts      # Video helpers
│   │   └── compose.ts    # Greenscreen compositing
│   └── main.tsx
├── public/
│   ├── models/           # selfie_segmenter.tflite
│   ├── mediapipe/wasm/   # MediaPipe WASM runtime
│   ├── favicon.svg
│   └── icons.svg
└── test/
    ├── fixtures/         # sample-person.jpg, sample-person.webm
    ├── test-image.cjs    # Playwright-core image cutout test
    ├── test-video.cjs    # Video test
    └── make-video.cjs    # Generate test video from image
```

## Notes

- Media never leaves the machine — all processing is client-side.
- MediaPipe WASM and model files are shipped in `public/` and included in the build.
- The greenscreen backdrop colours (Chroma, Pure, Mint, Ink, White, Pink) are functional feature colours, not UI chrome.
