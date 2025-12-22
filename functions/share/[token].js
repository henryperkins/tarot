import { loadShareRecord } from '../lib/shareData.js';

export async function onRequestGet(context) {
  const { request, params, env } = context;
  const token = params.token;

  // 1. Get the original HTML asset (index.html)
  // We assume the SPA entry point is served at /
  const url = new URL(request.url);
  const assetUrl = new URL('/', url.origin); 
  const assetRequest = new Request(assetUrl, request);
  
  // env.ASSETS is available in Cloudflare Pages Functions to fetch static assets
  const response = await env.ASSETS.fetch(assetRequest);
  
  if (!response.ok) {
    return response;
  }

  let html = await response.text();

  // 2. Load share data for metadata
  try {
    const share = await loadShareRecord(env, token);
    
    if (share) {
      const title = share.title || 'Mystic Tarot Reading';
      // Basic description, ideally we'd load entries to get more detail but that might be slow
      const description = 'Explore the insights and guidance revealed in this Tarot reading.';
      const imageUrl = `${url.origin}/api/share/${token}/og-image`;
      
      const metas = `
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />
      `;
      
      // Inject before </head>
      html = html.replace('</head>', `${metas}</head>`);
    }
  } catch (e) {
    console.error('Meta injection failed', e);
    // Return original HTML on error to ensure page still works
  }

  return new Response(html, {
    headers: response.headers
  });
}
