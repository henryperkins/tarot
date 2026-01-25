#!/bin/bash
# Check if running in local development or should use production
# Usage: source check-environment.sh && echo $TABLEU_ENV

# Check if wrangler dev is running on port 8787
if lsof -i :8787 >/dev/null 2>&1; then
    export TABLEU_ENV="local"
    export TABLEU_D1_FLAG="--local"
    echo "Detected: Local development (wrangler dev running on :8787)"
else
    export TABLEU_ENV="production"
    export TABLEU_D1_FLAG="--remote"
    echo "Detected: Production (no local dev server)"
fi

# Output the flag for use in commands
echo "Use D1 flag: $TABLEU_D1_FLAG"
