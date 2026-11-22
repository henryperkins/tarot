import { READING_CONFIG_FIXTURE } from '../../shared/contracts/aiConfigSample.js';
import { callPersonalTextProvider } from '../../functions/lib/personalTextProvider.js';
import { linkedGatewayEnv, ownerLinkDatabase, ownerRestriction, readOwnerLink } from '../../functions/lib/ownerSubscription.js';
import { getOwnerHostStatus } from '../../functions/lib/ownerSubscriptionHost.js';

const retention = 15 * 60 * 1000;
const maxRun = 5 * 60 * 1000;
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const unavailable = () => json({ code: 'sample_unavailable', error: 'This owner sample is unavailable.' }, 404);

// Keep prompts, gateway secrets, reader session tokens and private reader data
// out of the job. The only input sent to either CLI is this fixed fixture.
function sampleInput(signal) {
  const { question, cards } = READING_CONFIG_FIXTURE;
  return { task: 'reading', signal,
    systemPrompt: 'Write a brief reflective tarot reading. Address the question using each drawn card in order. Offer one practical next step. Frame interpretations as possibilities and preserve the reader’s agency.',
    messages: [{ role: 'user', content: question + '\nThree-Card Story, all upright.\n' + cards.join(' · ') }] };
}

export class OwnerSubscriptionSamples {
  constructor(state, env) {
    this.storage = state.storage;
    this.sql = this.storage.sql;
    this.env = env;
    this.dispatching = false;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS owner_samples (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, revision INTEGER NOT NULL, provider TEXT NOT NULL,
      status TEXT NOT NULL, expires INTEGER NOT NULL, details TEXT)`);
  }

  async fetch(request) {
    const id = new URL(request.url).pathname.slice(1);
    const now = Date.now();
    const get = request.method === 'GET';
    const input = get ? { ownerId: request.headers.get('X-Owner-Id'), revision: Number(request.headers.get('X-Owner-Revision')) } : await request.json();
    this.sql.exec('DELETE FROM owner_samples WHERE expires <= ?', now);
    const [row] = this.sql.exec('SELECT * FROM owner_samples WHERE id = ?', id).toArray();
    if (row && (row.owner !== input.ownerId || row.revision !== input.revision)) {
      return get ? unavailable() : json({ code: 'sample_conflict', error: 'Choose a new sample run ID.' }, 409);
    }
    if (!row && get) return unavailable();
    if (!row) {
      const [counts] = this.sql.exec("SELECT COUNT(*) AS n, COUNT(CASE WHEN status IN ('queued','dispatching') THEN 1 END) AS busy FROM owner_samples").toArray();
      if (counts.busy) return json({ code: 'sample_busy', error: 'An owner sample is already running. Try again when it finishes.' }, 409);
      if (counts.n >= 32) return json({ code: 'sample_capacity', error: 'The owner sample limit was reached. Try again in 15 minutes.' }, 429);
      this.sql.exec("INSERT INTO owner_samples (id, owner, revision, provider, status, expires) VALUES (?, ?, ?, ?, 'queued', ?)",
        id, input.ownerId, input.revision, input.providerId, now + retention);
    }
    if (!row || row.status === 'queued') await this.storage.setAlarm(Date.now());
    if (!get) return json({ runId: id }, 202);
    return json({ runId: id, providerId: row.provider,
      status: ['queued', 'dispatching'].includes(row.status) ? 'running' : row.status,
      ...(row.details && JSON.parse(row.details)) });
  }

  async currentLink(run) {
    if (ownerRestriction(this.env)) return null;
    const link = await readOwnerLink(ownerLinkDatabase(this.env));
    return link.owner_id === run.owner && link.provider_id === run.provider && link.revision === run.revision ? link : null;
  }

  async execute(run) {
    let details;
    try {
      const host = await getOwnerHostStatus(this.env, run.provider);
      const link = await this.currentLink(run);
      if (!link) details = { reason: 'The owner subscription link changed.' };
      else if (!host.ready) details = { reason: host.reason || 'Sign in to the selected subscription on the local host.' };
      else {
        const env = await linkedGatewayEnv(this.env, link);
        const result = await callPersonalTextProvider(env, sampleInput(AbortSignal.timeout(maxRun)));
        if (await this.currentLink(run)) {
          const sourceKnown = ['configured', 'reported'].includes(result.modelSource);
          details = { ...(sourceKnown && { model: result.model, modelSource: result.modelSource }),
            excerpt: result.text.trim().slice(0, 1500) };
        } else details = { reason: 'The owner subscription link changed.' };
      }
    } catch {
      details = { reason: 'The selected subscription could not complete the sample. Check the host login and try again.' };
    }
    this.sql.exec('UPDATE owner_samples SET status = ?, details = ?, expires = ? WHERE id = ?',
      details.reason ? 'failed' : 'completed', JSON.stringify(details), Date.now() + retention, run.id);
  }

  async alarm() {
    if (this.dispatching) return;
    this.dispatching = true;
    try {
      const now = Date.now();
      this.sql.exec('DELETE FROM owner_samples WHERE expires <= ?', now);
      // A restarted alarm may find a committed claim without its reply. Never
      // resubmit that turn to the subscription or substitute another provider.
      this.sql.exec("UPDATE owner_samples SET status = 'failed', details = ? WHERE status = 'dispatching'",
        JSON.stringify({ reason: 'The host interrupted this sample. Run a new sample to retry.' }));
      const [run] = this.sql.exec("SELECT * FROM owner_samples WHERE status = 'queued' LIMIT 1").toArray();
      if (run) {
        this.sql.exec("UPDATE owner_samples SET status = 'dispatching' WHERE id = ?", run.id);
        await this.storage.setAlarm(now + maxRun + 30000);
        await this.execute(run);
      }
      const [next] = this.sql.exec("SELECT MIN(CASE WHEN status = 'queued' THEN 0 ELSE expires END) AS time FROM owner_samples").toArray();
      if (next.time !== null) await this.storage.setAlarm(Math.max(Date.now(), next.time));
    } finally { this.dispatching = false; }
  }
}
