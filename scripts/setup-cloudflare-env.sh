#!/bin/bash
# Setup Cloudflare Pages environment variables for Azure TTS

set -e

echo "🔧 Setting up Cloudflare Pages environment variables..."
echo ""

PROJECT_NAME="tableau"

# Read from .env.local or current environment
ENDPOINT="${AZURE_OPENAI_ENDPOINT:-https://thefoundry.openai.azure.com}"
API_KEY="${AZURE_OPENAI_API_KEY}"
DEPLOYMENT="${AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT:-gpt-4o-mini-tts}"
API_VERSION="${AZURE_OPENAI_API_VERSION:-2025-04-01-preview}"
FORMAT="${AZURE_OPENAI_GPT_AUDIO_MINI_FORMAT:-mp3}"

if [ -z "$API_KEY" ]; then
  echo "❌ Error: AZURE_OPENAI_API_KEY not found in environment"
  echo "   Please export it first or ensure .env.local is loaded"
  exit 1
fi

echo "📋 Configuration to deploy:"
echo "   Endpoint: $ENDPOINT"
echo "   Deployment: $DEPLOYMENT"
echo "   API Version: $API_VERSION"
echo "   Format: $FORMAT"
echo ""
echo "⚠️  API Key will be set (encrypted)"
echo ""

read -p "Deploy these settings to Cloudflare Pages? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

echo ""
echo "🚀 Deploying to production environment..."

# Set production environment variables
wrangler pages project variable add \
  --project-name="$PROJECT_NAME" \
  --environment="production" \
  AZURE_OPENAI_ENDPOINT="$ENDPOINT" \
  AZURE_OPENAI_API_KEY="$API_KEY" \
  AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT="$DEPLOYMENT" \
  AZURE_OPENAI_API_VERSION="$API_VERSION" \
  AZURE_OPENAI_GPT_AUDIO_MINI_FORMAT="$FORMAT"

echo ""
echo "✅ Environment variables deployed to production!"
echo ""
echo "🔄 Next steps:"
echo "   1. Trigger a new deployment to pick up the variables"
echo "   2. Or run: npm run deploy"
echo ""
echo "🌐 Your site: https://tableau-8xz.pages.dev/"
