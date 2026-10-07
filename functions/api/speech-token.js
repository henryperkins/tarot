import { jsonResponse } from '../lib/utils.js';
import { resolveEnv } from '../lib/environment.js';
import { getUserFromRequest } from '../lib/auth.js';
import { enforceApiCallLimit } from '../lib/apiUsage.js';
import { enforceSpeechTokenLimit } from '../lib/ttsLimits.js';
import { createDeadline } from '../lib/requestDeadline.js';

/**
 * Speech Token Endpoint for Azure Cognitive Services Speech SDK
 *
 * Issues short-lived authorization tokens for client-side Speech SDK usage.
 * This keeps the subscription key secure on the server while allowing
 * the browser to synthesize speech directly with Azure.
 */
export async function onRequestGet(context) {
  const { request, env } = context;

  const user = await getUserFromRequest(request, env);
  if (!user) {
    return jsonResponse({ error: 'Not authenticated' }, { status: 401 });
  }

  // API key requests are subject to API call limits.
  if (user?.auth_provider === 'api_key') {
    const apiLimit = await enforceApiCallLimit(env, user);
    if (!apiLimit.allowed) {
      return jsonResponse(apiLimit.payload, { status: apiLimit.status });
    }
  }

  const rateLimitResult = await enforceSpeechTokenLimit(env, request, user);
  if (!rateLimitResult.allowed) {
    return jsonResponse(rateLimitResult.payload, {
      status: rateLimitResult.status,
      headers: rateLimitResult.retryAfter ? { 'retry-after': String(rateLimitResult.retryAfter) } : {}
    });
  }

  const speechKey = resolveEnv(env, 'AZURE_SPEECH_KEY');
  const speechRegion = resolveEnv(env, 'AZURE_SPEECH_REGION') || 'eastus2';
  const speechEndpoint = resolveEnv(env, 'AZURE_SPEECH_ENDPOINT');

  if (!speechKey) {
    console.error('[SpeechToken] AZURE_SPEECH_KEY not configured');
    return jsonResponse(
      { error: 'Speech service not configured' },
      { status: 503 }
    );
  }

  const deadline = createDeadline({ signal: request.signal, timeoutMs: 15000 });
  try {
    // Custom endpoints (Azure AI Foundry) use endpoint-based token URL
    // Standard Speech Service uses region-based URL
    let tokenEndpoint;
    if (speechEndpoint) {
      // Custom endpoint: append token path to base endpoint
      const baseUrl = speechEndpoint.replace(/\/$/, '');
      tokenEndpoint = `${baseUrl}/sts/v1.0/issueToken`;
    } else {
      // Region-based: standard Cognitive Services token endpoint
      tokenEndpoint = `https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
    }

    const tokenResponse = await deadline.run(() => fetch(tokenEndpoint, {
      method: 'POST',
      signal: deadline.signal,
      headers: {
        'Ocp-Apim-Subscription-Key': speechKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': '0'
      }
    }));

    if (!tokenResponse.ok) {
      console.error('[SpeechToken] Azure token fetch failed:', tokenResponse.status, tokenResponse.statusText);

      if (isDebugEnabled(env)) {
        const errorText = await deadline.run(() => tokenResponse.text()).catch(() => '');
        if (errorText) {
          console.error('[SpeechToken] Error details:', errorText);
        }
      }

      return jsonResponse(
        { error: 'Failed to get speech token' },
        { status: 502 }
      );
    }

    const token = await deadline.run(() => tokenResponse.text());

    return jsonResponse(
      {
        token,
        region: speechRegion,
        expiresIn: 540 // 9 minutes in seconds
      },
      {
        headers: {
          'cache-control': 'no-store, no-cache, must-revalidate',
          pragma: 'no-cache'
        }
      }
    );
  } catch (err) {
    console.error('[SpeechToken] Error:', err);
    return jsonResponse(
      { error: 'Token service unavailable' },
      { status: 503 }
    );
  } finally { deadline.dispose(); }
}

function isDebugEnabled(env) {
  const explicit = resolveEnv(env, 'ENABLE_SPEECH_TOKEN_DEBUG');
  if (explicit) {
    const normalized = String(explicit).trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  const nodeEnv = resolveEnv(env, 'NODE_ENV');
  if (nodeEnv && nodeEnv.toLowerCase() !== 'production') {
    return true;
  }

  return false;
}
