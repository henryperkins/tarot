#!/bin/bash

# Mystic Tarot - Production Secrets Setup
# This script securely prompts for your Azure OpenAI credentials and uploads them to Cloudflare Pages

set -e

PROJECT_NAME="mystic-tarot"

echo "=================================================="
echo "  Mystic Tarot - Cloudflare Pages Secrets Setup"
echo "=================================================="
echo ""
echo "This script will upload your Azure OpenAI credentials"
echo "to Cloudflare Pages as encrypted secrets."
echo ""
echo "⚠️  IMPORTANT: Make sure you have:"
echo "   1. Wrangler installed: npm install -g wrangler"
echo "   2. Authenticated: wrangler login"
echo ""

read -p "Press Enter to continue or Ctrl+C to cancel..."

echo ""
echo "📝 Setting up Azure OpenAI GPT-5.1 (Responses API) secrets..."
echo ""

# GPT-5.1 Endpoint
read -p "Enter your Azure OpenAI Endpoint (e.g., https://your-resource.openai.azure.com): " gpt5_endpoint
echo "$gpt5_endpoint" | wrangler pages secret put AZURE_OPENAI_ENDPOINT --project-name=$PROJECT_NAME
echo "✅ AZURE_OPENAI_ENDPOINT set"

# GPT-5.1 API Key
echo ""
echo "Enter your Azure OpenAI API Key (input will be hidden):"
read -s gpt5_api_key
echo "$gpt5_api_key" | wrangler pages secret put AZURE_OPENAI_API_KEY --project-name=$PROJECT_NAME
echo "✅ AZURE_OPENAI_API_KEY set"

# GPT-5.1 Model Deployment Name
echo ""
read -p "Enter your GPT-5.1 deployment name (e.g., gpt-5.1): " gpt5_model
echo "$gpt5_model" | wrangler pages secret put AZURE_OPENAI_GPT5_MODEL --project-name=$PROJECT_NAME
echo "✅ AZURE_OPENAI_GPT5_MODEL set"

echo ""
echo "📝 Setting up Azure OpenAI TTS secrets..."
echo ""

# TTS Endpoint
read -p "Enter your Azure TTS Endpoint (e.g., https://your-tts-resource.openai.azure.com): " tts_endpoint
echo "$tts_endpoint" | wrangler pages secret put AZURE_OPENAI_TTS_ENDPOINT --project-name=$PROJECT_NAME
echo "✅ AZURE_OPENAI_TTS_ENDPOINT set"

# TTS API Key
echo ""
echo "Enter your Azure TTS API Key (input will be hidden):"
read -s tts_api_key
echo "$tts_api_key" | wrangler pages secret put AZURE_OPENAI_TTS_API_KEY --project-name=$PROJECT_NAME
echo "✅ AZURE_OPENAI_TTS_API_KEY set"

# TTS Deployment Name
echo ""
read -p "Enter your TTS deployment name (e.g., gpt-audio-mini): " tts_deployment
echo "$tts_deployment" | wrangler pages secret put AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT --project-name=$PROJECT_NAME
echo "✅ AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT set"

# Vision proof signing secret
echo ""
read -sp "Enter a random vision proof signing secret (32+ chars): " vision_secret
echo ""
echo "$vision_secret" | wrangler pages secret put VISION_PROOF_SECRET --project-name=$PROJECT_NAME
echo "✅ VISION_PROOF_SECRET set"

echo ""
echo "=================================================="
echo "  ✅ All Secrets Successfully Configured!"
echo "=================================================="
echo ""
echo "🔍 Verifying secrets..."
wrangler pages secret list --project-name=$PROJECT_NAME
echo ""
echo "🚀 Next steps:"
echo "   1. Build your project: npm run build"
echo "   2. Deploy to Cloudflare: npm run deploy"
echo "   3. Test deployment with the vision proof handshake:"
echo "      # (a) Create a proof by POSTing base64 photo data"
echo "      curl -X POST https://mystic-tarot.pages.dev/api/vision-proof \"
echo "        -H 'Content-Type: application/json' \"
echo "        -d '{\"deckStyle\":\"rws-1909\",\"evidence\":[{\"label\":\"Card 1\",\"dataUrl\":\"data:image/jpeg;base64,REPLACE_ME\"}]}'"
echo "      # (b) Use the returned proof when calling /api/tarot-reading"
echo "      curl -X POST https://mystic-tarot.pages.dev/api/tarot-reading \"
echo "        -H 'Content-Type: application/json' \"
echo "        -d '{\"spreadInfo\":{\"name\":\"One-Card Insight\"},\"cardsInfo\":[{\"position\":\"Card 1\",\"card\":\"The Fool\",\"orientation\":\"upright\",\"meaning\":\"New beginnings\"}],\"userQuestion\":\"Test\",\"visionProof\":{...}}'"
echo "      See docs/VISION_PIPELINE.md for helper scripts to automate this flow."
echo ""
