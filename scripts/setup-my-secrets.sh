#!/bin/bash

# Mystic Tarot - Cloudflare Workers Secrets Setup (single environment)

set -euo pipefail

WORKER_NAME="${WORKER_NAME:-tableau}"
DEFAULT_AZURE_OPENAI_ENDPOINT="${DEFAULT_AZURE_OPENAI_ENDPOINT:-https://judas2.openai.azure.com}"
DEFAULT_AZURE_OPENAI_MODEL="${DEFAULT_AZURE_OPENAI_MODEL:-gpt-5.4-mini}"

put_worker_secret() {
  local secret_name="$1"
  local secret_value="$2"
  printf '%s' "$secret_value" | wrangler secret put "$secret_name" --name="$WORKER_NAME"
}

echo "=================================================="
echo "  Mystic Tarot - Cloudflare Workers Secrets Setup"
echo "=================================================="
echo ""
echo "This script uploads your Azure OpenAI credentials"
echo "to Cloudflare Workers as encrypted secrets."
echo ""
echo "⚠️  IMPORTANT: make sure you have:"
echo "   1. Wrangler installed: npm install -g wrangler"
echo "   2. Authenticated: wrangler login"
echo ""

read -p "Press Enter to continue or Ctrl+C to cancel..."

echo ""
echo "📝 Setting up Azure OpenAI GPT-5.4-mini secrets..."
echo ""

read -p "Enter your Azure OpenAI Endpoint [$DEFAULT_AZURE_OPENAI_ENDPOINT]: " gpt5_endpoint
gpt5_endpoint="${gpt5_endpoint:-$DEFAULT_AZURE_OPENAI_ENDPOINT}"
put_worker_secret AZURE_OPENAI_ENDPOINT "$gpt5_endpoint"
echo "✅ AZURE_OPENAI_ENDPOINT set"

echo ""
echo "Enter your Azure OpenAI API Key (input will be hidden):"
read -s gpt5_api_key
put_worker_secret AZURE_OPENAI_API_KEY "$gpt5_api_key"
echo ""
echo "✅ AZURE_OPENAI_API_KEY set"

echo ""
read -p "Enter your GPT-5 deployment name [$DEFAULT_AZURE_OPENAI_MODEL]: " gpt5_model
gpt5_model="${gpt5_model:-$DEFAULT_AZURE_OPENAI_MODEL}"
put_worker_secret AZURE_OPENAI_GPT5_MODEL "$gpt5_model"
echo "✅ AZURE_OPENAI_GPT5_MODEL set"

echo ""
echo "📝 Setting up Azure OpenAI TTS secrets..."
echo ""

read -p "Enter your Azure TTS Endpoint [$DEFAULT_AZURE_OPENAI_ENDPOINT]: " tts_endpoint
tts_endpoint="${tts_endpoint:-$DEFAULT_AZURE_OPENAI_ENDPOINT}"
put_worker_secret AZURE_OPENAI_TTS_ENDPOINT "$tts_endpoint"
echo "✅ AZURE_OPENAI_TTS_ENDPOINT set"

echo ""
echo "Enter your Azure TTS API Key (input will be hidden):"
read -s tts_api_key
put_worker_secret AZURE_OPENAI_TTS_API_KEY "$tts_api_key"
echo ""
echo "✅ AZURE_OPENAI_TTS_API_KEY set"

echo ""
read -p "Enter your TTS deployment name (e.g., gpt-audio-mini): " tts_deployment
put_worker_secret AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT "$tts_deployment"
echo "✅ AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT set"

echo ""
read -sp "Enter a random vision proof signing secret (32+ chars): " vision_secret
echo ""
put_worker_secret VISION_PROOF_SECRET "$vision_secret"
echo "✅ VISION_PROOF_SECRET set"

echo ""
echo "=================================================="
echo "  ✅ All Secrets Successfully Configured"
echo "=================================================="
echo ""
echo "🔍 Verifying secret names..."
wrangler secret list --name="$WORKER_NAME"
echo ""
echo "🚀 Next steps:"
echo "   1. Build your project: npm run build"
echo "   2. Deploy to Cloudflare: npm run deploy"
echo ""
