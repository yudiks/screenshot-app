# Screenshot App — Implementation Plan

## Context

Build a Mac desktop screenshot tool that captures the screen, uploads the image to a backend, then automatically opens a shareable web URL where the user (or anyone with the link) can annotate the screenshot with text, rectangles, circles, and a color picker.

---

## Architecture Overview

```
[Tauri Desktop App]  →  captures screenshot
        │
        │  uploads PNG
        ▼
[Next.js API on Vercel]  →  stores to Vercel Blob  →  returns shareable URL
        │
        │  auto-opens in browser
        ▼
[Next.js Web Page /s/[id]]  →  Konva.js canvas for annotation
```

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Desktop | **Tauri** (Rust + React) | Lightweight (~10 MB), uses native macOS `screencapture` |
| Web frontend | **Next.js (App Router)** | Same repo as API, SSR for fast load |
| Annotation canvas | **Konva.js + react-konva** | Built-in shapes, Transformer handles, React bindings |
| Storage | **Vercel Blob** | One-call upload → permanent public URL |
| Deployment | **Vercel** | Free tier, instant deploys, Blob integration |

---

## Repository Structure

```
screenshot-app/
├── desktop/               # Tauri app
│   ├── src-tauri/
│   │   ├── src/main.rs    # Rust backend — screenshot capture + upload
│   │   └── tauri.conf.json
│   └── src/               # React frontend (minimal: tray icon + trigger)
│       └── App.tsx
└── web/                   # Next.js app
    ├── app/
    │   ├── api/upload/route.ts     # POST: receive PNG → Blob → return URL
    │   └── s/[id]/page.tsx         # Annotation viewer/editor
    ├── components/
    │   ├── AnnotationCanvas.tsx    # Konva stage with tools
    │   ├── Toolbar.tsx             # Tool selector + color picker
    │   └── ShareBar.tsx            # Copy URL button
    └── lib/
        └── blob.ts                 # Vercel Blob helpers
```

---

## Implementation Steps

### 1. Bootstrap Projects

```bash
# Web app
npx create-next-app@latest web --typescript --app --tailwind --yes

# Desktop app
npm create tauri-app@latest desktop -- --template react-ts
```

Link web app to Vercel and provision a Blob store (`vercel blob add`).

### 2. Desktop App — Screenshot + Upload (`src-tauri/src/main.rs`)

- On hotkey trigger (e.g. `Cmd+Shift+4` equivalent via `tauri-plugin-global-shortcut`), invoke macOS `screencapture -i /tmp/shot.png` (interactive region selection)
- Read the PNG file bytes
- POST multipart upload to `https://<your-domain>/api/upload`
- Receive the shareable URL in response
- Call `tauri::api::shell::open(&app.shell_scope(), url, None)` to open browser

Tauri manifest needs: `screencapture` shell access, `http` capability for the upload.

### 3. Web API — Upload Endpoint (`web/app/api/upload/route.ts`)

```ts
import { put } from '@vercel/blob';

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get('file') as File;
  const id = crypto.randomUUID();
  const blob = await put(`screenshots/${id}.png`, file, { access: 'public' });
  return Response.json({ url: `/s/${id}`, blobUrl: blob.url });
}
```

Store the `blobUrl` mapping to `id` — use Vercel KV or encode the blobUrl in the shareable URL as a base64 param (simpler, no DB needed for MVP).

### 4. Shareable Page (`web/app/s/[id]/page.tsx`)

- Decode the screenshot URL from query param or KV lookup
- Render `<AnnotationCanvas imageUrl={screenshotUrl} />`

### 5. Annotation Canvas (`AnnotationCanvas.tsx`)

Use `react-konva`:

- **Stage**: full-window Konva stage
- **Image layer**: load screenshot as `Konva.Image` background (non-interactive)
- **Annotation layer**: user-drawn shapes on top
- **Tools** (in `Toolbar.tsx`):
  - `Text` — click to place, type inline
  - `Rect` — drag to draw rectangle
  - `Circle` — drag to draw ellipse
  - `Select` — click shape to show `Transformer` handles (resize/move)
  - Color picker (native `<input type="color">`)
- **Export button**: `stage.toDataURL()` → download PNG with annotations baked in

### 6. Share Bar (`ShareBar.tsx`)

- Display current URL
- "Copy link" button → `navigator.clipboard.writeText(window.location.href)`
- Optional: "Download annotated" button

---

## Key Dependencies

**Desktop (`desktop/`):**
- `@tauri-apps/api`
- `tauri-plugin-global-shortcut`
- `tauri-plugin-shell` (for `screencapture`)
- `tauri-plugin-http` (for upload)

**Web (`web/`):**
- `konva`, `react-konva`
- `@vercel/blob`
- `tailwindcss`

---

## Verification

1. **Upload API**: `curl -F "file=@screenshot.png" http://localhost:3000/api/upload` → returns JSON with URL
2. **Annotation page**: Open returned URL, verify screenshot loads on canvas
3. **Draw tools**: Draw rect, circle, text in each color → verify they appear and are moveable
4. **Export**: Click download → PNG includes annotations
5. **Desktop end-to-end**: Trigger hotkey in Tauri app → region selector appears → browser opens with annotated page
6. **Shareable URL**: Open URL in incognito → screenshot and canvas load correctly
