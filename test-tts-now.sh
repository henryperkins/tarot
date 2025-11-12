#!/bin/bash

echo "🔍 Quick TTS Configuration Check"
echo "================================"
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local file not found"
    echo "   Please create it first"
    exit 1
fi

# Load variables
export $(grep -v '^#' .env.local | xargs)

# Check required variables
echo "📋 Checking configuration..."
echo ""

if [ -z "$AZURE_OPENAI_ENDPOINT" ]; then
    echo "❌ AZURE_OPENAI_ENDPOINT is not set in .env.local"
    echo "   Add: AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com"
    exit 1
else
    echo "✅ AZURE_OPENAI_ENDPOINT: $AZURE_OPENAI_ENDPOINT"
fi

if [ -z "$AZURE_OPENAI_API_KEY" ]; then
    echo "❌ AZURE_OPENAI_API_KEY is not set"
    exit 1
else
    echo "✅ AZURE_OPENAI_API_KEY: ${AZURE_OPENAI_API_KEY:0:10}...${AZURE_OPENAI_API_KEY: -10}"
fi

if [ -z "$AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT" ]; then
    echo "❌ AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT is not set in .env.local"
    echo "   Add: AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT=your-deployment-name"
    exit 1
else
    echo "✅ AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT: $AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT"
fi

echo ""
echo "🎉 All required variables are set!"
echo ""
echo "Next: Run the full test:"
echo "  ./scripts/test-azure-tts-simple.sh"
