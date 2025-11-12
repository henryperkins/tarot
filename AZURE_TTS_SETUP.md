# Azure OpenAI TTS Setup Guide

This guide explains how to configure Azure OpenAI Text-to-Speech for the Mystic Tarot application.

## Prerequisites

1. **Azure Subscription**: Active Azure account with access to create Azure OpenAI resources
2. **Region Requirements**: Azure OpenAI resource must be in one of these regions:
   - North Central US (recommended)
   - Sweden Central
   - East US 2 (for `gpt-4o-mini-tts` model)

## Azure Portal Setup

### Step 1: Create Azure OpenAI Resource

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Create a resource** → **Azure OpenAI**
3. Fill in the required fields:
   - **Subscription**: Your subscription
   - **Resource group**: Create new or select existing
   - **Region**: Choose North Central US, Sweden Central, or East US 2
   - **Name**: Choose a unique name (e.g., `thefoundry`)
   - **Pricing tier**: Select appropriate tier

4. Click **Review + Create** → **Create**

### Step 2: Deploy a TTS Model

1. Once the resource is created, go to **Azure OpenAI Studio** or navigate to your resource in the portal
2. Go to **Deployments** (or **Model deployments**)
3. Click **+ Create new deployment**
4. Select a model:
   - **`tts-1`**: Standard quality (available in North Central US, Sweden Central)
   - **`tts-1-hd`**: High definition quality (available in North Central US, Sweden Central)
   - **`gpt-4o-mini-tts`**: Advanced with steerable instructions (available in East US 2)

5. **Important**: Choose your **Deployment name** carefully:
   - This is the custom name YOU choose (e.g., `gpt-4o-mini-tts`, `my-tts`, `tarot-voice`)
   - This name will be used in the environment variable `AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT`
   - The deployment name can be different from the model name

6. Click **Create**

### Step 3: Get Your Credentials

1. In your Azure OpenAI resource, go to **Keys and Endpoint**
2. Copy these values:
   - **Endpoint**: Should look like `https://your-resource-name.openai.azure.com`
   - **Key 1** or **Key 2**: Your API key (long alphanumeric string)

## Local Development Configuration

### Option 1: Using .env.local (Recommended for Vite)

1. Copy the example file:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` with your values:
   ```bash
   # Your Azure OpenAI endpoint (e.g., https://your-resource.openai.azure.com)
   AZURE_OPENAI_ENDPOINT=https://thefoundry.openai.azure.com

   # Your Azure OpenAI API key
   AZURE_OPENAI_API_KEY=your-api-key-here

   # The deployment name you created in Azure Portal
   AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT=gpt-4o-mini-tts

   # API version (use this exact value for TTS)
   AZURE_OPENAI_API_VERSION=2025-04-01-preview

   # Output format (mp3 recommended)
   AZURE_OPENAI_GPT_AUDIO_MINI_FORMAT=mp3
   ```

### Option 2: Using Shell Environment Variables

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
# Azure OpenAI TTS Configuration (Mystic Tarot)
export AZURE_OPENAI_ENDPOINT="https://thefoundry.openai.azure.com"
export AZURE_OPENAI_API_KEY="your-api-key-here"
export AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT="gpt-4o-mini-tts"
export AZURE_OPENAI_API_VERSION="2025-04-01-preview"
export AZURE_OPENAI_GPT_AUDIO_MINI_FORMAT="mp3"
```

Then reload your shell:
```bash
source ~/.bashrc
```

## Testing Your Configuration

Run the diagnostic script to verify everything is working:

```bash
node scripts/test-azure-tts.mjs
```

**Expected output:**
```
✅ All configuration checks passed!
✅ Your Azure OpenAI TTS configuration is working correctly!
   Size: ~65 KB
   Format: mp3
```

## Cloudflare Pages Deployment

### Adding Environment Variables

1. Go to your [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Pages** → **mystic-tarot** (your project)
3. Go to **Settings** → **Environment variables**
4. Add these variables for **Production** and **Preview** environments:

   | Variable Name | Value |
   |---------------|-------|
   | `AZURE_OPENAI_ENDPOINT` | `https://your-resource.openai.azure.com` |
   | `AZURE_OPENAI_API_KEY` | Your API key (mark as encrypted) |
   | `AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT` | Your deployment name |
   | `AZURE_OPENAI_API_VERSION` | `2025-04-01-preview` |
   | `AZURE_OPENAI_GPT_AUDIO_MINI_FORMAT` | `mp3` |

5. **Important**: Mark `AZURE_OPENAI_API_KEY` as **Encrypted** for security

### Deploy to Cloudflare Pages

```bash
# Build the project
npm run build

# Deploy
npm run deploy
# or
wrangler pages deploy dist --project-name=mystic-tarot
```

## Troubleshooting

### Issue: "Using legacy endpoint"

**Symptom**: Diagnostic script reports legacy endpoint format

**Solution**: Endpoint must be `https://your-resource.openai.azure.com` (NOT `cognitiveservices.azure.com`)

```bash
# Correct format:
AZURE_OPENAI_ENDPOINT=https://thefoundry.openai.azure.com

# Incorrect legacy format:
AZURE_OPENAI_ENDPOINT=https://thefoundry.cognitiveservices.azure.com
```

### Issue: "DeploymentNotFound" Error

**Symptom**: API returns 404 or "deployment not found"

**Causes and Solutions**:

1. **Deployment name mismatch**:
   - Check your deployment name in Azure Portal → Deployments
   - Use the EXACT name you created (case-sensitive)
   - Example: If you named it `gpt-4o-mini-tts` in the portal, use exactly that

2. **Wrong resource**:
   - Ensure your API key and endpoint are from the SAME Azure OpenAI resource
   - The deployment must exist in that specific resource

3. **Region mismatch**:
   - Verify your resource is in a supported region for TTS
   - `gpt-4o-mini-tts` requires East US 2

### Issue: Authentication Failed (401/403)

**Causes and Solutions**:

1. **Invalid or expired API key**:
   - Regenerate key in Azure Portal → Keys and Endpoint
   - Update your environment variables

2. **Key from different resource**:
   - Ensure API key matches the resource where your deployment exists

3. **Permissions issue**:
   - Verify you have access to the resource
   - Check Azure RBAC roles

### Issue: "Falling back to local waveform"

**Symptom**: App plays a chime instead of narration

**Causes**:

1. **Missing environment variables**:
   - All three required vars must be set: `ENDPOINT`, `API_KEY`, `DEPLOYMENT`
   - Run diagnostic script to check: `node scripts/test-azure-tts.mjs`

2. **Configuration errors**:
   - Check the browser console (F12) for specific error messages
   - Backend logs in Cloudflare Pages dashboard will show Azure API errors

3. **API request failing**:
   - Network issues or Azure service outage
   - Check Azure Service Health in the portal

### Issue: Environment Variables Not Loading

**Symptom**: Diagnostic passes but app still falls back

**Solutions**:

1. **Restart dev server**:
   ```bash
   # Stop the dev server (Ctrl+C)
   npm run dev
   ```

2. **Check environment variable precedence**:
   - System env vars override `.env.local`
   - Update system vars in `~/.bashrc` and reload shell

3. **For Cloudflare Pages**:
   - Check that env vars are set in Cloudflare Dashboard
   - Redeploy after adding env vars: `npm run deploy`

## Security Best Practices

1. **Never commit API keys**:
   - `.env.local` is gitignored
   - Never commit `.env` files with real credentials

2. **Use Key Vault for production**:
   - Consider Azure Key Vault for enterprise deployments
   - Implement key rotation policies

3. **Restrict API key permissions**:
   - Use Azure RBAC to limit access
   - Monitor usage in Azure Portal

4. **Encrypt environment variables**:
   - Always mark sensitive vars as encrypted in Cloudflare Pages

## Cost Management

### Azure OpenAI TTS Pricing (as of 2024)

- **Standard models** (`tts-1`):
  - ~$0.015 per 1K characters

- **HD models** (`tts-1-hd`):
  - ~$0.030 per 1K characters

- **Advanced models** (`gpt-4o-mini-tts`):
  - Pricing varies; check Azure portal for current rates

### Monitoring Usage

1. Go to **Azure Portal** → Your Azure OpenAI resource
2. Navigate to **Monitoring** → **Metrics**
3. Track:
   - Total calls
   - Character count
   - Estimated costs

## Supported Features

### Voices

Available voices for all TTS models:
- `alloy` - Neutral, balanced
- `echo` - Male, clear
- `fable` - Expressive, British accent
- `nova` - Female, warm (default for Mystic Tarot)
- `onyx` - Male, deep
- `shimmer` - Female, soft

### Steerable Instructions (gpt-4o-mini-tts only)

The app automatically uses context-aware instructions for `gpt-4o-mini-tts`:

- **card-reveal**: Gentle, reverent tone for individual cards
- **full-reading**: Contemplative, mystical tone for complete readings
- **synthesis**: Flowing, storytelling cadence
- **question**: Warm, inviting acknowledgment
- **reflection**: Soft, affirming validation

Standard models (`tts-1`, `tts-1-hd`) do not support instructions.

## Resources

- [Azure OpenAI Service Documentation](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- [Text-to-Speech Quickstart](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/text-to-speech-quickstart)
- [Azure OpenAI Pricing](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/)
- [Cloudflare Pages Environment Variables](https://developers.cloudflare.com/pages/configuration/build-configuration/#environment-variables)

## Support

If you encounter issues:

1. Run the diagnostic script: `node scripts/test-azure-tts.mjs`
2. Check Azure Service Health in the portal
3. Review Cloudflare Pages deployment logs
4. Verify your configuration against this guide
