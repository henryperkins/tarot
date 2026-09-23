import http from 'node:http';

const streams = new Set();
let request = {};
let sequence = 1;
const paragraphs = () => {
  const cards = request.cardsInfo || [];
  return [
    '# Your Three-Card Story\n\nYour spread invites a quieter kind of progress: notice what you already know, make room for what is changing, and choose one practical step you can try this week.\n\n',
    ...cards.map((card, index) => `## ${card.position || ['Past', 'Present', 'Future'][index]} — ${card.card || card.name}\n\n**${card.card || card.name}** offers a perspective on your question. You may recognize a pattern of giving your attention to other people before checking what you need. Rather than treating that pattern as a prediction, use the card as an invitation to pause and look closely.\n\nConsider where this theme appears in your ordinary day. What feels steady, and what leaves you stretched? There is no need to resolve everything at once. A small, repeatable choice can help you learn what supports you.\n\n`),
    '## The thread connecting your cards\n\nTogether, the cards describe a movement from reflection into deliberate action. The tension is between waiting for certainty and allowing yourself to learn by trying. Your own experience remains the guide: keep what resonates and leave the rest.\n\n',
    '## A grounded next step\n\n- Choose one commitment you can simplify this week.\n- Leave ten minutes to reflect before saying yes to something new.\n- Write down what changes when you give your own priorities more room.\n\n**Reflection:** What would a more balanced week look like in practice?\n\nThis reading supports reflection; your choices remain your own.'
  ];
};
function event(res, name, data) { res.write(`event: ${name}\ndata: ${JSON.stringify({ ...data, eventId: sequence++ })}\n\n`); }
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (body, status = 200) => { res.writeHead(status, {'Content-Type':'application/json'}); res.end(JSON.stringify(body)); };
  if (url.pathname === '/audit/advance') {
    const mode = url.searchParams.get('mode');
    for (const stream of streams) {
      if (mode === 'partial') event(stream, 'delta', {text: paragraphs().slice(0, 2).join('')});
      else if (mode === 'error') {event(stream, 'error', {message:'Unable to complete your reading. Please try again.'}); stream.end();}
      else {event(stream, 'done', {fullText:paragraphs().join(''),provider:'audit-fixture',requestId:'audit-local-reading'}); stream.end();}
    }
    return json({mode, connections:streams.size});
  }
  if (url.pathname === '/api/tarot-reading/jobs' && req.method === 'POST') {
    let body = ''; for await (const chunk of req) body += chunk;
    request = JSON.parse(body); sequence = 1;
    return json({jobId:'audit-local-job',jobToken:'audit-local-token'});
  }
  if (/\/api\/tarot-reading\/jobs\/[^/]+\/stream/.test(url.pathname)) {
    res.writeHead(200, {'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
    streams.add(res); res.on('close', () => streams.delete(res));
    event(res, 'meta', {provider:'audit-fixture',requestId:'audit-local-reading',themes:{elementCounts:{fire:1,water:1,air:1,earth:0},reversalCount:0}});
    event(res, 'reasoning', {text:'Considering how the past, present, and possible direction connect with your intention.',partial:false});
    return;
  }
  if (/\/cancel$/.test(url.pathname)) { for(const stream of streams) stream.end(); return json({status:'cancelled'}); }
  if (/auth|session/.test(url.pathname)) return json({user:null},401);
  return json({error:'Audit fixture: endpoint not supplied'},404);
});
server.listen(8787, 'localhost', () => console.log('Local reading audit fixture listening on 8787'));
