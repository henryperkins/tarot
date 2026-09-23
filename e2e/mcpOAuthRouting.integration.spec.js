import { expect, test } from '@playwright/test';

test('browser navigation reaches OAuth consent and discovery through the Worker', async ({ page, request }) => {
  const metadataResponse = await page.goto('/.well-known/oauth-protected-resource/mcp');
  expect(metadataResponse?.status()).toBe(200);
  expect(metadataResponse?.headers()['content-type']).toContain('application/json');
  const metadata = JSON.parse(await metadataResponse.text());
  expect(metadata.resource).toBe('http://localhost:8787/mcp');

  const registration = await request.post('/oauth/register', {
    data: {
      client_name: 'Routing test',
      redirect_uris: ['http://127.0.0.1:8976/callback'],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code']
    }
  });
  expect(registration.status()).toBe(201);
  const client = await registration.json();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: client.client_id,
    redirect_uri: 'http://127.0.0.1:8976/callback',
    state: 'routing-test',
    code_challenge: 'A'.repeat(43),
    code_challenge_method: 'S256',
    scope: 'tableu',
    resource: metadata.resource
  });
  const consent = await page.goto(`/oauth/authorize?${params}`);
  expect(consent?.status()).toBe(200);
  expect(consent?.headers()['cache-control']).toBe('no-store');
  await expect(page.getByRole('heading', { name: 'Sign in to Tableu to continue' })).toBeVisible();

  const api = await page.goto('/api/no-such-route');
  expect(api?.status()).toBe(404);
  expect(api?.headers()['content-type']).toContain('application/json');
  const home = await page.goto('/');
  expect(home?.status()).toBe(200);
  expect(home?.headers()['content-type']).toContain('text/html');
});
