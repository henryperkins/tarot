const DEFAULT_SPRITE_URL = '/audio/cinematic-sprite.mp3';

const DEFAULT_SPRITE_MAP = {
  knock: { start: 0, duration: 0.28, essential: true },
  shuffle: { start: 0.32, duration: 0.62, essential: true },
  deal: { start: 1.0, duration: 0.42, essential: true },
  flip: { start: 1.46, duration: 0.38, essential: true },
  'reveal-bloom': { start: 1.9, duration: 0.78, essential: true },
  'narrative-ambient': { start: 2.74, duration: 6.2, essential: false, loop: true },
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
  return new Context();
}

function clampVolume(value) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
}

export class SoundManager {
  constructor({
    spriteUrl = DEFAULT_SPRITE_URL,
    spriteMap = DEFAULT_SPRITE_MAP
  } = {}) {
    this.spriteUrl = spriteUrl;
    this.spriteMap = spriteMap;
    this.context = null;
    this.masterGain = null;
    this.audioBuffer = null;
    this.loadPromise = null;
    this.spriteLoadFailed = false;
    this.volume = 1;
    this.muted = false;
    this.reducedMotion = false;
    this.activeSources = new Map();
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

    this.loadPromise = (async () => {
      if (!this.ensureContext()) {
        this.loadPromise = null;
        return null;
      }

      const response = await fetch(this.spriteUrl, { cache: 'force-cache' });
      if (!response.ok) {
        throw new Error(`Failed to load cinematic sprite: ${response.status}`);
      }

      const bytes = await response.arrayBuffer();
      const decoded = await this.context.decodeAudioData(bytes);
      this.audioBuffer = decoded;
      return decoded;
    })().catch((err) => {
      this.spriteLoadFailed = true;
      console.warn('[SoundManager] preload failed:', err);
      return null;
    });

    const result = await this.loadPromise;
    if (!result) {
      this.loadPromise = null;
    }
    return result;
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
    const level = clampVolume(opts.volume ?? 1) * profile.gain;
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
    const active = this.activeSources.get(key);
    if (!active?.source) return;
    try {
      active.source.stop();
    } catch {
      // no-op
    }
    this.activeSources.delete(key);
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

    const buffer = this.audioBuffer || await this.preload();
    if (!this.context || !this.masterGain) return null;

    if (this.context.state === 'suspended') {
      try {
        await this.context.resume();
      } catch {
        // no-op
      }
    }

    if (opts.restart !== false) {
      this.stop(key);
    }

    if (!buffer) {
      return this.playSynthCue(key, cue, opts);
    }

    const source = this.context.createBufferSource();
    const gainNode = this.context.createGain();
    source.buffer = buffer;
    source.connect(gainNode);
    gainNode.connect(this.masterGain);
    gainNode.gain.value = clampVolume(opts.volume ?? 1);

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

export const cinematicSoundManager = new SoundManager();
