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
echo "You will be prompted for your OpenAI reading credential and optional ElevenLabs narration credential."
echo ""

read -p "Press Enter to continue or Ctrl+C to cancel..."

echo ""
echo "📝 Please provide your OpenAI Responses API reading credential..."
echo ""

echo "OpenAI API Key (input will be hidden):"
read -s gpt5_api_key
echo ""

echo ""
read -sp "ElevenLabs API key, or press Enter to use Workers AI narration: " elevenlabs_api_key
echo ""

echo ""
echo "📝 Setting secrets on default Worker environment..."
put_worker_secret OPENAI_API_KEY "$gpt5_api_key"
if [[ -n "$elevenlabs_api_key" ]]; then
  put_worker_secret ELEVENLABS_API_KEY "$elevenlabs_api_key"
fi

echo ""
read -p "Also set secrets on Workers env '$PREVIEW_ENV_NAME'? (y/N): " set_preview
if [[ "$set_preview" == "y" || "$set_preview" == "Y" ]]; then
  echo ""
  echo "📝 Setting secrets on env '$PREVIEW_ENV_NAME'..."
  put_worker_secret OPENAI_API_KEY "$gpt5_api_key" "$PREVIEW_ENV_NAME"
  if [[ -n "$elevenlabs_api_key" ]]; then
    put_worker_secret ELEVENLABS_API_KEY "$elevenlabs_api_key" "$PREVIEW_ENV_NAME"
  fi
fi

echo ""
echo "✅ Secrets configured for Worker '$WORKER_NAME'"
echo ""
echo "Next steps:"
echo "  1. Verify secrets: wrangler secret list --name $WORKER_NAME"
echo "  2. Deploy: npm run deploy"
echo ""
echo "Note: --env only works when that environment exists in wrangler config."
