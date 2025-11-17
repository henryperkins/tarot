#!/bin/bash

# Mystic Tarot - Fix Configuration and Deploy
# This script fixes the TTS endpoint and redeploys everything

set -e

PROJECT_NAME="mystic-tarot"

echo "=================================================="
echo "  Mystic Tarot - Fix Configuration and Deploy"
echo "=================================================="
echo ""
echo "This script will:"
echo "  1. Update TTS endpoint (remove incorrect API path)"
echo "  2. Rebuild the project"
echo "  3. Deploy static assets + Functions to Cloudflare"
echo ""

# Fix TTS endpoint (remove /openai/v1/chat/completions path)
echo "📝 Step 1: Fixing TTS endpoint URL..."
echo "   Old: https://hperk-mhsylcwu-centralus.openai.azure.com/openai/v1/chat/completions"
echo "   New: https://hperk-mhsylcwu-centralus.openai.azure.com"
echo ""

echo "https://hperk-mhsylcwu-centralus.openai.azure.com" | \
  wrangler pages secret put AZURE_OPENAI_TTS_ENDPOINT --project-name=$PROJECT_NAME
echo "✅ TTS endpoint updated in Cloudflare"
echo ""

# Build project
echo "📦 Step 2: Building project..."
npm run build
echo "✅ Build complete"
echo ""

# Deploy
echo "🚀 Step 3: Deploying to Cloudflare Pages..."
echo "   - Static assets from: dist/"
echo "   - Functions from: functions/"
echo ""

wrangler pages deploy dist --project-name=$PROJECT_NAME

echo ""
echo "=================================================="
echo "  ✅ Deployment Complete!"
echo "=================================================="
echo ""
echo "🧪 Test your deployment:"
echo ""
echo "   # GPT-5.1 Health Check"
echo "   curl https://mystic-tarot.pages.dev/api/tarot-reading"
echo ""
echo "   # TTS Health Check"
echo "   curl https://mystic-tarot.pages.dev/api/tts"
echo ""
echo "   # Full tarot reading test (vision proof required)"
echo "   # 1) Create a proof by posting base64 photo data"
echo "   curl -X POST https://mystic-tarot.pages.dev/api/vision-proof \"
echo "     -H 'Content-Type: application/json' \"
echo "     -d '{\"deckStyle\":\"rws-1909\",\"evidence\":[{\"label\":\"Card 1\",\"dataUrl\":\"data:image/jpeg;base64,REPLACE_ME\"}]}'"
echo "   # 2) Use the returned proof with /api/tarot-reading"
echo "   curl -X POST https://mystic-tarot.pages.dev/api/tarot-reading \"
echo "     -H 'Content-Type: application/json' \"
echo "     -d '{\"spreadInfo\":{\"name\":\"One-Card Insight\"},\"cardsInfo\":[{\"position\":\"Card 1\",\"card\":\"The Fool\",\"orientation\":\"upright\",\"meaning\":\"New beginnings\"}],\"userQuestion\":\"Test\",\"visionProof\":{...}}'"
echo ""
