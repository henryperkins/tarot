# Journal Authentication & Persistence Setup

This guide covers the authentication and D1-backed journal persistence system for Mystic Tarot.

## Overview

The journal feature now supports **optional authentication** with **cloud-backed persistence**:

- **Anonymous users** → localStorage (browser-only, existing behavior)
- **Authenticated users** → D1 database (cloud-synced, cross-device access)

## Features

✅ **Zero breaking changes** - App works identically without authentication
✅ **Automatic routing** - `useJournal` hook routes to API or localStorage based on auth state
✅ **Migration support** - One-click migration from localStorage to cloud
✅ **PBKDF2 password hashing** - 100,000 iterations, OWASP-compliant
✅ **HTTP-only cookies** - SameSite=Lax, Secure flags for session management
✅ **30-day sessions** - Persistent authentication with automatic refresh

---

## Setup Instructions

### 1. Run Database Migrations

Execute both migration files to set up the database schema:

```bash
# Migration 0001 (analytics tables - already run)
wrangler d1 execute mystic-tarot-db --remote --file=./migrations/0001_initial_schema.sql

# Migration 0002 (auth and journal tables - NEW)
wrangler d1 execute mystic-tarot-db --remote --file=./migrations/0002_add_auth_and_journals.sql
```

**Tables created by Migration 0002:**
- `users` - User accounts (email, username, password_hash, password_salt)
- `sessions` - Active sessions with HTTP-only cookie tokens
- `journal_entries` - Cloud-synced journal entries

### 2. Verify Database Binding

Ensure `wrangler.toml` has the D1 binding configured (already done):

```toml
[[d1_databases]]
binding = "DB"
database_name = "mystic-tarot-db"
database_id = "ede622bd-5845-4da9-9031-839cb26ae7be"
```

### 3. Deploy to Production

```bash
npm run build
npm run deploy
```

---

## Architecture

### Backend (Cloudflare Pages Functions)

#### Auth API (`functions/api/auth/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Create new user account |
| `/api/auth/login` | POST | Authenticate and create session |
| `/api/auth/logout` | POST | Destroy session |
| `/api/auth/me` | GET | Get current user info |

**Security features:**
- PBKDF2 with 100,000 iterations (SHA-256)
- Cryptographically secure random salts (16 bytes)
- Session tokens via `crypto.randomUUID()`
- HTTP-only cookies with SameSite=Lax and Secure flags
- 30-day session expiration with last_used_at tracking

#### Journal API (`functions/api/journal/`)

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/journal` | GET | List all entries for user | ✅ |
| `/api/journal` | POST | Save new entry | ✅ |
| `/api/journal/[id]` | DELETE | Delete entry (ownership verified) | ✅ |

#### Auth Library (`functions/lib/auth.js`)

Key functions:
- `hashPassword(password, salt?)` - PBKDF2 hashing
- `verifyPassword(password, storedHash, storedSalt)` - Timing-safe comparison
- `createSession(db, userId, metadata)` - Generate session token
- `validateSession(db, token)` - Verify and refresh session
- `getSessionFromCookie(cookieHeader)` - Extract token from cookies
- `createSessionCookie(token, expiresAt)` - Secure cookie header

### Frontend (React)

#### Context & Hooks

**`AuthContext` (`src/contexts/AuthContext.jsx`)**
- Global auth state (user, loading, error)
- Methods: `register()`, `login()`, `logout()`, `checkAuth()`
- Wraps entire app in `main.jsx`

**`useJournal` Hook (`src/hooks/useJournal.js`)**
- Automatic routing based on `isAuthenticated` state
- Methods: `saveEntry()`, `deleteEntry()`, `migrateToCloud()`
- Returns: `entries`, `loading`, `error`

#### Components

**`AuthModal` (`src/components/AuthModal.jsx`)**
- Login/register UI with form validation
- Email, username, password fields
- Error and success states
- Accessible and responsive

**Updated `Journal.jsx`**
- Auth status banner
- Migration button for localStorage users
- Delete functionality for authenticated users
- Loading states

**Updated `TarotReading.jsx`**
- Uses `useJournal({ autoLoad: false }).saveEntry()` instead of direct localStorage
- Skips the journal fetch on mount to avoid duplicate network requests
- Automatic API/localStorage routing

---

## Usage Examples

### Registering a New User

```javascript
import { useAuth } from './contexts/AuthContext';

const { register } = useAuth();

const result = await register('user@example.com', 'username', 'password123');
if (result.success) {
  console.log('Registered:', result.user);
}
```

### Saving a Journal Entry

```javascript
import { useJournal } from './hooks/useJournal';

// Disable the initial fetch if you only need mutation helpers
const { saveEntry } = useJournal({ autoLoad: false });

const entry = {
  spread: 'Three-Card Story (Past · Present · Future)',
  spreadKey: 'threeCard',
  question: 'What do I need to know?',
  cards: [
    { position: 'Past', name: 'The Fool', orientation: 'Upright' },
    { position: 'Present', name: 'The Magician', orientation: 'Reversed' },
    { position: 'Future', name: 'The High Priestess', orientation: 'Upright' }
  ],
  personalReading: 'Your narrative text here...',
  themes: { /* theme data */ },
  reflections: { /* user notes */ }
};

const result = await saveEntry(entry);
// Automatically saves to API if authenticated, localStorage otherwise
```

### Migrating localStorage to Cloud

```javascript
const { migrateToCloud } = useJournal();

const result = await migrateToCloud();
console.log(`Migrated ${result.migrated} entries`);
// localStorage is cleared after successful migration
```

---

## Database Schema Reference

### `users` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | UUID |
| `email` | TEXT (UNIQUE) | User email (lowercase) |
| `username` | TEXT (UNIQUE) | Display name |
| `password_hash` | TEXT | PBKDF2 derived hash |
| `password_salt` | TEXT | Hex-encoded salt |
| `created_at` | INTEGER | Unix timestamp |
| `updated_at` | INTEGER | Unix timestamp |
| `last_login_at` | INTEGER | Unix timestamp |
| `is_active` | INTEGER | Boolean (1/0) |
| `email_verified` | INTEGER | Boolean (future feature) |

### `sessions` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Session token (UUID) |
| `user_id` | TEXT (FK) | Reference to users.id |
| `created_at` | INTEGER | Unix timestamp |
| `expires_at` | INTEGER | Unix timestamp (30 days) |
| `last_used_at` | INTEGER | Updated on each request |
| `user_agent` | TEXT | Browser info |
| `ip_address` | TEXT | CF-Connecting-IP header |

### `journal_entries` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | UUID |
| `user_id` | TEXT (FK) | Reference to users.id |
| `created_at` | INTEGER | Unix timestamp |
| `updated_at` | INTEGER | Unix timestamp |
| `spread_key` | TEXT | Spread identifier (e.g., 'threeCard') |
| `spread_name` | TEXT | Human-readable spread name |
| `question` | TEXT | User's question (nullable) |
| `cards_json` | TEXT | JSON array of card objects |
| `narrative` | TEXT | Generated reading text |
| `themes_json` | TEXT | JSON object of themes/insights |
| `reflections_json` | TEXT | JSON object of user notes |
| `context` | TEXT | Reading context (love, career, etc.) |
| `provider` | TEXT | 'azure-gpt5' or 'local' |
| `session_seed` | TEXT | Ritual seed for reproducibility |

---

## Security Best Practices

### Password Requirements
- Minimum 8 characters
- Validated client-side and server-side
- PBKDF2 with 100,000 iterations (OWASP minimum)

### Session Management
- HTTP-only cookies prevent XSS access
- SameSite=Lax prevents CSRF attacks
- Secure flag requires HTTPS in production
- 30-day expiration with automatic cleanup

### Input Validation
- Email format validation (`isValidEmail`)
- Username pattern: 3-30 chars, alphanumeric + underscore (`isValidUsername`)
- Server-side validation on all endpoints

### Database Access
- Prepared statements prevent SQL injection
- Ownership verification on DELETE operations
- Foreign key constraints enforce referential integrity

---

## Troubleshooting

### Sessions not persisting

**Problem:** User logged out after refresh
**Solution:** Check that cookies are enabled and HTTPS is used in production

### Migration fails

**Problem:** "Not authenticated" error during migration
**Solution:** Ensure user is logged in before calling `migrateToCloud()`

### Duplicate email/username

**Problem:** Registration fails with conflict error
**Solution:** Email and username must be unique; users should use different credentials

### Journal entries not loading

**Problem:** Empty journal after login
**Solution:** Check D1 binding in `wrangler.toml` and ensure migrations ran successfully

### CORS errors in local development

**Problem:** API calls fail with CORS errors
**Solution:** Run `npx wrangler pages dev dist` instead of `npm run dev` to test with Functions

---

## API Reference

### POST `/api/auth/register`

**Request:**
```json
{
  "email": "user@example.com",
  "username": "myusername",
  "password": "securepass123"
}
```

**Response (201):**
```json
{
  "success": true,
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "username": "myusername"
  }
}
```

**Errors:**
- `400` - Invalid input (missing fields, invalid format)
- `409` - Email or username already exists
- `500` - Internal server error

### POST `/api/auth/login`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepass123"
}
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "username": "myusername"
  }
}
```

**Errors:**
- `400` - Missing email or password
- `401` - Invalid credentials
- `403` - Account inactive
- `500` - Internal server error

### POST `/api/journal`

**Request:**
```json
{
  "spread": "Three-Card Story",
  "spreadKey": "threeCard",
  "question": "What do I need to know?",
  "cards": [
    { "position": "Past", "name": "The Fool", "orientation": "Upright" }
  ],
  "personalReading": "Your narrative...",
  "themes": {},
  "reflections": {},
  "context": "self",
  "provider": "azure-gpt5",
  "sessionSeed": "abc123"
}
```

**Response (201):**
```json
{
  "success": true,
  "entry": {
    "id": "uuid-here",
    "ts": 1700000000000
  }
}
```

---

## Future Enhancements

- [ ] Email verification
- [ ] Password reset flow
- [ ] Export journal as PDF/JSON
- [ ] Share readings via unique URLs
- [ ] OAuth providers (Google, GitHub)
- [ ] Two-factor authentication

---

## Resources

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Web Crypto API](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Pages Functions](https://developers.cloudflare.com/pages/functions/)
