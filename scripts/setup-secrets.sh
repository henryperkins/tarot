#!/bin/bash

# Tableau - Cloudflare Workers Secrets Setup
# This script helps you configure all required secrets for production deployment
# Updated for Cloudflare Workers (migrated from Pages)

set -e

WORKER_NAME="tableau"

echo "=================================================="
echo "  Mystic Tarot - Cloudflare Workers Secrets Setup"
echo "=================================================="
echo ""
echo "This script will help you set up encrypted secrets for your"
echo "Cloudflare Worker using the Wrangler CLI."
echo ""
echo "⚠️  IMPORTANT: Make sure you have wrangler installed and authenticated:"
echo "   npm install -g wrangler"
echo "   wrangler login"
echo ""

read -p "Press Enter to continue or Ctrl+C to cancel..."

echo ""
echo "📝 Setting up OpenAI Responses API secrets for readings..."
echo ""

# OPENAI_API_KEY
echo "1️⃣  OpenAI API Key"
echo "   Get from: OpenAI Platform → API keys"
read -sp "   Enter your OpenAI API key: " API_KEY
echo ""
echo "$API_KEY" | wrangler secret put OPENAI_API_KEY --name "$WORKER_NAME"
echo "   ✅ OPENAI_API_KEY set"
echo ""

echo "📝 Setting up ElevenLabs reader voice (optional)..."
echo ""
read -p "Do you want to set up TTS secrets now? (y/n): " SETUP_TTS

if [[ "$SETUP_TTS" == "y" || "$SETUP_TTS" == "Y" ]]; then
    read -sp "   Enter your ElevenLabs API key: " ELEVENLABS_KEY
    echo ""
    printf '%s' "$ELEVENLABS_KEY" | wrangler secret put ELEVENLABS_API_KEY --name "$WORKER_NAME"
    echo "   ✅ ELEVENLABS_API_KEY set"
    echo ""
else
    echo "   Workers AI narration needs no additional provider secret."
    echo ""
fi

echo "=================================================="
echo "  ✅ Secrets Setup Complete!"
echo "=================================================="
echo ""
echo "🔍 To verify your secrets were set correctly, run:"
echo "   wrangler secret list --name $WORKER_NAME"
echo ""
echo "📝 Note: Secret values are encrypted and cannot be viewed after"
echo "         setting them. You can only see the secret names."
echo ""
echo "🚀 Next steps:"
echo "   1. Build your project: npm run build"
echo "   2. Deploy to Cloudflare: npm run deploy"
echo "      (or: wrangler deploy --config wrangler.jsonc)"
echo "   3. Test your deployment with the vision proof handshake:"
echo "      # (a) Create a proof by POSTing base64 photo data"
echo "      curl -X POST https://tableau.YOUR_SUBDOMAIN.workers.dev/api/vision-proof \"
echo "        -H 'Content-Type: application/json' \"
echo "        -d '{\"deckStyle\":\"rws-1909\",\"evidence\":[{\"label\":\"Card 1\",\"dataUrl\":\"data:image/jpeg;base64,REPLACE_ME\"}]}'"
echo "      # (b) Use the returned proof object when calling /api/tarot-reading"
echo "      curl -X POST https://tableau.YOUR_SUBDOMAIN.workers.dev/api/tarot-reading \"
echo "        -H 'Content-Type: application/json' \"
echo "        -d '{\"spreadInfo\":{\"name\":\"One-Card Insight\"},\"cardsInfo\":[{\"position\":\"Card 1\",\"card\":\"The Fool\",\"orientation\":\"upright\",\"meaning\":\"New beginnings\"}],\"userQuestion\":\"Test\",\"visionProof\":{...}}'"
echo "      See docs/VISION_PIPELINE.md for helper scripts to automate this flow."
echo ""
