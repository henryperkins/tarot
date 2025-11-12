#!/bin/bash

# Simple Azure OpenAI TTS Test Script
# Based on Microsoft official documentation
# https://learn.microsoft.com/en-us/azure/ai-foundry/openai/text-to-speech-quickstart

echo "🎙️  Azure OpenAI TTS Simple Test"
echo "================================"
echo ""

# Load environment variables from .env.local if it exists
if [ -f ".env.local" ]; then
    echo "📋 Loading environment variables from .env.local..."
    export $(grep -v '^#' .env.local | xargs)
    echo ""
fi

# Check required variables
if [ -z "$AZURE_OPENAI_ENDPOINT" ]; then
    echo "❌ AZURE_OPENAI_ENDPOINT is not set"
    echo "   Please edit .env.local and add your endpoint"
    exit 1
fi

if [ -z "$AZURE_OPENAI_API_KEY" ]; then
    echo "❌ AZURE_OPENAI_API_KEY is not set"
    echo "   Please edit .env.local and add your API key"
    exit 1
fi

if [ -z "$AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT" ]; then
    echo "❌ AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT is not set"
    echo "   Please edit .env.local and add your deployment name"
    exit 1
fi

DEPLOYMENT_NAME="$AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT"
API_VERSION="${AZURE_OPENAI_API_VERSION:-2025-04-01-preview}"

echo "✅ Configuration:"
echo "   Endpoint: $AZURE_OPENAI_ENDPOINT"
echo "   Deployment: $DEPLOYMENT_NAME"
echo "   API Version: $API_VERSION"
echo ""

# Build the URL
URL="${AZURE_OPENAI_ENDPOINT}/openai/deployments/${DEPLOYMENT_NAME}/audio/speech?api-version=${API_VERSION}"

echo "📡 Testing TTS with a simple request..."
echo "   URL: $URL"
echo ""

# Make the request (based on Microsoft docs)
HTTP_CODE=$(curl -w "%{http_code}" -o speech-test.mp3 "$URL" \
  -H "api-key: $AZURE_OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "'"$DEPLOYMENT_NAME"'",
    "input": "Testing Azure OpenAI text to speech. The Fool begins a journey.",
    "voice": "nova"
  }' 2>/dev/null)

echo ""

if [ "$HTTP_CODE" = "200" ]; then
    FILE_SIZE=$(stat -f%z speech-test.mp3 2>/dev/null || stat -c%s speech-test.mp3 2>/dev/null)
    echo "✅ SUCCESS! TTS is working"
    echo "   HTTP Status: $HTTP_CODE"
    echo "   Audio file: speech-test.mp3"
    echo "   Size: $(echo "scale=2; $FILE_SIZE / 1024" | bc) KB"
    echo ""
    echo "🎵 Play the file to hear the audio:"
    echo "   mpg123 speech-test.mp3"
    echo "   or open speech-test.mp3 in your media player"
    echo ""
    echo "🎉 Your Azure OpenAI TTS integration is working correctly!"
elif [ "$HTTP_CODE" = "401" ]; then
    echo "❌ Authentication failed (401)"
    echo "   Check your AZURE_OPENAI_API_KEY"
    cat speech-test.mp3
    rm -f speech-test.mp3
    exit 1
elif [ "$HTTP_CODE" = "404" ]; then
    echo "❌ Deployment not found (404)"
    echo "   Check your endpoint and deployment name"
    echo "   Endpoint: $AZURE_OPENAI_ENDPOINT"
    echo "   Deployment: $DEPLOYMENT_NAME"
    cat speech-test.mp3
    rm -f speech-test.mp3
    exit 1
else
    echo "❌ Request failed with HTTP $HTTP_CODE"
    echo "   Response:"
    cat speech-test.mp3
    rm -f speech-test.mp3
    exit 1
fi
