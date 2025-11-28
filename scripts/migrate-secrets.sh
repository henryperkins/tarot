#!/bin/bash
# =============================================================================
# Secrets Migration Script: Pages Functions → Workers
# =============================================================================
# This script helps migrate secrets from Cloudflare Pages to Cloudflare Workers.
# 
# Pages secrets are stored separately from Workers secrets, so you need to
# re-add them to the Workers deployment.
#
# Usage:
#   ./scripts/migrate-secrets.sh           # Interactive mode (prompts for values)
#   ./scripts/migrate-secrets.sh --from-env # Uses .dev.vars file values
# =============================================================================

set -e

WORKER_NAME="tableau"

# List of required secrets (must have values)
REQUIRED_SECRETS=(
  "AZURE_OPENAI_ENDPOINT"
  "AZURE_OPENAI_API_KEY"
  "AZURE_OPENAI_GPT5_MODEL"
)

# List of optional secrets (may be empty)
OPTIONAL_SECRETS=(
  "AZURE_OPENAI_TTS_ENDPOINT"
  "AZURE_OPENAI_TTS_API_KEY"
  "AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT"
  "ANTHROPIC_API_KEY"
  "VISION_PROOF_SECRET"
  "HUME_API_KEY"
)

echo "========================================"
echo "Cloudflare Workers Secrets Migration"
echo "========================================"
echo ""
echo "This script will add secrets to Worker: $WORKER_NAME"
echo ""

# Check if wrangler is available
if ! command -v wrangler &> /dev/null; then
  echo "❌ Error: wrangler CLI not found. Install with: npm install -g wrangler"
  exit 1
fi

# Function to add a secret
add_secret() {
  local secret_name=$1
  local secret_value=$2
  
  if [ -n "$secret_value" ]; then
    echo "$secret_value" | wrangler secret put "$secret_name" --name "$WORKER_NAME"
    echo "✅ Added secret: $secret_name"
  else
    echo "⏭️  Skipped (empty): $secret_name"
  fi
}

# Check for --from-env flag
if [ "$1" == "--from-env" ]; then
  echo "📁 Reading secrets from .dev.vars file..."
  
  if [ ! -f ".dev.vars" ]; then
    echo "❌ Error: .dev.vars file not found"
    echo "   Create it from .dev.vars.example first"
    exit 1
  fi
  
  # Source the .dev.vars file
  set -a
  source .dev.vars
  set +a
  
  echo ""
  echo "Adding required secrets..."
  for secret in "${REQUIRED_SECRETS[@]}"; do
    value="${!secret}"
    if [ -z "$value" ]; then
      echo "❌ Error: Required secret $secret is empty in .dev.vars"
      exit 1
    fi
    add_secret "$secret" "$value"
  done
  
  echo ""
  echo "Adding optional secrets..."
  for secret in "${OPTIONAL_SECRETS[@]}"; do
    value="${!secret}"
    add_secret "$secret" "$value"
  done
  
else
  echo "🔐 Interactive mode - you'll be prompted for each secret"
  echo "   (Use --from-env to read from .dev.vars instead)"
  echo ""
  
  echo "Adding required secrets..."
  for secret in "${REQUIRED_SECRETS[@]}"; do
    echo ""
    echo "Enter value for $secret:"
    wrangler secret put "$secret" --name "$WORKER_NAME"
  done
  
  echo ""
  echo "Adding optional secrets (press Enter to skip)..."
  for secret in "${OPTIONAL_SECRETS[@]}"; do
    echo ""
    read -p "Add $secret? (y/N): " yn
    if [ "$yn" == "y" ] || [ "$yn" == "Y" ]; then
      wrangler secret put "$secret" --name "$WORKER_NAME"
    else
      echo "⏭️  Skipped: $secret"
    fi
  done
fi

echo ""
echo "========================================"
echo "✅ Secrets migration complete!"
echo "========================================"
echo ""
echo "To verify secrets are set:"
echo "  wrangler secret list --name $WORKER_NAME"
echo ""
echo "To deploy with new secrets:"
echo "  npm run deploy"