/**
 * OG Image Endpoint
 *
 * GET /api/share/:token/og-image
 *
 * Returns an SVG image for Open Graph social media previews.
 * This image appears when share links are posted to social media platforms.
 *
 * Response:
 * - 200: SVG image (image/svg+xml)
 * - 404: Share link not found
 * - 410: Share link expired
 *
 * Caching:
 * - 1 hour client cache
 * - 24 hour CDN cache
 */

import { loadShareRecord, loadShareEntries } from '../../../lib/shareData.js';
import { buildOgImageSvg, buildErrorOgImage } from '../../../lib/ogImageBuilder.js';

/**
 * Build CORS headers for the response.
 * OG images are fetched by external services, so we allow any origin.
 */
function buildCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

/**
 * Build cache headers for the SVG response.
 * OG images don't change frequently, so we cache aggressively.
 */
function buildCacheHeaders() {
  return {
    'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    'CDN-Cache-Control': 'public, max-age=86400',
    'Vary': 'Accept'
  };
}

/**
 * Handle OPTIONS preflight requests.
 */
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders()
  });
}

/**
 * Handle GET requests for OG images.
 */
export async function onRequestGet(context) {
  const { params, env } = context;
  const token = params.token;

  const corsHeaders = buildCorsHeaders();
  const cacheHeaders = buildCacheHeaders();

  // Validate token format
  if (!token || typeof token !== 'string' || token.length < 8) {
    const svg = buildErrorOgImage('Invalid share link');
    return new Response(svg, {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    });
  }

  try {
    // Load share record from database
    const shareRecord = await loadShareRecord(env, token);

    if (!shareRecord) {
      const svg = buildErrorOgImage('Reading not found');
      return new Response(svg, {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=300' // Short cache for 404s
        }
      });
    }

    // Check if share link has expired
    if (shareRecord.expiresAt) {
      const now = Math.floor(Date.now() / 1000);
      if (now > shareRecord.expiresAt) {
        const svg = buildErrorOgImage('This share link has expired');
        return new Response(svg, {
          status: 410,
          headers: {
            ...corsHeaders,
            'Content-Type': 'image/svg+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600' // Cache expired state
          }
        });
      }
    }

    // Load the shared entries
    const entries = await loadShareEntries(env, token);

    if (!entries || entries.length === 0) {
      const svg = buildErrorOgImage('No readings in this share');
      return new Response(svg, {
        status: 200, // Still return 200 since the share exists
        headers: {
          ...corsHeaders,
          'Content-Type': 'image/svg+xml; charset=utf-8',
          ...cacheHeaders
        }
      });
    }

    // Build the OG image SVG
    const svg = buildOgImageSvg(entries, shareRecord);

    return new Response(svg, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/svg+xml; charset=utf-8',
        ...cacheHeaders
      }
    });
  } catch (error) {
    console.error('OG image generation error:', error);

    const svg = buildErrorOgImage('Unable to load reading');
    return new Response(svg, {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    });
  }
}
