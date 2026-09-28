import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { isEmailConfigured, parseSender, sendEmail } from '../functions/lib/emailService.js';

function bindingEnv(send, extra = {}) {
  return { EMAIL: { send }, ALERT_EMAIL_FROM: 'Tableu <hello@lakefrontdigital.io>', ...extra };
}

describe('parseSender', () => {
  it('splits a display name from the address', () => {
    assert.deepEqual(parseSender('Tableu <hello@lakefrontdigital.io>'), {
      email: 'hello@lakefrontdigital.io',
      name: 'Tableu'
    });
    assert.deepEqual(parseSender('"Tableu Support" <hello@lakefrontdigital.io>'), {
      email: 'hello@lakefrontdigital.io',
      name: 'Tableu Support'
    });
  });

  it('keeps a bare address and falls back to the default sender', () => {
    assert.deepEqual(parseSender('hello@lakefrontdigital.io'), { email: 'hello@lakefrontdigital.io' });
    assert.deepEqual(parseSender(undefined), { email: 'hello@lakefrontdigital.io', name: 'Tableu' });
  });
});

describe('isEmailConfigured', () => {
  it('accepts the send_email binding or a Resend key', () => {
    assert.equal(isEmailConfigured(bindingEnv(async () => ({}))), true);
    assert.equal(isEmailConfigured({ RESEND_API_KEY: 're_test' }), true);
    assert.equal(isEmailConfigured({ RESEND_API_KEY: '  ' }), false);
    assert.equal(isEmailConfigured({ EMAIL: {} }), false);
    assert.equal(isEmailConfigured(undefined), false);
  });
});

describe('sendEmail', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('sends through the binding with a parsed sender and a text body', async () => {
    const calls = [];
    const env = bindingEnv(async (message) => {
      calls.push(message);
      return { messageId: 'msg-1' };
    }, { RESEND_API_KEY: 're_test' });
    globalThis.fetch = () => {
      throw new Error('Resend must not be called when the binding exists');
    };

    const result = await sendEmail(env, {
      to: 'reader@example.com',
      subject: 'Reset your Tableu password',
      html: '<p>Hello</p><p>Use this link.</p>'
    });

    assert.deepEqual(result, { success: true, id: 'msg-1' });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].from, { email: 'hello@lakefrontdigital.io', name: 'Tableu' });
    assert.equal(calls[0].to, 'reader@example.com');
    assert.equal(calls[0].subject, 'Reset your Tableu password');
    assert.equal(calls[0].text, 'Hello\n\nUse this link.');
  });

  it('keeps a supplied text body', async () => {
    let sent;
    const env = bindingEnv(async (message) => {
      sent = message;
      return { messageId: 'msg-2' };
    });
    await sendEmail(env, { to: 'reader@example.com', subject: 's', html: '<p>x</p>', text: 'plain' });
    assert.equal(sent.text, 'plain');
  });

  it('reports the binding error code without throwing', async () => {
    const env = bindingEnv(async () => {
      const error = new Error('Sender domain is not verified');
      error.code = 'E_SENDER_NOT_VERIFIED';
      throw error;
    });
    const result = await sendEmail(env, { to: 'reader@example.com', subject: 's', html: '<p>x</p>' });
    assert.equal(result.success, false);
    assert.equal(result.error, 'E_SENDER_NOT_VERIFIED');
    assert.equal(result.details, 'Sender domain is not verified');
  });

  it('falls back to ALERT_EMAIL_TO when no recipient is given', async () => {
    let sent;
    const env = bindingEnv(async (message) => {
      sent = message;
      return { messageId: 'msg-3' };
    }, { ALERT_EMAIL_TO: 'owner@example.com' });
    const result = await sendEmail(env, { subject: 'Alert', html: '<p>x</p>' });
    assert.equal(result.success, true);
    assert.equal(sent.to, 'owner@example.com');
  });

  it('refuses without a recipient or without any transport', async () => {
    const noRecipient = await sendEmail(bindingEnv(async () => ({})), { subject: 's', html: '<p>x</p>' });
    assert.deepEqual(noRecipient, { success: false, error: 'no_recipient' });

    const noTransport = await sendEmail({}, { to: 'reader@example.com', subject: 's', html: '<p>x</p>' });
    assert.deepEqual(noTransport, { success: false, error: 'email_not_configured' });
  });

  it('uses Resend when the binding is absent', async () => {
    const requests = [];
    globalThis.fetch = async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({ id: 'resend-1' }), { status: 200 });
    };
    const result = await sendEmail(
      { RESEND_API_KEY: 're_test', ALERT_EMAIL_FROM: 'Tableu <hello@lakefrontdigital.io>' },
      { to: 'reader@example.com', subject: 's', html: '<p>x</p>' }
    );
    assert.deepEqual(result, { success: true, id: 'resend-1' });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, 'https://api.resend.com/emails');
    const body = JSON.parse(requests[0].init.body);
    assert.equal(body.from, 'Tableu <hello@lakefrontdigital.io>');
    assert.deepEqual(body.to, ['reader@example.com']);
  });
});
