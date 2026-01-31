# Tableu - AI Tarot Reading Application

## Overview

Tableu is an AI-powered tarot reading web application built with React + Vite on the frontend and Express.js on the backend. The app provides personalized tarot readings using Azure GPT-5.1 (with Claude fallback), featuring a 78-card Rider-Waite deck, multiple spread types, text-to-speech narration, and a personal journal system. The goal is to feel like sitting with a practiced reader rather than using a generic card widget.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (React + Vite)
- **Location**: `src/` directory
- **Key Components**: 
  - `TarotReading.jsx` - Main orchestration (ritual → spread → draw → reading)
  - `components/` - UI components (Card, ReadingGrid, etc.)
  - `contexts/` - React contexts (Auth, Preferences, Reading)
  - `hooks/` - Custom React hooks
  - `lib/` - Browser-only utilities (DOM, localStorage, audio, deck logic)
  - `data/` - Card definitions, spreads, knowledge graph patterns

### Backend (Express.js)
- **Entry Point**: `server/index.ts` - Express server serving API routes and static frontend
- **Auth Integration**: `server/replit_integrations/auth/` - Replit Auth (OpenID Connect)
- **Database**: `server/db.ts` - Drizzle ORM connection to PostgreSQL
- **API Routes**: Express routes for auth (`/api/login`, `/api/logout`, `/api/auth/user`)
- **Legacy Functions**: `functions/lib/` - Server-only code (narrative generation, evaluation, safety checks)

### Shared Code
- **Location**: `shared/` directory
- **Purpose**: Environment-agnostic code used by both frontend and backend
- **Modules**: `contracts/`, `journal/`, `monetization/`, `symbols/`, `vision/`

### Critical Separation Rule
| Path | Environment | Can Access | Cannot Access |
|------|-------------|------------|---------------|
| `src/lib/` | Browser | DOM, window, localStorage, React | env, D1, KV, R2, secrets |
| `functions/lib/` | Cloudflare Workers | env, D1, KV, R2, AI binding | DOM, window, React |
| `scripts/*/lib/` | Node.js | fs, process, node modules | DOM, Cloudflare bindings |

### AI Integration
- **Primary**: Azure OpenAI GPT-5.1 for narrative generation
- **Fallback**: Anthropic Claude, then local composer
- **Text-to-Speech**: Azure GPT-4o-mini TTS with synthesized waveform fallback
- **Vision**: CLIP-based card recognition via `@xenova/transformers` (optional research feature)
- **Evaluation**: Cloudflare Workers AI (Qwen) for quality scoring

### Database & Storage
- **Primary Database**: PostgreSQL (Replit-managed Neon) with Drizzle ORM
- **Schema Definition**: `shared/schema.ts` with auth tables (users, sessions)
- **Auth Sessions**: Stored in PostgreSQL via connect-pg-simple

### Key Design Decisions
1. **Deterministic Card Draws**: `computeSeed()` + `drawSpread()` in `src/lib/deck.js` ensures reproducible shuffles based on question + ritual inputs
2. **900-Line Rule**: Any module over 900 lines must be refactored into focused submodules
3. **Graceful Degradation**: All AI features fall back gracefully (Azure → Claude → local, TTS → synthesized audio)
4. **Ethics-First**: Emphasize user agency, include professional disclaimers, never hallucinate cards

## External Dependencies

### AI Services
- **Azure OpenAI** - GPT-5.1 for narrative generation, GPT-4o-mini for TTS
- **Anthropic Claude** - Fallback narrative generation
- **Cloudflare Workers AI** - Qwen model for evaluation scoring

### Replit Platform
- **Express.js Server** - Node.js compute for API
- **PostgreSQL** - Neon-backed database for users and sessions
- **Replit Auth** - OpenID Connect authentication (Google, GitHub, X, Apple, email/password)

### Payment Processing
- **Stripe** - Web payment processing via REST helpers in `functions/lib/stripe.js`

### Development Tools
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling with custom design tokens
- **Playwright** - E2E testing
- **Drizzle** - ORM for schema definition (PostgreSQL dialect)

### Key Commands
```bash
npm run dev:server   # Run Express server (serves API + built frontend)
npm run dev          # Full-stack dev (Vite + Express server)
npm run build        # Production build to dist/
npm test             # Unit tests
npm run test:e2e     # Playwright E2E tests
npm run db:push      # Push Drizzle schema changes to PostgreSQL
```