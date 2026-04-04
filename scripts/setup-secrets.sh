#!/bin/bash

# Tableau - Cloudflare Workers Secrets Setup
# This script helps you configure all required secrets for production deployment
# Updated for Cloudflare Workers (migrated from Pages)

set -e

WORKER_NAME="tableau"
DEFAULT_AZURE_OPENAI_ENDPOINT="${DEFAULT_AZURE_OPENAI_ENDPOINT:-https://judas2.openai.azure.com}"
DEFAULT_AZURE_OPENAI_MODEL="${DEFAULT_AZURE_OPENAI_MODEL:-gpt-5.4-mini}"

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
echo "📝 Setting up Azure OpenAI GPT-5.4-mini (Responses API) secrets..."
echo ""

# AZURE_OPENAI_ENDPOINT
echo "1️⃣  Azure OpenAI Endpoint"
echo "   Production default: $DEFAULT_AZURE_OPENAI_ENDPOINT"
read -p "   Enter your Azure OpenAI endpoint [$DEFAULT_AZURE_OPENAI_ENDPOINT]: " ENDPOINT
ENDPOINT="${ENDPOINT:-$DEFAULT_AZURE_OPENAI_ENDPOINT}"
echo "$ENDPOINT" | wrangler secret put AZURE_OPENAI_ENDPOINT --name "$WORKER_NAME"
echo "   ✅ AZURE_OPENAI_ENDPOINT set"
echo ""

# AZURE_OPENAI_API_KEY
echo "2️⃣  Azure OpenAI API Key"
echo "   Get from: Azure Portal → Azure OpenAI → Keys and Endpoint"
read -sp "   Enter your Azure OpenAI API key: " API_KEY
echo ""
echo "$API_KEY" | wrangler secret put AZURE_OPENAI_API_KEY --name "$WORKER_NAME"
echo "   ✅ AZURE_OPENAI_API_KEY set"
echo ""

# AZURE_OPENAI_GPT5_MODEL
echo "3️⃣  GPT-5.4-mini Model Deployment Name"
echo "   Get from: Azure Portal → Azure OpenAI → Deployments"
echo "   Production default: $DEFAULT_AZURE_OPENAI_MODEL"
read -p "   Enter your GPT-5 deployment name [$DEFAULT_AZURE_OPENAI_MODEL]: " GPT5_MODEL
GPT5_MODEL="${GPT5_MODEL:-$DEFAULT_AZURE_OPENAI_MODEL}"
echo "$GPT5_MODEL" | wrangler secret put AZURE_OPENAI_GPT5_MODEL --name "$WORKER_NAME"
echo "   ✅ AZURE_OPENAI_GPT5_MODEL set"
echo ""

echo "📝 Setting up Azure OpenAI TTS secrets (optional)..."
echo ""
read -p "Do you want to set up TTS secrets now? (y/n): " SETUP_TTS

if [[ "$SETUP_TTS" == "y" || "$SETUP_TTS" == "Y" ]]; then
    # AZURE_OPENAI_TTS_ENDPOINT
    echo "4️⃣  Azure OpenAI TTS Endpoint"
    echo "   (Can be the same as the GPT-5.4-mini endpoint if using same resource)"
    read -p "   Enter your TTS endpoint [$DEFAULT_AZURE_OPENAI_ENDPOINT]: " TTS_ENDPOINT
    TTS_ENDPOINT="${TTS_ENDPOINT:-$DEFAULT_AZURE_OPENAI_ENDPOINT}"
    echo "$TTS_ENDPOINT" | wrangler secret put AZURE_OPENAI_TTS_ENDPOINT --name "$WORKER_NAME"
    echo "   ✅ AZURE_OPENAI_TTS_ENDPOINT set"
    echo ""

    # AZURE_OPENAI_TTS_API_KEY
    echo "5️⃣  Azure OpenAI TTS API Key"
    echo "   (Can be the same as the GPT-5.4-mini API key if using same resource)"
    read -sp "   Enter your TTS API key: " TTS_API_KEY
    echo ""
    echo "$TTS_API_KEY" | wrangler secret put AZURE_OPENAI_TTS_API_KEY --name "$WORKER_NAME"
    echo "   ✅ AZURE_OPENAI_TTS_API_KEY set"
    echo ""

    # AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT
    echo "6️⃣  TTS Deployment Name"
    echo "   Example: tts, tts-1-hd, gpt-4o-mini-tts, etc."
    read -p "   Enter your TTS deployment name: " TTS_DEPLOYMENT
    echo "$TTS_DEPLOYMENT" | wrangler secret put AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT --name "$WORKER_NAME"
    echo "   ✅ AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT set"
    echo ""
else
    echo "   ⏭️  Skipping TTS setup"
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
