#!/bin/bash

# Setup secrets for BOTH production and preview environments
# This script securely prompts for credentials and uploads to both environments

set -e

PROJECT_NAME="tableau"

echo "Setting up secrets for BOTH production AND preview environments..."
echo ""
echo "⚠️  You will be prompted for your Azure credentials."
echo "    They will be uploaded to both production and preview environments."
echo ""

read -p "Press Enter to continue or Ctrl+C to cancel..."

echo ""
echo "📝 Please provide your Azure OpenAI GPT-5.1 credentials..."
echo ""

# Collect all credentials first
read -p "GPT-5.1 Endpoint (e.g., https://your-resource.openai.azure.com): " gpt5_endpoint
echo ""
echo "GPT-5.1 API Key (input will be hidden):"
read -s gpt5_api_key
echo ""
read -p "GPT-5.1 Deployment Name (e.g., gpt-5.1): " gpt5_model

echo ""
read -p "TTS Endpoint (e.g., https://your-tts-resource.openai.azure.com): " tts_endpoint
echo ""
echo "TTS API Key (input will be hidden):"
read -s tts_api_key
echo ""
read -p "TTS Deployment Name (e.g., gpt-audio-mini): " tts_deployment

# Set secrets for PRODUCTION
echo ""
echo "📝 Setting GPT-5.1 secrets for production..."
echo "$gpt5_endpoint" | wrangler pages secret put AZURE_OPENAI_ENDPOINT --project-name=$PROJECT_NAME
echo "$gpt5_api_key" | wrangler pages secret put AZURE_OPENAI_API_KEY --project-name=$PROJECT_NAME
echo "$gpt5_model" | wrangler pages secret put AZURE_OPENAI_GPT5_MODEL --project-name=$PROJECT_NAME

echo ""
echo "📝 Setting TTS secrets for production..."
echo "$tts_endpoint" | wrangler pages secret put AZURE_OPENAI_TTS_ENDPOINT --project-name=$PROJECT_NAME
echo "$tts_api_key" | wrangler pages secret put AZURE_OPENAI_TTS_API_KEY --project-name=$PROJECT_NAME
echo "$tts_deployment" | wrangler pages secret put AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT --project-name=$PROJECT_NAME

# Set secrets for PREVIEW
echo ""
echo "📝 Setting GPT-5.1 secrets for preview..."
echo "$gpt5_endpoint" | wrangler pages secret put AZURE_OPENAI_ENDPOINT --project-name=$PROJECT_NAME --env=preview
echo "$gpt5_api_key" | wrangler pages secret put AZURE_OPENAI_API_KEY --project-name=$PROJECT_NAME --env=preview
echo "$gpt5_model" | wrangler pages secret put AZURE_OPENAI_GPT5_MODEL --project-name=$PROJECT_NAME --env=preview

echo ""
echo "📝 Setting TTS secrets for preview..."
echo "$tts_endpoint" | wrangler pages secret put AZURE_OPENAI_TTS_ENDPOINT --project-name=$PROJECT_NAME --env=preview
echo "$tts_api_key" | wrangler pages secret put AZURE_OPENAI_TTS_API_KEY --project-name=$PROJECT_NAME --env=preview
echo "$tts_deployment" | wrangler pages secret put AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT --project-name=$PROJECT_NAME --env=preview

echo ""
echo "✅ All secrets set for both production and preview!"
echo ""
echo "Now deploy:"
echo "  npm run deploy"
echo ""
