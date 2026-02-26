# Developer Onboarding Guide: Mystic Tarot

## 0. Environment Bootstrap

1. Ensure `.dev.vars` exists (create it if needed) and fill in the Azure OpenAI, Anthropic, and vision secrets. This is the single source of truth for local development values—never commit the populated file.
2. Run `npm run config:check` anytime the secret list changes. The script inspects `.dev.vars` and your shell environment, failing fast if a required entry (e.g., `VISION_PROOF_SECRET`) is missing.
3. When you're ready to deploy, mirror the same keys with `wrangler secret put <NAME> --config wrangler.jsonc` (see `wrangler.jsonc` for bindings + non-secret vars).

## 1. The Scaffold & Stack Audit

**Build & Environment**

- **Build Tool:** [Vite](https://vitejs.dev/) (vite.config.js) is used for fast development and bundling.
- **Package Manager:** npm (inferred from package.json scripts).
- **CSS Framework:** [Tailwind CSS](https://tailwindcss.com/) (tailwind.config.js, postcss.config.cjs) is the primary styling engine.
- **Icons:** `@phosphor-icons/react` provides the icon set.

**UI Framework**

- **Core:** React 18 (main.jsx).
- **Styling:** Utility-first CSS via Tailwind. Custom styles and animations are defined in tarot.css and tailwind.css.

**Entry Point & Layout**

- **Entry:** main.jsx is the application bootstrapper. It mounts the React root, wires up `AuthProvider`, `SubscriptionProvider`, `PreferencesProvider`, `ReadingProvider`, and `ToastProvider`, and renders `BrowserRouter` with `SkipLink` + `AnimatedRoutes`.
- **Layout:** There is no single global layout component wrapping all routes. Instead, route components compose their own layout structures, with transitions handled by `AnimatedRoutes` + `PageTransition`.

## 2. Routing & Navigation Map

**Router Configuration**

- **Library:** `react-router-dom` (main.jsx).
- **Strategy:** Client-side routing defined in `AnimatedRoutes.jsx` and rendered from `main.jsx`.

**Primary Routes**
| URL Path | Component | Description |
| :--- | :--- | :--- |
| `/` | TarotReading.jsx | **Core Experience.** Handles deck selection, spread choice, card drawing, and reading generation. |
| `/journal` | Journal.jsx | **User History.** Displays saved readings, filtering, and insights analysis. |
| `/journal/gallery` | CardGalleryPage.jsx | **Gallery.** Browse card art and gallery views. |
| `/pricing` | PricingPage.jsx | **Subscription.** Plan selection and upgrades. |
| `/account` | AccountPage.jsx | **Account.** Profile, subscription status, and settings. |
| `/admin` | AdminDashboard.jsx | **Admin.** Quality metrics and operational dashboards. |
| `/share/:token` | ShareReading.jsx | **Social.** Read-only view for shared readings with collaborative notes. |
| `/reset-password` | ResetPasswordPage.jsx | **Auth.** Password reset flow. |
| `/verify-email` | VerifyEmailPage.jsx | **Auth.** Email verification flow. |
| `*` | TarotReading.jsx | **Fallback.** Redirects unknown routes back to the main reading experience. |

## 3. State Management Forensics

**Global State**

- **Context API:** Used for app-wide state and gating.
  - **`AuthContext`** (AuthContext.jsx): Manages user session, login/register/logout, and loading state. Wraps the entire application in main.jsx.
  - **`SubscriptionContext`** (SubscriptionContext.jsx): Normalizes tiers/status, provides entitlements and gating helpers.
  - **`PreferencesContext`** (PreferencesContext.jsx): Stores reading preferences, audio choices, personalization, and onboarding nudges.
  - **`ReadingContext`** (ReadingContext.jsx): Coordinates the current reading state, streaming, and vision telemetry.
  - **`ToastContext`** (ToastContext.jsx): Global notifications.
  - Auth endpoints return `503` with `db_not_initialized` for login/register/me when D1 tables are missing; logout is a no-op that returns `200` with `skipped: true` and clears the cookie.

**Server State & Data Fetching**

- **Strategy:** Custom hooks with `fetch` and local `useState`/`useEffect`. No dedicated library like TanStack Query is currently used.
- **Persistence:**
  - **Cloudflare D1:** Primary database for authenticated users.
  - **LocalStorage:** Fallback storage for unauthenticated users (handled within `useJournal`).

**Providers**
The application root in main.jsx is wrapped by:

1.  `React.StrictMode`
2.  `AuthProvider` (Supplies `user`, `isAuthenticated`, `login`, `register`)
3.  `SubscriptionProvider` (Tier and entitlement helpers)
4.  `PreferencesProvider` (Personalization, audio, and UI preferences)
5.  `ReadingProvider` (Reading state + vision telemetry)
6.  `ToastProvider` (Global notifications)
7.  `BrowserRouter` (Routing context)
8.  `SkipLink` + `AnimatedRoutes`

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
2.  **`useVisionAnalysis`** (useVisionAnalysis.js):
    - **Purpose:** Coordinates optional vision research uploads, proof signing, and mismatch detection for readings. The UI panel uses `useVisionValidation` for local CLIP analysis.
3.  **`useAuth`** (AuthContext.jsx):
    - **Purpose:** Exposes authentication state and methods. It simplifies the consumption of the `AuthContext` throughout the app.

**Critical Non-Hook Logic**

- **Audio Engine** (audio.js): A singleton module that manages the `Audio` API directly. It handles sound effects (card flips), ambience loops, and the complex state of Text-to-Speech (TTS) playback, including caching and unlocking audio contexts on mobile.

## 6. Next Steps

Once you're comfortable with the codebase structure:

1. **Run the dev server**: `npm run dev:vite` starts both Vite and Wrangler.
2. **Explore the main flow**: Start at `TarotReading.jsx` and trace through spread selection → card draw → API call → narrative display.
3. **Check tests**: `npm test` runs unit tests; `npm run test:e2e` runs Playwright E2E tests.
4. **Review CLAUDE.md**: Contains detailed API endpoints, database schema, and architectural decisions.

For questions about specific features, refer to the inline documentation in each module or the relevant docs in `docs/`.
