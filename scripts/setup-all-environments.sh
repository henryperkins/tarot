#!/bin/bash

# Setup secrets for Cloudflare Workers default + optional preview environment.

set -euo pipefail

WORKER_NAME="${WORKER_NAME:-tableau}"
PREVIEW_ENV_NAME="${PREVIEW_ENV_NAME:-preview}"

put_worker_secret() {
  local secret_name="$1"
  local secret_value="$2"
  local target_env="${3:-}"

  if [[ -z "$target_env" ]]; then
    printf '%s' "$secret_value" | wrangler secret put "$secret_name" --name="$WORKER_NAME"
  else
    printf '%s' "$secret_value" | wrangler secret put "$secret_name" --name="$WORKER_NAME" --env="$target_env"
  fi
}

echo "Setting up secrets for Cloudflare Worker '$WORKER_NAME'"
echo ""
echo "⚠️  You will be prompted for your Azure credentials."
echo ""

read -p "Press Enter to continue or Ctrl+C to cancel..."

echo ""
echo "📝 Please provide your Azure OpenAI credentials..."
echo ""

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

echo ""
echo "📝 Setting secrets on default Worker environment..."
put_worker_secret AZURE_OPENAI_ENDPOINT "$gpt5_endpoint"
put_worker_secret AZURE_OPENAI_API_KEY "$gpt5_api_key"
put_worker_secret AZURE_OPENAI_GPT5_MODEL "$gpt5_model"
put_worker_secret AZURE_OPENAI_TTS_ENDPOINT "$tts_endpoint"
put_worker_secret AZURE_OPENAI_TTS_API_KEY "$tts_api_key"
put_worker_secret AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT "$tts_deployment"

echo ""
read -p "Also set secrets on Workers env '$PREVIEW_ENV_NAME'? (y/N): " set_preview
if [[ "$set_preview" == "y" || "$set_preview" == "Y" ]]; then
  echo ""
  echo "📝 Setting secrets on env '$PREVIEW_ENV_NAME'..."
  put_worker_secret AZURE_OPENAI_ENDPOINT "$gpt5_endpoint" "$PREVIEW_ENV_NAME"
  put_worker_secret AZURE_OPENAI_API_KEY "$gpt5_api_key" "$PREVIEW_ENV_NAME"
  put_worker_secret AZURE_OPENAI_GPT5_MODEL "$gpt5_model" "$PREVIEW_ENV_NAME"
  put_worker_secret AZURE_OPENAI_TTS_ENDPOINT "$tts_endpoint" "$PREVIEW_ENV_NAME"
  put_worker_secret AZURE_OPENAI_TTS_API_KEY "$tts_api_key" "$PREVIEW_ENV_NAME"
  put_worker_secret AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT "$tts_deployment" "$PREVIEW_ENV_NAME"
fi

echo ""
echo "✅ Secrets configured for Worker '$WORKER_NAME'"
echo ""
echo "Next steps:"
echo "  1. Verify secrets: wrangler secret list --name $WORKER_NAME"
echo "  2. Deploy: npm run deploy"
echo ""
echo "Note: --env only works when that environment exists in wrangler config."
