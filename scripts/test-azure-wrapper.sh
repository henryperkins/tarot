#!/bin/bash
# Wrapper to test Azure OpenAI Responses API with wrangler secrets

echo "🔐 Fetching Azure configuration from Cloudflare secrets..."

# Get secrets (they're encrypted, so we'll use wrangler to test via a deployed function instead)
echo ""
echo "⚠️  Cannot read encrypted secrets locally."
echo "Instead, let's test via the deployed endpoint with extra logging."
echo ""
echo "Deploying a test version with verbose logging..."
