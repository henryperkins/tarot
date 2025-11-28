#!/bin/bash
# Development server startup script for Tableau
# This starts both Vite (frontend) and Wrangler Workers (API) together
#
# MIGRATION NOTE: Updated from Pages Functions to Workers with Static Assets

set -e

ENV_FILE=".dev.vars"
if [ -f "$ENV_FILE" ]; then
  echo "🔐 Loading environment variables from $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  echo "⚠️  $ENV_FILE not found. API-powered features will fall back to local generators."
fi

echo "🔮 Starting Tableau development environment (Workers mode)..."
echo ""

# Kill any existing processes on our ports
echo "Cleaning up any existing processes..."
lsof -ti:5173,5174,8787 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

# Start Vite in background for frontend HMR
echo "📦 Starting Vite frontend server..."
npm run dev:frontend &
VITE_PID=$!

# Wait for Vite to be ready
echo "⏳ Waiting for Vite to start..."
for i in {1..30}; do
  if curl -s http://localhost:5173 >/dev/null 2>&1 || curl -s http://localhost:5174 >/dev/null 2>&1; then
    echo "✅ Vite is ready!"
    break
  fi
  sleep 1
  if [ $i -eq 30 ]; then
    echo "❌ Vite failed to start"
    kill $VITE_PID 2>/dev/null || true
    exit 1
  fi
done

# Detect which port Vite is using
VITE_PORT=5173
if ! curl -s http://localhost:5173 >/dev/null 2>&1; then
  VITE_PORT=5174
fi

echo "📍 Vite running on port $VITE_PORT"

# Build frontend assets first for Workers to serve
echo "🏗️  Building frontend assets for Workers..."
npm run build

# Start Wrangler Workers dev server
echo "⚡ Starting Wrangler Workers dev server..."
wrangler dev --config wrangler.jsonc --live-reload &
WRANGLER_PID=$!

# Cleanup function
cleanup() {
  echo ""
  echo "🛑 Shutting down development servers..."
  kill $VITE_PID 2>/dev/null || true
  kill $WRANGLER_PID 2>/dev/null || true
  lsof -ti:5173,5174,8787 2>/dev/null | xargs kill -9 2>/dev/null || true
  echo "✅ Cleanup complete"
  exit 0
}

trap cleanup EXIT INT TERM

# Wait for Wrangler Workers to be ready
echo "⏳ Waiting for Workers..."
for i in {1..30}; do
  if curl -s http://localhost:8787 >/dev/null 2>&1; then
    echo "✅ Workers dev server is ready!"
    break
  fi
  sleep 1
  if [ $i -eq 30 ]; then
    echo "❌ Workers dev server failed to start"
    cleanup
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Development environment ready! (Workers mode)"
echo ""
echo "🌐 Access your app at: http://localhost:$VITE_PORT"
echo ""
echo "📝 Notes:"
echo "  - Frontend HMR (Vite): http://localhost:$VITE_PORT (USE THIS!)"
echo "  - Full app with API: http://localhost:8787 (API backend)"
echo "  - Workers serve static assets from dist/"
echo "  - API routes handled by src/worker/index.js"
echo "  - Press Ctrl+C to stop all servers"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Keep the script running
wait
