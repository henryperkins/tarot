import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { runCodexSubscription } from '../services/codex-subscription/runner.mjs';

const input = { task: 'reading', systemPrompt: 'Read the card.', messages: [{ role: 'user', content: 'The Star.' }] };
async function fixture(t, { mismatch = false, fail = false } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'codex-stream-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const executable = path.join(directory, 'codex.mjs');
  await writeFile(executable, `#!${process.execPath}
import readline from 'node:readline';
const args=process.argv.slice(2);const send=x=>console.log(JSON.stringify(x));
if(args.includes('--version'))console.log('codex-cli 0.162.0');
else if(args.includes('status'))console.error('Logged in using ChatGPT');
else if(args.includes('models'))send({models:[{slug:'gpt-6.1-sol'}]});
else if(args.includes('app-server')) {
if(!args.includes('openai_base_url="https://chatgpt.com/backend-api/codex"'))process.exit(5);
readline.createInterface({input:process.stdin}).on('line',line=>{
const e=JSON.parse(line);const reply=result=>send({id:e.id,result});const item=(method,value)=>send({method,params:{threadId:'thread',turnId:'turn',item:value}});
if(e.method==='initialize')reply({});
if(e.method==='config/read')reply({config:{mcp_servers:{'dotted.hostile':{command:'must-not-run',args:null}}}});
if(e.method==='thread/start'){
if(e.params.config.mcp_servers['dotted.hostile'].enabled!==false||'args' in e.params.config.mcp_servers['dotted.hostile']||e.params.environments.length||!e.params.ephemeral)process.exit(3);
reply({thread:{id:'thread'},model:'gpt-6.1-sol'});
}
if(e.method==='turn/start'){
reply({turn:{id:'turn'}});
item('item/started',{id:'comment',type:'agentMessage',phase:'commentary',text:''});
send({method:'item/agentMessage/delta',params:{threadId:'thread',turnId:'turn',itemId:'comment',delta:'PRIVATE COMMENTARY'}});
item('item/completed',{id:'comment',type:'agentMessage',phase:'commentary',text:'PRIVATE COMMENTARY'});
send({method:'item/reasoning/textDelta',params:{threadId:'thread',turnId:'turn',itemId:'reason',delta:'PRIVATE REASONING'}});
item('item/started',{id:'answer',type:'agentMessage',phase:'final_answer',text:''});
send({method:'item/agentMessage/delta',params:{threadId:'thread',turnId:'turn',itemId:'answer',delta:'  First. '}});
setTimeout(()=>{
${fail ? "send({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'failed',error:{message:'PRIVATE ERROR'}}}});" : `send({method:'item/agentMessage/delta',params:{threadId:'thread',turnId:'turn',itemId:'answer',delta:'Second.  '}});item('item/completed',{id:'answer',type:'agentMessage',phase:'final_answer',text:${JSON.stringify(mismatch ? 'changed' : '  First. Second.  ')}});send({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});`}
},80);
}
});
}else process.exit(4);
`, { mode: 0o700 });
  return { HOME: process.env.HOME, PATH: process.env.PATH, CODEX_SUBSCRIPTION_EXECUTABLE: executable };
}

test('subscription readings emit actual final-answer deltas before completion, preserving exact whitespace', async t => {
  const hostEnv = await fixture(t);
  const deltas = [];
  let completed = false;
  let arrivedBeforeCompletion = false;
  const result = await runCodexSubscription(input, { hostEnv, onDelta: text => {
    arrivedBeforeCompletion ||= !completed;
    deltas.push(text);
  } }).finally(() => { completed = true; });
  assert.equal(arrivedBeforeCompletion, true);
  assert.deepEqual(deltas, ['  First. ', 'Second.  ']);
  assert.equal(result.text, deltas.join(''));
  assert.doesNotMatch(result.text, /PRIVATE/);
});

test('mismatched authoritative text rejects a streamed reading instead of rewriting delivered prose', async t => {
  const hostEnv = await fixture(t, { mismatch: true });
  const deltas = [];
  await assert.rejects(runCodexSubscription(input, { hostEnv, onDelta: text => deltas.push(text) }), /stream|incomplete|match/i);
  assert.equal(deltas.join(''), '  First. Second.  ');
});

test('failure after the first delta is terminal and never exposes upstream error details', async t => {
  const hostEnv = await fixture(t, { fail: true });
  const deltas = [];
  await assert.rejects(runCodexSubscription(input, { hostEnv, onDelta: text => deltas.push(text) }), error => {
    assert.doesNotMatch(error.message, /PRIVATE/);
    return true;
  });
  assert.deepEqual(deltas, ['  First. ']);
});

test('cancelling a live stream stops delivery and rejects before completion', async t => {
  const hostEnv = await fixture(t);
  const controller = new AbortController();
  const deltas = [];
  await assert.rejects(runCodexSubscription(input, { hostEnv, signal: controller.signal, onDelta: text => {
    deltas.push(text);
    controller.abort();
  } }), /cancelled/);
  assert.deepEqual(deltas, ['  First. ']);
});
