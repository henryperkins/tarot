# Tableu

**Tableu** is a sophisticated AI-powered tarot reading application that bridges traditional cartomancy with modern generative AI. Unlike simple database-lookup tarot apps, it uses advanced Large Language Models to synthesize complex card relationships, positional meanings, and user context into cohesive, human-like narratives.

> 🔮 Designed to feel like sitting with a practiced reader, not a generic card widget.

## ✨ Features

- **Multiple Spread Types**: One-Card Insight, Three-Card Story, Five-Card Clarity, Decision/Two-Path, Relationship Snapshot, and Celtic Cross (10-card)
- **AI-Generated Narratives**: Context-aware readings powered by Azure OpenAI GPT-5.1 with Claude fallback
- **Knowledge Graph Analysis**: Advanced pattern detection including elemental dignities, suit progressions, and archetypal triads
- **Text-to-Speech**: Listen to readings with Azure GPT-4o-mini TTS
- **Personal Journal**: Save and reflect on readings (cloud sync for authenticated users, localStorage for anonymous)
- **Shareable Readings**: Generate links to share readings with others
- **Ritual Experience**: Authentic tarot feel with knocks, deck cutting, and card reveal animations
- **Accessibility**: WCAG-compliant with keyboard navigation, ARIA labels, and reduced-motion support
- **PWA Support**: Installable progressive web app with offline capabilities

## 🛠 Tech Stack

| Layer                 | Technology                                                |
| --------------------- | --------------------------------------------------------- |
| Frontend              | React 18, Vite, Tailwind CSS                              |
| Backend               | Cloudflare Workers (serverless)                           |
| AI                    | Azure OpenAI (GPT-5.1, GPT-4o-mini TTS), Anthropic Claude |
| Database              | Cloudflare D1 (SQLite)                                    |
| Caching/Rate Limiting | Cloudflare KV                                             |
| Storage               | Cloudflare R2                                             |

## 📁 Project Structure

```
├── src/                    # React frontend
│   ├── components/         # UI components (Card, ReadingGrid, etc.)
│   ├── contexts/           # React contexts (Auth, Preferences, Reading)
│   ├── data/               # Card data and spread definitions
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Frontend utilities (audio, deck, formatting)
│   ├── pages/              # Route pages
│   ├── styles/             # CSS files (Tailwind + custom)
│   ├── worker/             # Cloudflare Worker entry point
│   └── TarotReading.jsx    # Main orchestration component
├── functions/              # Cloudflare Pages Functions (API)
│   ├── api/                # API endpoints
│   └── lib/                # Backend logic and narrative generation
├── public/                 # Static assets (images, sounds, icons)
├── tests/                  # Test files (*.test.mjs)
├── scripts/                # Utility scripts (evaluation, training)
├── docs/                   # Documentation
└── migrations/             # Database migrations (D1)
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18.0.0 or later
- npm (included with Node.js)
- Cloudflare account (for deployment)

### Installation

```bash
# Clone the repository
git clone https://github.com/henryperkins/tarot.git
cd tarot

# Install dependencies
npm install
```

### Environment Setup

1. Copy the example environment file:

   ```bash
   cp .dev.vars.example .dev.vars
   ```

2. Fill in the required secrets in `.dev.vars`:

   ```bash
   # Azure OpenAI (required for AI-generated readings)
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
   AZURE_OPENAI_API_KEY=your-api-key
   AZURE_OPENAI_GPT5_MODEL=gpt-5.1

   # Azure TTS (optional, for voice readings)
   AZURE_OPENAI_TTS_ENDPOINT=https://your-resource.openai.azure.com
   AZURE_OPENAI_TTS_API_KEY=your-tts-api-key
   AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT=gpt-4o-mini-tts

   # Anthropic (optional, for Claude fallback)
   AZURE_ANTHROPIC_ENDPOINT=https://<resource>.services.ai.azure.com/anthropic
   AZURE_ANTHROPIC_API_KEY=your-azure-foundry-key  # optional; can fall back to AZURE_OPENAI_API_KEY
   AZURE_ANTHROPIC_MODEL=claude-opus-4-5

   # Vision research mode (optional)
   VISION_PROOF_SECRET=your-secret-key
   ```

3. Verify your configuration:
   ```bash
   npm run config:check
   ```

> ⚠️ Never commit `.dev.vars` to version control. It's already in `.gitignore`.

## 💻 Development

### Quick Start

```bash
npm run dev
```

This starts both the Vite dev server and Wrangler proxy. Access the app at **http://localhost:8788**.

### Available Scripts

| Command                | Description                         |
| ---------------------- | ----------------------------------- |
| `npm run dev`          | Start full-stack development server |
| `npm run dev:frontend` | Start Vite dev server only (no API) |
| `npm run dev:wrangler` | Start Wrangler Workers dev server   |
| `npm run build`        | Build for production                |
| `npm run preview`      | Preview production build            |
| `npm test`             | Run tests                           |
| `npm run lint`         | Run ESLint                          |
| `npm run lint:fix`     | Fix linting issues                  |

### Important URLs During Development

| URL                   | Purpose                |
| --------------------- | ---------------------- |
| http://localhost:8788 | Full app with API ✅   |
| http://localhost:5173 | Frontend only (no API) |

## 🧪 Testing

```bash
# Run all tests
npm test

# Accessibility tests
npm run test:a11y

# Vision quality gates
npm run gate:vision

# Narrative quality gates
npm run gate:narrative
```

Tests use Node.js native test runner with `.test.mjs` files in the `tests/` directory.

## 🚢 Deployment

### Deploy to Cloudflare

```bash
# Build and deploy
npm run build && npm run deploy

# Or use the combined script
npm run deploy
```

### Set Production Secrets

```bash
wrangler secret put AZURE_OPENAI_ENDPOINT --config wrangler.jsonc
wrangler secret put AZURE_OPENAI_API_KEY --config wrangler.jsonc
wrangler secret put AZURE_OPENAI_GPT5_MODEL --config wrangler.jsonc
# ... add other secrets as needed
```

### Deployment URLs

- **Production**: https://tableau-8xz.pages.dev
- **Branch Previews**: https://\<branch-name\>.tableau-8xz.pages.dev

## 📖 Documentation

Detailed documentation is available in the `docs/` directory:

- [Developer Onboarding](docs/DEVELOPER_ONBOARDING.md) - Getting started guide
- [Development Setup](docs/DEV_SETUP.md) - Local development instructions
- [Deployment Guide](docs/DEPLOYMENT.md) - Production deployment
- [System Architecture](docs/SYSTEM_ARCHITECTURE.md) - Technical architecture
- [Vision Pipeline](docs/VISION_PIPELINE.md) - Physical card recognition
- [Knowledge Graph](docs/knowledge-graph/) - Tarot pattern documentation

## 🤝 Contributing

1. Follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `chore:`, `docs:`, `test:`
2. Run `npm test` before pushing changes
3. Run `npm run lint` to check code style
4. Include screenshots for UI changes in PR descriptions
5. Keep PRs focused; avoid bundling unrelated changes

## 🃏 Spreads

| Spread                | Cards | Description                                 |
| --------------------- | ----- | ------------------------------------------- |
| One-Card Insight      | 1     | Quick guidance for a focused question       |
| Three-Card Story      | 3     | Past, Present, Future narrative             |
| Five-Card Clarity     | 5     | Core, Challenge, Hidden, Support, Direction |
| Decision/Two-Path     | 5     | Compare two options with clarity            |
| Relationship Snapshot | 3     | You, Them, Connection dynamic               |
| Celtic Cross          | 10    | Classic deep dive for complex questions     |

## ⚖️ Ethics

- Tarot readings are for **guidance and reflection**, not replacement for professional advice
- Emphasizes user **agency and free will** over deterministic predictions
- No medical, legal, or financial advice
- Trauma-informed, empowering language
- Cards are never invented or hallucinated by the AI

## 📜 Card Images

The app uses public domain 1909 Rider-Waite "Roses & Lilies" deck images from Wikimedia Commons.

---

Built with 🔮 by the Tableu team
