/**
 * Cloudflare Workers Entry Point
 *
 * Main router that handles all incoming requests, routing to API handlers
 * or serving static assets via the ASSETS binding.
 *
 * Migrated from Cloudflare Pages Functions to Workers with Static Assets.
 */

// API Route Handlers (imported from existing functions)
import * as tarotReading from '../../functions/api/tarot-reading.js';
import * as tts from '../../functions/api/tts.js';
import * as ttsHume from '../../functions/api/tts-hume.js';
import * as speechToken from '../../functions/api/speech-token.js';
import * as journal from '../../functions/api/journal.js';
import * as journalById from '../../functions/api/journal/[id].js';
import * as journalSummary from '../../functions/api/journal-summary.js';
import * as feedback from '../../functions/api/feedback.js';
import * as generateQuestion from '../../functions/api/generate-question.js';
import * as share from '../../functions/api/share.js';
import * as shareToken from '../../functions/api/share/[token].js';
import * as shareNotes from '../../functions/api/share-notes/[token].js';
import * as visionProof from '../../functions/api/vision-proof.js';
import * as archetypeJourney from '../../functions/api/archetype-journey.js';
import * as archetypeJourneyBackfill from '../../functions/api/archetype-journey-backfill.js';

// Auth handlers
import * as authLogin from '../../functions/api/auth/login.js';
import * as authLogout from '../../functions/api/auth/logout.js';
import * as authRegister from '../../functions/api/auth/register.js';
import * as authMe from '../../functions/api/auth/me.js';

// API Keys handlers
import * as keysIndex from '../../functions/api/keys/index.js';
import * as keysById from '../../functions/api/keys/[id].js';

// Health check handlers
import * as healthTarotReading from '../../functions/api/health/tarot-reading.js';
import * as healthTts from '../../functions/api/health/tts.js';

// Export handlers
import * as journalExport from '../../functions/api/journal-export.js';

// Scheduled tasks
import { handleScheduled, onRequestPost as adminArchive } from '../../functions/lib/scheduled.js';

// Utility functions
import { jsonResponse } from '../../functions/lib/utils.js';

/**
 * Route definitions mapping URL patterns to handlers
 * Each route can have GET, POST, PUT, DELETE, etc. handlers
 */
const routes = [
  // Main API endpoints
  { pattern: /^\/api\/tarot-reading$/, handlers: tarotReading },
  { pattern: /^\/api\/tts$/, handlers: tts },
  { pattern: /^\/api\/tts-hume$/, handlers: ttsHume },
  { pattern: /^\/api\/speech-token$/, handlers: speechToken },
  { pattern: /^\/api\/journal$/, handlers: journal },
  { pattern: /^\/api\/journal\/([^/]+)$/, handlers: journalById, params: ['id'] },
  { pattern: /^\/api\/journal-summary$/, handlers: journalSummary },
  { pattern: /^\/api\/feedback$/, handlers: feedback },
  { pattern: /^\/api\/generate-question$/, handlers: generateQuestion },
  { pattern: /^\/api\/share$/, handlers: share },
  { pattern: /^\/api\/share\/([^/]+)$/, handlers: shareToken, params: ['token'] },
  { pattern: /^\/api\/share-notes\/([^/]+)$/, handlers: shareNotes, params: ['token'] },
  { pattern: /^\/api\/vision-proof$/, handlers: visionProof },
  { pattern: /^\/api\/archetype-journey$/, handlers: archetypeJourney },
  { pattern: /^\/api\/archetype-journey\/(.*)$/, handlers: archetypeJourney, params: ['path'] },
  { pattern: /^\/api\/archetype-journey-backfill$/, handlers: archetypeJourneyBackfill },

  // Auth endpoints
  { pattern: /^\/api\/auth\/login$/, handlers: authLogin },
  { pattern: /^\/api\/auth\/logout$/, handlers: authLogout },
  { pattern: /^\/api\/auth\/register$/, handlers: authRegister },
  { pattern: /^\/api\/auth\/me$/, handlers: authMe },

  // API Keys management
  { pattern: /^\/api\/keys$/, handlers: keysIndex },
  { pattern: /^\/api\/keys\/([^/]+)$/, handlers: keysById, params: ['id'] },

  // Health check endpoints
  { pattern: /^\/api\/health\/tarot-reading$/, handlers: healthTarotReading },
  { pattern: /^\/api\/health\/tts$/, handlers: healthTts },

  // Export endpoints
  { pattern: /^\/api\/journal-export$/, handlers: journalExport },
  { pattern: /^\/api\/journal-export\/([^/]+)$/, handlers: journalExport, params: ['id'] },

  // Admin endpoints
  { pattern: /^\/api\/admin\/archive$/, handlers: { onRequestPost: adminArchive } },
];

/**
 * Map HTTP method to Pages Functions handler name
 */
function getHandlerName(method) {
  const methodMap = {
    'GET': 'onRequestGet',
    'POST': 'onRequestPost',
    'PUT': 'onRequestPut',
    'DELETE': 'onRequestDelete',
    'PATCH': 'onRequestPatch',
    'OPTIONS': 'onRequestOptions',
    'HEAD': 'onRequestHead',
  };
  return methodMap[method] || 'onRequest';
}

/**
 * Find matching route and extract parameters
 */
function matchRoute(pathname) {
  for (const route of routes) {
    const match = pathname.match(route.pattern);
    if (match) {
      const params = {};
      if (route.params) {
        route.params.forEach((paramName, index) => {
          params[paramName] = match[index + 1];
        });
      }
      return { route, params };
    }
  }
  return null;
}

/**
 * Handle CORS preflight requests
 * Echoes back the request Origin when credentials may be needed
 */
function handleOptions(request) {
  const origin = request.headers.get('Origin') || '*';
  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
  return new Response(null, { status: 204, headers });
}

/**
 * Add CORS headers to response if not already set by the handler.
 * Preserves handler-set headers to support credentialed requests
 * (which require echoing the specific Origin, not '*').
 */
function addCorsHeaders(response, request) {
  const newHeaders = new Headers(response.headers);

  // Only add CORS headers if not already present (handler takes precedence)
  if (!newHeaders.has('Access-Control-Allow-Origin')) {
    const origin = request.headers.get('Origin') || '*';
    newHeaders.set('Access-Control-Allow-Origin', origin);
    newHeaders.set('Access-Control-Allow-Credentials', 'true');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Environment type definition for TypeScript-like documentation
 * @typedef {Object} Env
 * @property {Fetcher} ASSETS - Static assets binding
 * @property {D1Database} DB - D1 database for auth
 * @property {KVNamespace} RATELIMIT - Rate limiting KV
 * @property {KVNamespace} METRICS_DB - Metrics storage KV
 * @property {KVNamespace} FEEDBACK_KV - Feedback storage KV
 * @property {R2Bucket} LOGS_BUCKET - R2 bucket for logs, archives, and exports
 * @property {*} AI - Workers AI binding for evaluation
 * @property {string} AZURE_OPENAI_ENDPOINT - Azure OpenAI endpoint
 * @property {string} AZURE_OPENAI_API_KEY - Azure OpenAI API key
 * @property {string} AZURE_OPENAI_GPT5_MODEL - GPT-5 model deployment name
 * @property {string} ANTHROPIC_API_KEY - Anthropic API key
 * @property {string} VISION_PROOF_SECRET - Vision proof signing secret
 * @property {string} HUME_API_KEY - Hume AI API key
 * @property {string} ADMIN_API_KEY - Admin API key for manual archival
 * @property {string} EVAL_ENABLED - Enable evaluation (string flag)
 * @property {string} EVAL_MODEL - Workers AI model id for evaluation
 * @property {string} EVAL_TIMEOUT_MS - Evaluation timeout in milliseconds
 * @property {string} EVAL_GATE_ENABLED - Enable gating on eval results
 * @property {string} EVAL_GATEWAY_ID - AI Gateway id for routing eval calls
 */

export default {
  /**
   * Scheduled handler for cron triggers
   * @param {ScheduledController} controller - Cron controller
   * @param {Env} env - Environment bindings
   * @param {ExecutionContext} ctx - Execution context
   */
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(handleScheduled(controller, env, ctx));
  },

  /**
   * Main fetch handler for all incoming requests
   * @param {Request} request - Incoming request
   * @param {Env} env - Environment bindings
   * @param {ExecutionContext} ctx - Execution context
   * @returns {Promise<Response>}
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return handleOptions(request);
    }

    // Check if this is an API route
    if (pathname.startsWith('/api/')) {
      try {
        const matched = matchRoute(pathname);

        if (!matched) {
          return addCorsHeaders(jsonResponse(
            { error: 'Not found', path: pathname },
            { status: 404 }
          ), request);
        }

        const { route, params } = matched;
        const handlerName = getHandlerName(method);

        // Check for method-specific handler first, then fall back to generic onRequest
        const handler = route.handlers[handlerName] || route.handlers.onRequest;

        if (!handler) {
          return addCorsHeaders(jsonResponse(
            { error: 'Method not allowed', method, path: pathname },
            { status: 405 }
          ), request);
        }

        // Build context object similar to Pages Functions
        const context = {
          request,
          env,
          params,
          waitUntil: ctx.waitUntil.bind(ctx),
          passThroughOnException: () => { }, // Not applicable in Workers
          next: async () => env.ASSETS.fetch(request), // Fall through to assets
          data: {},
        };

        // Call the handler
        const response = await handler(context);
        return addCorsHeaders(response, request);

      } catch (error) {
        console.error('API Error:', error);
        return addCorsHeaders(jsonResponse(
          { error: 'Internal server error', message: error.message },
          { status: 500 }
        ), request);
      }
    }

    // For non-API routes, serve static assets
    // The ASSETS binding handles SPA fallback via not_found_handling config
    return env.ASSETS.fetch(request);
  },
};
