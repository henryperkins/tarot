Use this exact sequence to deploy your existing [`tarot.jsx`](tarot.jsx:1) UI as a static Vite+React app to Cloudflare Pages using Wrangler.

Prereqs:
- Wrangler installed: `npm install -g wrangler`
- Logged in: `wrangler login`
- You have external endpoints for `/api/tarot-reading` and `/api/tts` (or will update URLs accordingly)

1. Create Vite + React entrypoint

Create `src/main.jsx`:

- Path: [`src/main.jsx`](src/main.jsx:1)
- Content (conceptual):

  - import React and ReactDOM
  - import TarotReading from `./TarotReading.jsx`
  - `ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><TarotReading /></React.StrictMode>);`

Create `src/TarotReading.jsx`:

- Path: [`src/TarotReading.jsx`](src/TarotReading.jsx:1)
- Copy the full contents of [`tarot.jsx`](tarot.jsx:1) into this file.
- Keep `export default function TarotReading() { ... }` at the end.
- Adjust imports to be valid for a Vite+React app (React + lucide-react already included via package.json).

2. Update fetch endpoints (if needed)

In [`src/TarotReading.jsx`](src/TarotReading.jsx:1):

- Replace:
  - `fetch('/api/tarot-reading', ...)`
  - `fetch('/api/tts', ...)`
- With your real backend URLs, for example:
  - `fetch('https://your-backend.example.com/api/tarot-reading', ...)`
  - `fetch('https://your-backend.example.com/api/tts', ...)`

This avoids needing Workers for APIs in this static Pages deployment.

3. Ensure index.html is Vite-compatible

[`index.html`](index.html:1) should have:

- A root element:

  - `<div id="root"></div>`

- The Vite entry script:

  - `<script type="module" src="/src/main.jsx"></script>`

Keep Tailwind CDN if you want the existing classes to render without extra config.

4. Build locally with Vite

From `/home/azureuser/tarot`:

- Install deps:
  - `npm install`
- Run dev (optional to test):
  - `npm run dev`
- Build:
  - `npm run build`

This generates `dist/` with your static assets.

5. Deploy to Cloudflare Pages via Wrangler

Use the `deploy` script wired to Wrangler Pages:

- `npm run deploy`

What this does:

- Runs `wrangler pages deploy dist --project-name=mystic-tarot`
- If `mystic-tarot` Pages project does not exist, Wrangler will guide you to create/select it.
- On success you get a public URL like:
  - `https://mystic-tarot.pages.dev`

6. Summary wiring

- [`tarot.jsx`](tarot.jsx:1) → moved to [`src/TarotReading.jsx`](src/TarotReading.jsx:1)
- [`src/main.jsx`](src/main.jsx:1) mounts `<TarotReading />` into `#root`
- [`index.html`](index.html:1) loads `/src/main.jsx`
- `npm run build` (Vite) → outputs `dist`
- `npm run deploy` (Wrangler) → uploads `dist` to Cloudflare Pages

After this, your tarot app is fully accessible on the web via the Cloudflare Pages URL, using Wrangler for deployment.