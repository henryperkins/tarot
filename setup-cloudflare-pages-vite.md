This guide shows exactly how to turn [`tarot.jsx`](tarot.jsx:1) into a static Vite+React app deployable on Cloudflare Pages, using your own existing `/api/tarot-reading` and `/api/tts` endpoints.

Final result: You get a URL like https://your-project.pages.dev that serves the Mystic Tarot UI.

Target structure:

- [`index.html`](index.html:1)
- `src/`
  - [`main.jsx`](src/main.jsx:1)
  - [`TarotReading.jsx`](src/TarotReading.jsx:1)
- [`vite.config.js`](vite.config.js:1)
- [`package.json`](package.json:1)

Step 1: Move the component into src

1. Create `src` directory.
2. Move the tarot component into [`src/TarotReading.jsx`](src/TarotReading.jsx:1):

- Copy the full content of [`tarot.jsx`](tarot.jsx:1) into `src/TarotReading.jsx`.
- Ensure it has:
  - `import React, { ... } from 'react';`
  - `import { Sparkles, RotateCcw, Moon, Sun, Star } from 'lucide-react';`
  - `export default function TarotReading() { ... }`
- Delete the old root-level [`tarot.jsx`](tarot.jsx:1) after verifying.

Step 2: Create src/main.jsx

[`src/main.jsx`](src/main.jsx:1):

- Imports React, ReactDOM, and TarotReading, then mounts into #root.

Implementation:

- `import React from 'react';`
- `import ReactDOM from 'react-dom/client';`
- `import TarotReading from './TarotReading.jsx';`
- `ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><TarotReading /></React.StrictMode>);`

Step 3: Update index.html for Vite

[`index.html`](index.html:1):

- Keep `<div id="root"></div>`.
- Load `/src/main.jsx` as type="module".
- Tailwind via CDN is optional; your component currently uses Tailwind-style classes, so include the CDN for simplicity unless you want a full Tailwind build config.

Key bits:

- `<div id="root"></div>`
- `<script type="module" src="/src/main.jsx"></script>`

Step 4: Add package.json

[`package.json`](package.json:1) minimal:

- `name`, `version`
- `dependencies`: `react`, `react-dom`, `lucide-react`
- `devDependencies`: `vite`, `@vitejs/plugin-react`
- `scripts`: `"dev"`, `"build"`, `"preview"`

Step 5: Add vite.config.js

[`vite.config.js`](vite.config.js:1) minimal:

- Use `@vitejs/plugin-react`.
- Export `defineConfig({ plugins: [react()] })`.

Step 6: Configure your API URLs

Your component calls:

- `/api/tarot-reading`
- `/api/tts`

Because this is static Pages:

- These paths must hit:
  - Cloudflare Pages Functions (if you add them later), or
  - Your own external APIs via rewrites or absolute URLs.

Simplest (you said you already have endpoints):

- Change fetch calls inside [`src/TarotReading.jsx`](src/TarotReading.jsx:1) from `'/api/tarot-reading'` and `'/api/tts'` to your absolute URLs.
- That way the static app directly talks to your existing backend.

Step 7: Deploy to Cloudflare Pages

1. Push this project to a Git repo (GitHub/GitLab/etc.).
2. In Cloudflare Pages:
   - New Project → Connect to your repo.
   - Framework preset: "Vite".
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Cloudflare builds with Vite and serves the static `dist` directory at your Pages URL.

At that point:

- Visiting the Pages URL loads `index.html`.
- Vite bundle runs [`src/main.jsx`](src/main.jsx:1).
- [`TarotReading`](src/TarotReading.jsx:1) renders and calls your configured `/api/*` endpoints.