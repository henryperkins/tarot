#!/bin/bash
# Migrate secrets from .dev.vars to the new Tableau project

PROJECT_NAME="tableau"
ENV_FILE=".dev.vars"

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: $ENV_FILE not found."
    exit 1
fi

echo "Migrating secrets from $ENV_FILE to Cloudflare Pages project: $PROJECT_NAME"

# List of secrets to migrate
SECRETS=(
    "AZURE_OPENAI_ENDPOINT"
    "AZURE_OPENAI_API_KEY"
    "AZURE_OPENAI_GPT5_MODEL"
    "AZURE_OPENAI_TTS_ENDPOINT"
    "AZURE_OPENAI_TTS_API_KEY"
    "AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT"
    "VISION_PROOF_SECRET"
)

for SECRET_NAME in "${SECRETS[@]}"; do
    # Extract value from .dev.vars
    # grep for the line, then cut after the first '='
    VALUE=$(grep "^$SECRET_NAME=" "$ENV_FILE" | cut -d'=' -f2-)

    if [ -n "$VALUE" ]; then
        echo "Uploading $SECRET_NAME..."
        # Remove potential quotes around the value
        VALUE=$(echo "$VALUE" | sed -e 's/^"//' -e 's/"$//')
        echo "$VALUE" | wrangler pages secret put "$SECRET_NAME" --project-name="$PROJECT_NAME"
    else
        echo "Warning: $SECRET_NAME not found in $ENV_FILE"
    fi
done

echo "Migration complete!"
