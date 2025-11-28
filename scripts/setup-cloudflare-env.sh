#!/bin/bash
# Setup Cloudflare Workers secrets for Azure TTS
# Updated for Cloudflare Workers (migrated from Pages)

set -e

echo "🔧 Setting up Cloudflare Workers secrets..."
echo ""

WORKER_NAME="tableau"

# Read from .env.local or current environment
ENDPOINT="${AZURE_OPENAI_ENDPOINT:-https://thefoundry.openai.azure.com}"
API_KEY="${AZURE_OPENAI_API_KEY}"
DEPLOYMENT="${AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT:-gpt-4o-mini-tts}"

if [ -z "$API_KEY" ]; then
  echo "❌ Error: AZURE_OPENAI_API_KEY not found in environment"
  echo "   Please export it first or ensure .env.local is loaded"
  exit 1
fi

echo "📋 Configuration to deploy:"
echo "   Endpoint: $ENDPOINT"
echo "   Deployment: $DEPLOYMENT"
echo ""
echo "⚠️  API Key will be set (encrypted)"
echo ""

read -p "Deploy these settings to Cloudflare Workers? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

echo ""
echo "🚀 Deploying secrets to Worker: $WORKER_NAME..."

# Set secrets (Workers use secrets for sensitive values, not env vars)
echo "$ENDPOINT" | wrangler secret put AZURE_OPENAI_ENDPOINT --name "$WORKER_NAME"
echo "✅ AZURE_OPENAI_ENDPOINT set"

echo "$API_KEY" | wrangler secret put AZURE_OPENAI_API_KEY --name "$WORKER_NAME"
echo "✅ AZURE_OPENAI_API_KEY set"

echo "$DEPLOYMENT" | wrangler secret put AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT --name "$WORKER_NAME"
echo "✅ AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT set"

echo ""
echo "✅ Secrets deployed to Worker!"
echo ""
echo "🔄 Next steps:"
echo "   1. Deploy the Worker: npm run deploy"
echo "   2. Or run: wrangler deploy --config wrangler.jsonc"
echo ""
echo "📝 Note: Non-secret env vars are configured in wrangler.jsonc"
echo "   (AZURE_OPENAI_GPT_AUDIO_MINI_FORMAT, AZURE_OPENAI_API_VERSION, etc.)"
