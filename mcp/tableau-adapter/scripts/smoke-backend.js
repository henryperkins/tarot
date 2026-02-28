import dotenv from 'dotenv';

dotenv.config();

const TABLEAU_BASE_URL = (process.env.TABLEAU_BASE_URL || '').replace(/\/+$/, '');
const TABLEAU_API_KEY = process.env.TABLEAU_API_KEY || '';

if (!TABLEAU_BASE_URL || !TABLEAU_API_KEY) {
  console.error('Missing TABLEAU_BASE_URL or TABLEAU_API_KEY.');
  process.exit(1);
}

const payload = {
  spreadInfo: { name: 'Single Card' },
  cardsInfo: [
    {
      position: 'Present',
      card: 'The Fool',
      orientation: 'Upright',
      meaning: 'New beginnings and trust in the process.',
    },
  ],
  userQuestion: 'What should I focus on today?',
};

async function call(path, init = {}) {
  const response = await fetch(`${TABLEAU_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TABLEAU_API_KEY}`,
      ...(init.headers || {}),
    },
  });
  const bodyText = await response.text();
  let body = {};
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    body = { raw: bodyText };
  }
  return { ok: response.ok, status: response.status, body };
}

const start = await call('/api/tarot-reading/jobs', {
  method: 'POST',
  body: JSON.stringify(payload),
});

if (!start.ok) {
  console.error('Start failed:', start.status, start.body);
  process.exit(1);
}

const { jobId, jobToken } = start.body;
if (!jobId || !jobToken) {
  console.error('Unexpected start response:', start.body);
  process.exit(1);
}

const status = await call(`/api/tarot-reading/jobs/${encodeURIComponent(jobId)}`, {
  method: 'GET',
  headers: { 'X-Job-Token': jobToken },
});

console.log(
  JSON.stringify(
    {
      start: start.body,
      status: status.body,
    },
    null,
    2
  )
);
