import { ARTWORK, DETAILS, createArtwork } from './five-card-art.js';

const root = document.querySelector('#five-card-dialogue');
const fixture = JSON.parse(document.querySelector('#five-card-fixture').textContent);
const $ = (selector) => root.querySelector(selector);
const $$ = (selector) => [...root.querySelectorAll(selector)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const compact = matchMedia('(max-width: 760px)');
const ids = ['ace', 'swords', 'queen', 'pentacles', 'wheel'];
const names = Object.fromEntries(ids.map((id, index) => [id, fixture.cards[index].card]));
const positions = ['Core', 'Challenge', 'Hidden influence', 'Support', 'Direction'];
const spec = [
  {id:'ace-arrival', phrase:'Ace of Wands (Upright), the core.', card:'ace'},
  {id:'ace-sprout', phrase:"a hand from a cloud offering a wand that's still sprouting leaves", card:'ace', detail:'sprout'},
  {id:'ace-castle', phrase:'with rolling hills and a castle far off in the distance.', card:'ace', detail:'castle'},
  {id:'ace-meaning', phrase:'The spark is alive, but the finished "castle" is further down the road.', card:'ace', detail:'sprout', secondary:'castle', meaning:true},
  {id:'swords-arrival', phrase:'Seven of Swords (Reversed), the challenge.', card:'swords'},
  {id:'swords-carried', phrase:'a figure tiptoeing out of camp with five swords', card:'swords', detail:'carried'},
  {id:'swords-left', phrase:'and leaving two behind', card:'swords', detail:'two-swords'},
  {id:'swords-meaning', phrase:"those two missing swords: the decisions you haven't made explicit yet.", card:'swords', detail:'two-swords', meaning:true},
  {id:'queen-arrival', phrase:'Queen of Cups (Upright), the hidden influence.', card:'queen'},
  {id:'queen-cup', phrase:'holding an ornate, covered cup with real devotion', card:'queen', detail:'cup'},
  {id:'queen-tone', phrase:'Your worry about tone could be her voice', card:'queen', detail:'cup', meaning:true},
  {id:'queen-question', phrase:'does the cup just feel too precious to uncover?', card:'queen', detail:'cup', meaning:true},
  {id:'pentacles-arrival', phrase:'Three of Pentacles (Upright), the support.', card:'pentacles'},
  {id:'pentacles-group', phrase:'A craftsman stands in a cathedral talking plans over with a monk and a noble', card:'pentacles', detail:'collaborators'},
  {id:'pentacles-meaning', phrase:'someone who knows the craft and someone closer to the audience.', card:'pentacles', detail:'collaborators', meaning:true},
  {id:'wheel-arrival', phrase:'Wheel of Fortune (Reversed), the likely direction.', card:'wheel'},
  {id:'wheel-image', phrase:'a great wheel with a sphinx on top, a snake sliding down one side and Anubis rising on the other.', card:'wheel', detail:'wheel'},
  {id:'wheel-loop', phrase:'a loop of draft, doubt, and redraft is holding the wheel in place.', card:'wheel', detail:'wheel', meaning:true},
  {id:'drive-and-sensitivity', phrase:'The Ace of Wands and Queen of Cups suggest both your drive and your sensitivity are worth trusting.', card:'ace', detail:'sprout', pair:{card:'queen', detail:'cup'}, meaning:true},
  {id:'readiness', phrase:'The two reversals point toward structure and readiness', card:'swords', pair:{card:'wheel'}, meaning:true},
  {id:'collaboration-return', phrase:'the Three of Pentacles points toward other people as the way to get unstuck.', card:'pentacles', detail:'collaborators', meaning:true},
  {id:'missing-swords-return', phrase:'Write down the two missing swords.', card:'swords', detail:'two-swords', meaning:true},
  {id:'tone-check-return', phrase:'Ask for a tone check only.', card:'pentacles', detail:'collaborators', meaning:true},
  {id:'momentum-return', phrase:'A preview, an announcement, or a waitlist gives the wheel something to turn on before the full reveal.', card:'wheel', detail:'wheel', meaning:true},
  {id:'closing-spark', phrase:'The spark in this spread is clearly yours', card:'ace', detail:'sprout', meaning:true}
];

// Ranges belong to this exact recorded reading, never a card-name keyword catalog.
const plain = (text) => text.replaceAll('**', '');
const bodyText = fixture.sections.map(section => plain(section.body)).join('\n\n');
const cues = spec.map(cue => {
  const start = bodyText.indexOf(cue.phrase);
  if (start < 0 || bodyText.indexOf(cue.phrase, start + 1) !== -1) throw new Error(`Ambiguous fixture cue: ${cue.id}`);
  return {...cue, start, end:start + cue.phrase.length};
});
const introductions = Object.fromEntries(ids.map(id => {
  const arrival = cues.find(cue => cue.id === `${id}-arrival`);
  const details = cues.filter(cue => cue.card === id && cue.detail && !cue.meaning && !cue.pair);
  return [id, {start:arrival.start, named:arrival.end, description:details[0].start, midpoint:details[0].start + (details.at(-1).end - details[0].start) / 2, end:details.at(-1).end}];
}));
const state = {cursor:0, playing:false, started:false, complete:false, held:null, active:null, pending:null, delivered:-1, lastGesture:-Infinity, seen:new Set(), presence:{}, stageVisible:false};
let words = [];
let associations = [];
let streamTimer;
let cueTimer;
let settleTimer;
let scrollFrame;
let focusSizeFrame;
const animations = new Set();

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function stopArtMotion() {
  animations.forEach(animation => animation.cancel());
  animations.clear();
  $$('.fd-departing').forEach(node => node.remove());
}

function animate(node, frames, options) {
  if (reduced.matches || document.hidden || !state.stageVisible) return;
  const animation = node.animate(frames, options);
  animations.add(animation);
  animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
  return animation;
}

function buildProse() {
  const container = $('[data-prose]');
  const sections = [];
  let offset = 0;
  for (const section of fixture.sections) {
    const wrapper = element('section', 'fd-section');
    wrapper.append(element('h2', '', section.heading));
    let list;
    for (const paragraph of section.body.split('\n\n')) {
      const isList = paragraph.startsWith('- ');
      const entries = isList ? paragraph.split('\n') : [paragraph];
      if (isList) {list = element('ul'); wrapper.append(list);}
      entries.forEach((entry, index) => {
        const node = element(isList ? 'li' : 'p');
        let strong = false;
        let phrase;
        const prefix = isList ? '- ' : '';
        offset += prefix.length;
        for (const part of entry.slice(prefix.length).split(/(\*\*)/)) {
          if (part === '**') {strong = !strong; continue;}
          for (const token of part.matchAll(/\S+\s*|^\s+/g)) {
            const value = token[0];
            const cue = cues.find(candidate => offset < candidate.end && offset + value.length > candidate.start);
            if (cue && (!phrase || phrase.dataset.cue !== cue.id)) {
              phrase = element('span', 'fd-association');
              phrase.dataset.cue = cue.id;
              phrase.setAttribute('role', 'button');
              phrase.setAttribute('aria-pressed', 'false');
              phrase.tabIndex = -1;
              bindAssociation(phrase, cue);
              node.append(phrase); associations.push(phrase);
            } else if (!cue) phrase = null;
            const word = element('span', 'fd-word', value);
            if (strong) {const emphasis = element('strong'); emphasis.append(word); (phrase || node).append(emphasis);}
            else (phrase || node).append(word);
            words.push({node:word, start:offset, end:offset + value.length});
            offset += value.length;
          }
        }
        (isList ? list : wrapper).append(node);
        if (index < entries.length - 1) offset += 1;
      });
      offset += 2;
    }
    sections.push(wrapper);
  }
  if (offset - 2 !== bodyText.length) throw new Error('Fixture paragraph offsets changed');
  container.replaceChildren(...sections);
}

function buildShelf() {
  $('[data-shelf]').replaceChildren(...ids.map((id, index) => {
    const slot = element('div', 'fd-slot'); slot.dataset.slot = id;
    const button = element('button', 'fd-card'); button.type = 'button'; button.dataset.card = id;
    button.setAttribute('aria-label', `${names[id]}, ${fixture.cards[index].orientation.toLowerCase()}, ${fixture.cards[index].position}. Inspect whole card.`);
    button.setAttribute('aria-pressed', 'false'); button.disabled = true;
    button.append(createArtwork(id));
    slot.append(button, element('span', 'fd-position', positions[index]));
    button.addEventListener('click', () => inspectCard(id));
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const available = ids.filter(card => state.seen.has(card));
      const at = available.indexOf(id);
      const next = event.key === 'Home' ? available[0] : event.key === 'End' ? available.at(-1) : available[(at + (event.key === 'ArrowLeft' ? -1 : 1) + available.length) % available.length];
      $(`[data-card="${next}"]`).focus({preventScroll:true});
    });
    return slot;
  }));
}

function presenceFor(id, end) {
  const range = introductions[id];
  if (end <= range.start) return 0;
  if (reduced.matches) return end >= range.named ? 1 : 0;
  if (end >= range.end) return 1;
  if (end < range.description) return .035 * (end - range.start) / (range.description - range.start);
  if (end < range.midpoint) return .035 + .515 * ((end - range.description) / (range.midpoint - range.description)) ** 2;
  return .55 + .45 * (1 - (1 - (end - range.midpoint) / Math.max(1, range.end - range.midpoint)) ** 2);
}

function updateDelivery() {
  const end = words[state.cursor - 1]?.end || 0;
  for (const id of ids) {
    const presence = Math.max(state.presence[id] || 0, presenceFor(id, end));
    state.presence[id] = presence;
    if (end >= introductions[id].named) state.seen.add(id);
    const card = $(`[data-card="${id}"]`);
    card.style.setProperty('--presence', presence.toFixed(4));
    card.style.visibility = presence === 0 ? 'hidden' : 'visible';
    card.disabled = !state.seen.has(id);
    card.parentNode.classList.toggle('is-introduced', state.seen.has(id));
  }
  associations.forEach(node => {
    const cue = cues.find(candidate => candidate.id === node.dataset.cue);
    const available = end >= cue.end;
    node.classList.toggle('is-available', available);
    node.tabIndex = available ? 0 : -1;
    // Arrived words stay readable before the complete phrase becomes a control.
    node.removeAttribute('aria-hidden');
    if (available) node.setAttribute('role', 'button');
    else {node.removeAttribute('role'); node.removeAttribute('aria-pressed');}
  });
  const latest = cues.findLastIndex(cue => cue.end <= end);
  if (latest > state.delivered) {
    state.delivered = latest;
    offer(cues[latest]);
    if (!cueVisible(cues[latest])) accompanyVisible();
  }
  $$('[data-window] .fd-view').forEach(view => view.style.setProperty('--presence', (state.presence[view.dataset.card] || 0).toFixed(4)));
  updateState();
}

function updateState() {
  root.dataset.cue = state.active?.id || 'opening';
  root.dataset.held = String(Boolean(state.held));
  root.dataset.complete = String(state.complete);
  root.dataset.cursor = String(state.cursor);
  root.dataset.introduced = ids.filter(id => state.seen.has(id)).join(',');
  associations.forEach(node => {
    const active = node.dataset.cue === state.active?.id;
    if (node.classList.contains('is-available')) node.setAttribute('aria-pressed', String(Boolean(active && state.held)));
    node.classList.toggle('is-associated', Boolean(active && state.held));
  });
  $$('.fd-card[data-card]').forEach(button => {
    const selected = state.active && (button.dataset.card === state.active.card || button.dataset.card === state.active.pair?.card);
    button.classList.toggle('is-current', Boolean(selected));
    button.setAttribute('aria-pressed', String(Boolean(selected && state.held)));
  });
  $('[data-focus]').setAttribute('aria-pressed', String(Boolean(state.held)));
}

function cueVisible(cue) {
  const node = associations.find(candidate => candidate.dataset.cue === cue?.id);
  if (!node || !node.classList.contains('is-available')) return false;
  const rect = node.getBoundingClientRect();
  const stageBottom = compact.matches ? $('.fd-companion').getBoundingClientRect().bottom : 0;
  return rect.bottom > Math.max(12, stageBottom) && rect.top < innerHeight - 12;
}

function frameView(view) {
  const id = view.dataset.card;
  const detail = DETAILS[view.dataset.detail];
  const art = ARTWORK[id];
  const w = view.clientWidth, h = view.clientHeight;
  if (!w || !h) return;
  const useDetail = compact.matches && detail;
  const frame = useDetail ? detail.frame : null;
  const spans = {'sprout':.38, 'two-swords':.43, 'cup':.34, 'collaborators':.47, 'wheel':.43};
  const scale = frame ? Math.min(Math.max(w / art.width, h / art.height) * frame.zoom, spans[view.dataset.detail] ? h / (art.height * spans[view.dataset.detail]) : Infinity) : Math.min(w / art.width, h / art.height);
  const iw = art.width * scale, ih = art.height * scale;
  const cx = frame ? (art.reversed ? 1 - frame.x : frame.x) : .5;
  const frameY = view.dataset.detail === 'sprout' ? .22 : frame?.y;
  const cy = frame ? (art.reversed ? 1 - frameY : frameY) : .5;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const x = iw < w ? (w - iw) / 2 : clamp(w / 2 - cx * iw, w - iw, 0);
  const y = ih < h ? (h - ih) / 2 : clamp(h / 2 - cy * ih, h - ih, 0);
  view.firstChild.style.width = `${art.width}px`;
  view.firstChild.style.height = `${art.height}px`;
  view.firstChild.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${scale.toFixed(5)})`;
  view.style.setProperty('--presence', (state.presence[id] || 0).toFixed(4));
}

function createView(config) {
  const view = element('span', 'fd-view');
  view.dataset.card = config.card; view.dataset.detail = config.detail || 'identity';
  const transform = element('span', 'fd-view-transform'); transform.append(createArtwork(config.card, config.secondary ? [config.detail, config.secondary] : config.detail));
  view.append(transform); return view;
}

function settle() {
  stopArtMotion();
  $('.fd-companion').classList.add('is-settled');
  if (!state.held) associations.forEach(node => node.classList.remove('is-associated'));
}

function apply(cue, inspection = false) {
  clearTimeout(cueTimer); clearTimeout(settleTimer); stopArtMotion();
  state.active = cue; state.pending = null; state.lastGesture = performance.now();
  const configs = [{card:cue.card, detail:cue.detail, secondary:cue.secondary}];
  if (cue.pair) configs.push(cue.pair);
  if (compact.matches && cue.secondary) {
    delete configs[0].secondary;
    configs.push({card:cue.card, detail:cue.secondary});
  }
  const focus = $('[data-focus]');
  const window = $('[data-window]');
  const signature = configs.map(config => `${config.card}:${config.detail || 'identity'}:${config.secondary || ''}`).join(',');
  const changed = window.dataset.signature !== signature;
  const departing = changed && window.children.length ? window.cloneNode(true) : null;
  if (changed) {
    window.replaceChildren(...configs.map(createView)); window.dataset.signature = signature;
  }
  window.classList.toggle('is-pair', configs.length === 2);
  $('.fd-companion').classList.remove('is-settled', 'is-empty');
  $('.fd-companion').classList.toggle('is-held', inspection);
  const cardNames = [...new Set(configs.map(config => names[config.card]))];
  $('[data-focus-title]').textContent = cardNames.join(' & ');
  $('[data-focus-position]').textContent = cue.pair ? 'In conversation' : `${fixture.cards[ids.indexOf(cue.card)].position} · ${fixture.cards[ids.indexOf(cue.card)].orientation}`;
  focus.setAttribute('aria-label', `${cardNames.join(' and ')}. ${inspection ? 'Release held connection' : 'Hold this connection'}.`);
  $$('[data-window] .fd-view').forEach(frameView);
  if (departing && !reduced.matches && !document.hidden && state.stageVisible) {
    departing.classList.add('fd-departing'); departing.removeAttribute('data-window');
    departing.setAttribute('aria-hidden', 'true'); focus.append(departing);
    const transition = animate(departing, [{opacity:.65}, {opacity:0}], {duration:600, easing:'ease-out'});
    if (transition) transition.finished.then(() => departing.remove(), () => departing.remove());
    else departing.remove();
  }
  if (changed) $$('[data-window] .fd-view').forEach(view => animate(view, [{opacity:.25}, {opacity:1}], {duration:700, easing:'cubic-bezier(.16,1,.3,1)'}));
  for (const light of $$('[data-window] .fd-light')) animate(light, [{opacity:.12}, {opacity:.8, offset:.65}, {opacity:.62}], {duration:1600, easing:'ease-out'});
  for (const trace of $$('[data-window] .fd-trace-path')) animate(trace, [{strokeDashoffset:1, opacity:0}, {strokeDashoffset:.4, opacity:.65, offset:.6}, {strokeDashoffset:0, opacity:0}], {duration:1800, easing:'cubic-bezier(.16,1,.3,1)'});
  if (!inspection) settleTimer = setTimeout(settle, cue.pair ? 3500 : 2500);
  updateState();
}

function offer(cue) {
  state.pending = cue;
  if (state.held || document.hidden || !state.stageVisible || !cueVisible(cue)) return;
  const wait = Math.max(0, 1600 - (performance.now() - state.lastGesture));
  clearTimeout(cueTimer);
  if (!wait) apply(cue);
  else cueTimer = setTimeout(() => {
    if (!state.held && state.pending && !document.hidden && state.stageVisible && cueVisible(state.pending)) apply(state.pending);
  }, wait);
}

function hold(cue) {
  state.held = cue;
  state.presence[cue.card] = 1;
  if (cue.pair) state.presence[cue.pair.card] = 1;
  apply(cue, true);
  $('[data-status]').textContent = `${names[cue.card]} connection held. Text continues arriving.`;
}

function release() {
  if (!state.held) return;
  state.held = null;
  $('.fd-companion').classList.remove('is-held');
  clearTimeout(settleTimer); settle(); updateState();
  $('[data-status]').textContent = 'Connection released.';
  accompanyVisible();
}

function inspectCard(id) {
  if (!state.seen.has(id)) return;
  if (state.held?.id === `identity-${id}`) {release(); return;}
  // Clicking a card establishes identity. Details belong to explicit passage associations.
  hold({id:`identity-${id}`, card:id});
}

function bindAssociation(node, cue) {
  const activate = () => {
    if (!node.classList.contains('is-available')) return;
    if (state.held?.id === cue.id) release(); else hold(cue);
  };
  node.addEventListener('click', activate);
  node.addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key)) return;
    event.preventDefault(); if (!event.repeat) activate();
  });
}

function accompanyVisible() {
  if (state.held || document.hidden || !state.stageVisible) return;
  const candidates = cues.filter(cue => cue.end <= (words[state.cursor - 1]?.end || 0) && cueVisible(cue));
  if (!candidates.length) {stopArtMotion(); return;}
  const line = compact.matches ? Math.min(innerHeight - 100, $('.fd-companion').getBoundingClientRect().bottom + 145) : innerHeight * .42;
  const candidate = candidates.reduce((best, cue) => {
    const top = associations.find(node => node.dataset.cue === cue.id).getBoundingClientRect().top;
    return Math.abs(top - line) < best.distance ? {cue, distance:Math.abs(top - line)} : best;
  }, {cue:null, distance:Infinity}).cue;
  // Viewport eligibility supports revisiting; it does not claim to detect gaze.
  if (candidate.id !== state.active?.id) offer(candidate);
}

function tick() {
  if (!state.playing || document.hidden) return;
  const burst = $('[data-arrival]').value === 'burst';
  const count = burst ? [9, 24, 7, 31][Math.floor(state.cursor / 9) % 4] : 1;
  const end = Math.min(words.length, state.cursor + count);
  for (let index = state.cursor; index < end; index++) {words[index].node.classList.remove('is-pending'); words[index].node.removeAttribute('aria-hidden');}
  state.cursor = end;
  updateDelivery();
  if (end === words.length) {state.playing = false; state.complete = true; updateState(); $('[data-status]').textContent = state.held ? 'Reading complete. Connection remains held.' : 'Reading complete.'; return;}
  const punctuation = /[.!?]["']?\s*$/.test(words[end - 1].node.textContent) ? 330 : 0;
  streamTimer = setTimeout(tick, burst ? 140 : 125 + punctuation);
}

function replay() {
  clearTimeout(streamTimer); clearTimeout(cueTimer); clearTimeout(settleTimer); stopArtMotion();
  Object.assign(state, {cursor:0, playing:true, started:true, complete:false, held:null, active:null, pending:null, delivered:-1, lastGesture:-Infinity, seen:new Set(), presence:{}});
  $('[data-window]').replaceChildren(); $('[data-window]').dataset.signature = '';
  $('[data-focus-title]').textContent = 'Your spread';
  $('[data-focus-position]').textContent = fixture.spreadName;
  $('.fd-companion').classList.add('is-empty'); $('.fd-companion').classList.remove('is-held');
  words.forEach(word => {word.node.classList.add('is-pending'); word.node.setAttribute('aria-hidden', 'true');});
  updateDelivery(); tick();
}

buildProse(); buildShelf();
root.classList.add('is-ready');
words.forEach(word => {word.node.classList.add('is-pending'); word.node.setAttribute('aria-hidden', 'true');});
updateDelivery();
$('[data-focus]').addEventListener('click', () => {
  if (!state.active) return;
  if (state.held) release(); else hold(state.active);
});
$('[data-action="all"]').addEventListener('click', () => {
  clearTimeout(streamTimer); state.playing = false; state.complete = true; state.started = true; state.cursor = words.length;
  words.forEach(word => {word.node.classList.remove('is-pending'); word.node.removeAttribute('aria-hidden');});
  updateDelivery(); accompanyVisible();
});
$('[data-action="replay"]').addEventListener('click', replay);
$('[data-reflection-toggle]').addEventListener('change', event => {$('[data-reflection]').hidden = !event.target.checked;});
root.addEventListener('keydown', event => {if (event.key === 'Escape' && state.held) {event.preventDefault(); release();}});
addEventListener('scroll', () => {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {scrollFrame = null; accompanyVisible();});
}, {passive:true});
const resize = new ResizeObserver(() => {
  cancelAnimationFrame(focusSizeFrame);
  focusSizeFrame = requestAnimationFrame(() => $$('[data-window] .fd-view').forEach(frameView));
});
resize.observe($('[data-window]'));
const stageVisibility = new IntersectionObserver(entries => {
  state.stageVisible = entries[0].isIntersecting;
  if (!state.stageVisible) stopArtMotion();
  else if (!state.started) replay();
  else if (!state.held) accompanyVisible();
}, {threshold:0});
stageVisibility.observe($('.fd-companion'));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {clearTimeout(streamTimer); clearTimeout(cueTimer); stopArtMotion();}
  else {if (state.playing) tick(); accompanyVisible();}
});
reduced.addEventListener('change', () => {
  stopArtMotion(); updateDelivery();
  if (state.active) {$$('.fd-view').forEach(frameView); settle();}
});
compact.addEventListener('change', () => {
  if (state.active?.secondary) apply(state.active, Boolean(state.held));
  else $$('[data-window] .fd-view').forEach(frameView);
  accompanyVisible();
});
addEventListener('pagehide', event => {
  clearTimeout(streamTimer); clearTimeout(cueTimer); clearTimeout(settleTimer); stopArtMotion();
  cancelAnimationFrame(scrollFrame); cancelAnimationFrame(focusSizeFrame);
  if (!event.persisted) {stageVisibility.disconnect(); resize.disconnect();}
});
addEventListener('pageshow', event => {if (event.persisted) {if (state.playing && !document.hidden) tick(); accompanyVisible();}});
