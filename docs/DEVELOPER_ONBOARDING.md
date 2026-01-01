# Developer Onboarding Guide: Mystic Tarot

## 0. Environment Bootstrap

1. Copy `.dev.vars.example` to `.dev.vars` and fill in the Azure OpenAI, Anthropic, and vision secrets. This is the single source of truth for local development values—never commit the populated file.
2. Run `npm run config:check` anytime the secret list changes. The script inspects `.dev.vars` and your shell environment, failing fast if a required entry (e.g., `VISION_PROOF_SECRET`) is missing.
3. When you're ready to deploy, mirror the same keys with `wrangler secret put <NAME> --config wrangler.jsonc` (see `wrangler.jsonc` for bindings + non-secret vars).

## 1. The Scaffold & Stack Audit

**Build & Environment**

- **Build Tool:** [Vite](https://vitejs.dev/) (vite.config.js) is used for fast development and bundling.
- **Package Manager:** npm (inferred from package.json scripts).
- **CSS Framework:** [Tailwind CSS](https://tailwindcss.com/) (tailwind.config.js, postcss.config.cjs) is the primary styling engine.
- **Icons:** `lucide-react` provides the icon set.

**UI Framework**

- **Core:** React 18 (main.jsx).
- **Styling:** Utility-first CSS via Tailwind. Custom styles and animations are defined in tarot.css and tailwind.css.

**Entry Point & Layout**

- **Entry:** main.jsx is the application bootstrapper. It mounts the React root, initializes the `AuthProvider`, and sets up the `BrowserRouter`.
- **Layout:** There is no single global layout component wrapping all routes. Instead, individual page components like TarotReading.jsx and Journal.jsx implement their own layout structures, sharing common components like `GlobalNav`.

## 2. Routing & Navigation Map

**Router Configuration**

- **Library:** `react-router-dom` (main.jsx).
- **Strategy:** Client-side routing defined in the main entry file.

**Primary Routes**
| URL Path | Component | Description |
| :--- | :--- | :--- |
| `/` | TarotReading.jsx | **Core Experience.** Handles deck selection, spread choice, card drawing, and reading generation. |
| `/journal` | Journal.jsx | **User History.** Displays saved readings, filtering, and insights analysis. |
| `/share/:token` | ShareReading.jsx | **Social.** Read-only view for shared readings with collaborative notes. |
| `*` | TarotReading.jsx | **Fallback.** Redirects unknown routes back to the main reading experience. |

## 3. State Management Forensics

**Global State**

- **Context API:** Used sparingly.
  - **`AuthContext`** (AuthContext.jsx): Manages user session, login/register/logout methods, and loading state. Wraps the entire application in main.jsx.

**Server State & Data Fetching**

- **Strategy:** Custom hooks with `fetch` and local `useState`/`useEffect`. No dedicated library like TanStack Query is currently used.
- **Persistence:**
  - **Cloudflare D1:** Primary database for authenticated users.
  - **LocalStorage:** Fallback storage for unauthenticated users (handled within `useJournal`).

**Providers**
The application root in main.jsx is wrapped by:

1.  `React.StrictMode`
2.  `AuthProvider` (Supplies `user`, `isAuthenticated`, `login`, `register`)
3.  `BrowserRouter` (Routing context)

## 4. Component Hierarchy & Patterns

**Directory Structure**

- **components**: Mixed collection of presentational (dumb) and container (smart) components.
- **pages**: Contains route-specific views (e.g., ShareReading.jsx).
- **hooks**: Custom React hooks.
- **lib**: Pure JavaScript business logic (audio, deck math, formatting).
- **contexts**: React Context definitions.

**Component Patterns**

- **Smart (Container) Components:**
  - TarotReading.jsx: The massive orchestrator. Manages the entire state machine of a reading (shuffling, dealing, revealing, API calls).
  - Journal.jsx: Manages fetching entries, filtering logic, and switching between local/cloud storage.
- **Dumb (Presentational) Components:**
  - `Card.jsx`: Renders the visual tarot card (front/back).
  - `ReadingGrid.jsx`: Layout engine for different spreads (Celtic Cross, etc.).
  - `SpreadSelector.jsx`: UI for choosing spread types.
- **Shared Primitives:**
  - `GlobalNav.jsx`: Navigation bar used across top-level views.

## 5. Business Logic Extraction

**Key Custom Hooks**

1.  **`useJournal`** (useJournal.js):
    - **Purpose:** A hybrid storage hook. It abstracts away the complexity of saving data to either the Cloudflare API (if logged in) or LocalStorage (if anonymous). It also handles data migration from local to cloud.
2.  **`useVisionValidation`** (useVisionValidation.js):
    - **Purpose:** Manages the "Vision Mode" pipeline. It handles image file selection, conversion to Data URLs, and communication with the vision backend to validate physical card spreads.
3.  **`useAuth`** (AuthContext.jsx):
    - **Purpose:** Exposes authentication state and methods. It simplifies the consumption of the `AuthContext` throughout the app.

**Critical Non-Hook Logic**

- **Audio Engine** (audio.js): A singleton module that manages the `Audio` API directly. It handles sound effects (card flips), ambience loops, and the complex state of Text-to-Speech (TTS) playback, including caching and unlocking audio contexts on mobile.
