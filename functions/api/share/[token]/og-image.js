import { loadShareRecord, loadShareEntries } from '../../../lib/shareData.js';
import { buildOgImageSvg, buildErrorOgImage } from '../../../lib/ogImageBuilder.js';

export async function onRequestGet(context) {
  const { params, env } = context;
  const token = params.token;

  const svgHeaders = {
    'Content-Type': 'image/svg+xml',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  try {
    // Load share data
    const shareRecord = await loadShareRecord(env, token);
    if (!shareRecord) {
      return new Response(buildErrorOgImage('Share link not found'), {
        status: 404,
        headers: {
          ...svgHeaders,
          'Cache-Control': 'no-store'
        }
      });
    }

    if (shareRecord.expiresAt && shareRecord.expiresAt < Math.floor(Date.now() / 1000)) {
      return new Response(buildErrorOgImage('Share link expired'), {
        status: 410,
        headers: {
          ...svgHeaders,
          'Cache-Control': 'no-store'
        }
      });
    }
    
    const entries = await loadShareEntries(env, token);
    
    // Build SVG template
    const svg = buildOgImageSvg(entries, shareRecord);
    
    return new Response(svg, {
      headers: {
        ...svgHeaders,
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (error) {
    console.error('OG Image generation error:', error);
    return new Response(buildErrorOgImage('Error generating image'), {
      status: 500,
      headers: {
        ...svgHeaders,
        'Cache-Control': 'no-store'
      }
    });
  }
}
