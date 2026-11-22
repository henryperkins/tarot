const DEFAULT_SPRITE_URL = '/audio/cinematic-sprite.mp3?v=2';

const DEFAULT_SPRITE_MAP = {
  knock: { start: 0, duration: 0.28, essential: true },
  shuffle: { start: 0.32, duration: 0.62, essential: true },
  deal: { start: 1.0, duration: 0.42, essential: true },
  flip: { start: 1.46, duration: 0.38, essential: true },
  'reveal-bloom': { start: 1.9, duration: 0.78, essential: true },
  // The decoded reading tone at this gain sits about 3 dB below the room loop.
  'narrative-ambient': { start: 2.74, duration: 6.2, essential: false, loop: true, volume: 0.08 },
  'phase-transition': { start: 9.04, duration: 0.9, essential: false },
  'complete-chime': { start: 10.0, duration: 1.12, essential: true }
};

const SYNTH_CUE_MAP = {
  knock: { type: 'triangle', frequency: 110, attack: 0.006, release: 0.15, gain: 0.2 },
  shuffle: { type: 'sawtooth', frequency: 180, attack: 0.01, release: 0.45, gain: 0.12, sweepTo: 120 },
  deal: { type: 'triangle', frequency: 230, attack: 0.006, release: 0.2, gain: 0.16, sweepTo: 280 },
  flip: { type: 'sine', frequency: 420, attack: 0.005, release: 0.2, gain: 0.14, sweepTo: 520 },
  'reveal-bloom': { type: 'triangle', frequency: 380, attack: 0.03, release: 0.55, gain: 0.18, sweepTo: 760 },
  'narrative-ambient': { type: 'sine', frequency: 96, attack: 0.2, release: 1.2, gain: 0.08, sweepTo: 108 },
  'phase-transition': { type: 'triangle', frequency: 150, attack: 0.02, release: 0.55, gain: 0.14, sweepTo: 280 },
  'complete-chime': { type: 'sine', frequency: 520, attack: 0.03, release: 0.9, gain: 0.16, sweepTo: 740 }
};

function createAudioContext() {
  if (typeof window === 'undefined') return null;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  try {
    return new Context();
  } catch {
    return null;
  }
}

function clampVolume(value) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
}

export class SoundManager {
  constructor({
    spriteUrl = DEFAULT_SPRITE_URL,
    spriteMap = DEFAULT_SPRITE_MAP,
    muted = false
  } = {}) {
    this.spriteUrl = spriteUrl;
    this.spriteMap = spriteMap;
    this.context = null;
    this.masterGain = null;
    this.audioBuffer = null;
    this.loadPromise = null;
    this.spriteLoadFailed = false;
    this.volume = 1;
    this.muted = muted;
    this.reducedMotion = false;
    this.activeSources = new Map();
    this.scheduledStarts = new Map();
    // The latest play() of each cue that has not produced a source yet.
    this.pendingStarts = new Map();
  }

  ensureContext() {
    if (this.context && this.masterGain) return true;

    const context = createAudioContext();
    if (!context) return false;

    this.context = context;
    this.masterGain = context.createGain();
    this.masterGain.gain.value = this.muted ? 0 : this.volume;
    this.masterGain.connect(context.destination);
    return true;
  }

  async preload() {
    if (this.audioBuffer) return this.audioBuffer;
    if (this.spriteLoadFailed) return null;
    if (this.loadPromise) return this.loadPromise;
    if (!this.ensureContext()) return null;

    // A reconnect can precede the rejection from the old connection. In
    // either order, allow one new download when a cue is next requested.
    let reconnected = false;
    const onReconnect = () => {
      reconnected = true;
      this.spriteLoadFailed = false;
    };
    const networkEvents = globalThis.window;
    networkEvents?.addEventListener?.('online', onReconnect, { once: true });
    this.loadPromise = (async () => {
      const response = await fetch(this.spriteUrl, { cache: 'force-cache' });
      if (!response.ok) {
        throw new Error(`Failed to load cinematic sprite: ${response.status}`);
      }

      const bytes = await response.arrayBuffer();
      const decoded = await this.context.decodeAudioData(bytes);
      this.audioBuffer = decoded;
      networkEvents?.removeEventListener?.('online', onReconnect);
      return decoded;
    })().catch((err) => {
      this.spriteLoadFailed = !reconnected;
      console.warn('[SoundManager] preload failed:', err);
      return null;
    }).finally(() => {
      this.loadPromise = null;
    });
    return this.loadPromise;
  }

  setReducedMotion(value) {
    this.reducedMotion = Boolean(value);
  }

  setVolume(value = 1) {
    this.volume = clampVolume(value);
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
    }
  }

  mute(nextMuted = true) {
    this.muted = Boolean(nextMuted);
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
    }
    if (this.muted) this.stopAll();
  }

  schedule(name, delayMs, opts) {
    if (this.muted || !this.spriteMap[name]) return () => {};
    const timer = setTimeout(() => {
      this.scheduledStarts.delete(timer);
      void this.play(name, opts);
    }, delayMs);
    this.scheduledStarts.set(timer, name);
    return () => this.cancelScheduled(timer);
  }

  cancelScheduled(timer) {
    if (this.scheduledStarts.delete(timer)) clearTimeout(timer);
  }

  stopActive(key) {
    this.activeSources.get(key)?.stop();
    this.activeSources.delete(key);
  }

  stopAll() {
    for (const timer of this.scheduledStarts.keys()) this.cancelScheduled(timer);
    this.pendingStarts.clear();
    for (const key of this.activeSources.keys()) this.stopActive(key);
  }

  playSynthCue(name, cue, opts = {}) {
    if (!this.context || !this.masterGain) return null;
    const profile = SYNTH_CUE_MAP[name] || {
      type: 'sine',
      frequency: 220,
      attack: 0.01,
      release: 0.2,
      gain: 0.12
    };

    const shouldLoop = Boolean(opts.loop ?? cue.loop);
    const duration = Math.max(0.06, opts.duration ?? cue.duration ?? 0.1);
    const now = this.context.currentTime;
    const source = this.context.createOscillator();
    const gainNode = this.context.createGain();
    const level = clampVolume(opts.volume ?? cue.volume ?? 1) * profile.gain;
    const attack = Math.max(0.002, profile.attack || 0.01);
    const release = Math.max(0.04, profile.release || duration);
    const endTime = now + duration;

    source.type = profile.type || 'sine';
    source.frequency.setValueAtTime(profile.frequency || 220, now);
    if (Number.isFinite(profile.sweepTo) && profile.sweepTo > 0) {
      source.frequency.linearRampToValueAtTime(profile.sweepTo, endTime);
    }

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, level), now + attack);
    if (!shouldLoop) {
      gainNode.gain.setValueAtTime(Math.max(0.0001, level), Math.max(now + attack, endTime - release));
      gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);
    }

    source.connect(gainNode);
    gainNode.connect(this.masterGain);
    source.start(now);
    if (!shouldLoop) {
      source.stop(endTime + 0.03);
    }

    const token = {
      source,
      gainNode,
      stop: () => {
        try {
          source.stop();
        } catch {
          // no-op
        }
      }
    };

    source.onended = () => {
      const current = this.activeSources.get(name);
      if (current?.source === source) {
        this.activeSources.delete(name);
      }
    };

    this.activeSources.set(name, token);
    return token;
  }

  stop(name) {
    const key = String(name || '');
    for (const [timer, scheduledName] of this.scheduledStarts) {
      if (scheduledName === key) this.cancelScheduled(timer);
    }
    this.pendingStarts.delete(key);
    this.stopActive(key);
  }

  async play(name, opts = {}) {
    const key = String(name || '');
    const cue = this.spriteMap[key];
    if (!cue) return null;
    if (this.muted) return null;

    const essential = opts.essential ?? cue.essential ?? false;
    if (this.reducedMotion && !essential) {
      return null;
    }

    // `restart: false` keeps a cue going: one that is playing, or about to,
    // is left alone instead of being started a second time. A second copy
    // would replace the first in activeSources, and stop() could then never
    // reach the first.
    if (opts.restart === false && (this.activeSources.has(key) || this.pendingStarts.has(key))) {
      return this.activeSources.get(key) || null;
    }
    if (!this.ensureContext()) return null;
    const request = {};
    this.pendingStarts.set(key, request);

    // Request the context during the user's gesture, before the asset fetch.
    const resuming = this.context.state === 'suspended' ? this.context.resume().catch(() => {}) : null;
    const buffer = this.audioBuffer || await this.preload();
    if (resuming) await resuming;

    // stop(), or a later play() of this cue, arrived while this one loaded.
    if (this.pendingStarts.get(key) !== request) return null;
    this.pendingStarts.delete(key);
    if (!this.context || !this.masterGain) return null;

    if (opts.restart !== false) {
      this.stopActive(key);
    }

    if (!buffer) {
      return this.playSynthCue(key, cue, opts);
    }

    const source = this.context.createBufferSource();
    const gainNode = this.context.createGain();
    source.buffer = buffer;
    source.connect(gainNode);
    gainNode.connect(this.masterGain);
    gainNode.gain.value = clampVolume(opts.volume ?? cue.volume ?? 1);

    const start = Math.max(0, cue.start || 0);
    const duration = Math.max(0.01, opts.duration ?? cue.duration ?? 0.1);
    const shouldLoop = Boolean(opts.loop ?? cue.loop);

    if (shouldLoop) {
      source.loop = true;
      source.loopStart = start;
      source.loopEnd = start + duration;
      source.start(0, start);
    } else {
      source.start(0, start, duration);
    }

    const token = {
      source,
      gainNode,
      stop: () => {
        try {
          source.stop();
        } catch {
          // no-op
        }
      }
    };

    source.onended = () => {
      const current = this.activeSources.get(key);
      if (current?.source === source) {
        this.activeSources.delete(key);
      }
    };

    this.activeSources.set(key, token);
    return token;
  }
}

export const cinematicSoundManager = new SoundManager({ muted: true });
