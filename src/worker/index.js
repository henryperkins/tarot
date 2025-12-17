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
import * as shareTokenOgImage from '../../functions/api/share/[token]/og-image.js';
import * as shareNotes from '../../functions/api/share-notes/[token].js';
import * as visionProof from '../../functions/api/vision-proof.js';
import * as archetypeJourney from '../../functions/api/archetype-journey.js';
import * as archetypeJourneyBackfill from '../../functions/api/archetype-journey-backfill.js';
import * as coachExtractionBackfill from '../../functions/api/coach-extraction-backfill.js';

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

// Share page OG meta tag injection
import { loadShareRecord, loadShareEntries } from '../../functions/lib/shareData.js';

/**
 * Build OG meta tags for a share link.
 * These tags enable rich previews when the link is shared on social media.
 *
 * @param {string} token - Share token
 * @param {Object} shareRecord - Share record from database
 * @param {Array} entries - Shared entries
 * @param {string} baseUrl - Base URL of the site
 * @returns {string} HTML meta tags
 */
function buildShareOgMetaTags(token, shareRecord, entries, baseUrl) {
  const entry = entries?.[0];
  const title = shareRecord?.title || entry?.spread || 'Tarot Reading';
  const description = entry?.question
    ? `"${entry.question.slice(0, 100)}${entry.question.length > 100 ? '...' : ''}"`
    : `A ${entry?.spread || 'tarot'} reading shared via Mystic Tarot`;

  const ogImageUrl = `${baseUrl}/api/share/${token}/og-image`;
  const shareUrl = `${baseUrl}/share/${token}`;

  // Escape HTML special characters
  const escape = (str) => String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return `
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${escape(shareUrl)}">
    <meta property="og:title" content="${escape(title)} | Mystic Tarot">
    <meta property="og:description" content="${escape(description)}">
    <meta property="og:image" content="${escape(ogImageUrl)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="Mystic Tarot">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${escape(shareUrl)}">
    <meta name="twitter:title" content="${escape(title)} | Mystic Tarot">
    <meta name="twitter:description" content="${escape(description)}">
    <meta name="twitter:image" content="${escape(ogImageUrl)}">
  `;
}

/**
 * Handle share page requests by injecting OG meta tags.
 * This enables rich social media previews when share links are posted.
 *
 * @param {Request} request - Incoming request
 * @param {Env} env - Environment bindings
 * @param {string} token - Share token
 * @returns {Promise<Response>} HTML response with OG tags
 */
async function handleSharePageWithOgTags(request, env, token) {
  try {
    // Load share data from database
    const shareRecord = await loadShareRecord(env, token);

    // If share doesn't exist or is expired, serve default page
    if (!shareRecord) {
      return env.ASSETS.fetch(request);
    }

    // Check expiry
    if (shareRecord.expiresAt && Date.now() / 1000 > shareRecord.expiresAt) {
      return env.ASSETS.fetch(request);
    }

    // Load entries for OG tag generation
    const entries = await loadShareEntries(env, token);

    // Fetch the base HTML from assets
    const assetResponse = await env.ASSETS.fetch(request);
    if (!assetResponse.ok) {
      return assetResponse;
    }

    // Get the HTML content
    let html = await assetResponse.text();

    // Build OG meta tags
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const ogTags = buildShareOgMetaTags(token, shareRecord, entries, baseUrl);

    // Inject OG tags into the <head> section
    // Insert after the opening <head> tag or before </head>
    if (html.includes('</head>')) {
      html = html.replace('</head>', `${ogTags}\n  </head>`);
    }

    // Return the modified HTML
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=3600'
      }
    });
  } catch (error) {
    console.error('Error injecting OG tags:', error);
    // Fall back to serving the default page
    return env.ASSETS.fetch(request);
  }
}

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
  { pattern: /^\/api\/share\/([^/]+)\/og-image$/, handlers: shareTokenOgImage, params: ['token'] },
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
  { pattern: /^\/api\/coach-extraction-backfill$/, handlers: coachExtractionBackfill },
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

    // Check for share page requests that need OG meta tag injection
    const sharePageMatch = pathname.match(/^\/share\/([^/]+)$/);
    if (sharePageMatch && method === 'GET') {
      return handleSharePageWithOgTags(request, env, sharePageMatch[1]);
    }

    // For non-API routes, serve static assets
    // The ASSETS binding handles SPA fallback via not_found_handling config
    return env.ASSETS.fetch(request);
  },
};
