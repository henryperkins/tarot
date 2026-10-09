import { chromium, webkit } from '/home/ubuntu/tarot/node_modules/playwright/index.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const args={}; for(let i=2;i<process.argv.length;i+=2) args[process.argv[i].replace(/^--/,'')]=process.argv[i+1];
const manifest=JSON.parse(await readFile(new URL('./submission.json',import.meta.url),'utf8'));
const repo='/home/ubuntu/tarot/.worktrees/reading-gestures-react-bridge';
if(execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim()!==manifest.head) throw new Error('Preview revision changed');
if(execFileSync('git',['diff','--name-only','HEAD','--','src','shared'],{cwd:repo,encoding:'utf8'}).trim()) throw new Error('Preview source is modified');
const study=['star','celtic','five-card','deck'].includes(args.study)?args.study:'star';
const arrival=['gentle','burst','complete'].includes(args.arrival)?args.arrival:'gentle';
const width=Math.max(320,Math.min(1600,Number(args.width)||1100)); const height=Math.max(568,Math.min(1200,Number(args.height)||1000));
const times=(args.times||'0,1800,3600,6000,9000,12000').split(',').map(Number).filter(Number.isFinite).filter(n=>n>=0&&n<=20000).sort((a,b)=>a-b).slice(0,8);
const params=new URLSearchParams({study,arrival,associations:args.associations==='authored'?'authored':'dynamic',sourceMode:'recorded',reflection:args.reflection==='off'?'off':'on'});
if(args.card) params.set('card',args.card); if(args.orientation==='reversed') params.set('orientation','reversed');
const output=path.join(path.dirname(new URL(import.meta.url).pathname),'observations',`${Date.now()}-${study}-${width}`);await mkdir(output,{recursive:true});
const engine=args.engine==='webkit'?webkit:chromium;
const browser=await engine.launch();
try {
 const page=await browser.newPage({viewport:{width,height},reducedMotion:args.reduced==='true'?'reduce':'no-preference'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/tarot-reading/**',route=>route.abort());
 await page.addInitScript(()=>localStorage.setItem('tarot-onboarding-complete','true'));
 await page.goto('http://localhost:5174/__e2e/reading-gestures?'+params,{waitUntil:'domcontentloaded'});
 await page.locator('[data-testid="reading-gestures-fixture"]').waitFor();
 const start=Date.now();const records=[];let held=false;
 for(const at of times){
  if(at>Date.now()-start) await page.waitForTimeout(at-(Date.now()-start));
  if(args.phrase&&!held&&at>=(Number(args['hold-at'])||3000)){
   const target=page.locator('[data-gesture-id]').filter({hasText:args.phrase}).first();
   if(await target.count()){await target.click({timeout:3000});held=true;}
  }
  const state=await page.evaluate(()=>{
   const win=document.querySelector('[data-gesture-window]');
   return {viewport:{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollY},source:document.querySelector('[data-testid="gesture-source-diagnostics"]')?.dataset,window:win?{...win.dataset,rect:win.getBoundingClientRect().toJSON()}:null,
    focused:[...document.querySelectorAll('.gesture-focus-layer:not(.gesture-focus-layer--departing) [data-focus-card]')].map(e=>({...e.dataset,label:e.getAttribute('aria-label')})),
    phrases:[...document.querySelectorAll('[data-gesture-id]')].map(e=>({text:e.textContent,id:e.dataset.gestureId,pressed:e.getAttribute('aria-pressed'),associated:e.dataset.associated,rect:e.getBoundingClientRect().toJSON()})),
    shelf:[...document.querySelectorAll('[data-gesture-shelf] button')].map(e=>({label:e.getAttribute('aria-label'),disabled:e.disabled,rect:e.getBoundingClientRect().toJSON()})),
    reading:document.querySelector('.narrative-stream')?.innerText,
    runningAnimations:document.getAnimations().filter(a=>a.playState==='running').length};
  });
  const filename=path.join(output,`${records.length}-${at}ms.png`);await page.screenshot({path:filename,fullPage:true});records.push({observedMs:Date.now()-start,requestedMs:at,image:filename,...state});
 }
 const result={revision:manifest.head,parameters:args,errors,records};await writeFile(path.join(output,'observations.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({observations:path.join(output,'observations.json'),images:records.map(r=>r.image),states:records.map(r=>({ms:r.observedMs,source:r.source,window:r.window,focused:r.focused})),errors},null,2));
} finally {await browser.close();}
