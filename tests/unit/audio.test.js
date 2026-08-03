import { describe, it, expect, beforeEach, vi } from 'vitest';

// SPEC.md §4. The parity requirement in §4.3 is why this module exists as its
// own unit: audio is a detection channel, so a rigged mismatch must be
// indistinguishable from an honest one.

/**
 * Records every node the module constructs and every value it schedules, so a
 * whole cue can be compared as a structure rather than as sound.
 */
function installAudioMock() {
  const contexts = [];

  class FakeParam {
    constructor(log, label) {
      this.log = log;
      this.label = label;
      this.value = 0;
    }
    setValueAtTime(v, t) {
      this.log.push(['setValueAtTime', this.label, v, t]);
      return this;
    }
    linearRampToValueAtTime(v, t) {
      this.log.push(['linearRampToValueAtTime', this.label, v, t]);
      return this;
    }
    exponentialRampToValueAtTime(v, t) {
      this.log.push(['exponentialRampToValueAtTime', this.label, v, t]);
      return this;
    }
  }

  class FakeContext {
    constructor() {
      this.currentTime = 0;
      this.destination = { kind: 'destination' };
      this.log = [];
      this.oscillators = [];
      this.gains = [];
      contexts.push(this);
    }
    createOscillator() {
      const log = this.log;
      const osc = {
        kind: 'oscillator',
        type: 'sine',
        frequency: new FakeParam(log, 'frequency'),
        connect: (t) => log.push(['connect', 'oscillator', t.kind]),
        start: (t) => log.push(['start', t]),
        stop: (t) => log.push(['stop', t]),
      };
      this.oscillators.push(osc);
      log.push(['createOscillator']);
      return osc;
    }
    createGain() {
      const log = this.log;
      const gain = {
        kind: 'gain',
        gain: new FakeParam(log, 'gain'),
        connect: (t) => log.push(['connect', 'gain', t.kind]),
      };
      this.gains.push(gain);
      log.push(['createGain']);
      return gain;
    }
    close() {}
  }

  globalThis.AudioContext = FakeContext;
  globalThis.webkitAudioContext = FakeContext;
  return contexts;
}

/** Capture the node graph a single cue builds, normalized to call start. */
function capture(contexts, fn) {
  const ctx = contexts[contexts.length - 1];
  const before = ctx ? ctx.log.length : 0;
  fn();
  const active = contexts[contexts.length - 1];
  return active.log.slice(active === ctx ? before : 0);
}

let contexts;
let audio;

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  contexts = installAudioMock();
  audio = await import('../../js/audio.js');
});

describe('audio module', () => {
  it('exports the three cues and a mute control', () => {
    expect(audio.beepFlip).toBeTypeOf('function');
    expect(audio.beepMatch).toBeTypeOf('function');
    expect(audio.beepMismatch).toBeTypeOf('function');
    expect(audio.isMuted).toBeTypeOf('function');
    expect(audio.setMuted).toBeTypeOf('function');
    expect(audio.toggleMute).toBeTypeOf('function');
  });

  it('creates no AudioContext before the first gesture', () => {
    // Browsers block context creation outside a gesture. A context built at
    // module load would leave the game permanently silent.
    expect(contexts).toHaveLength(0);
  });

  it('creates the context on first use and reuses it', () => {
    audio.beepFlip();
    expect(contexts).toHaveLength(1);
    audio.beepFlip();
    audio.beepMatch();
    audio.beepMismatch();
    expect(contexts).toHaveLength(1);
  });
});

describe('cues', () => {
  it('beepFlip is a short square click', () => {
    audio.beepFlip();
    const ctx = contexts[0];
    expect(ctx.oscillators).toHaveLength(1);
    expect(ctx.oscillators[0].type).toBe('square');
    const freq = ctx.log.find((e) => e[0] === 'setValueAtTime' && e[1] === 'frequency');
    expect(freq[2]).toBeCloseTo(440, -1);
    const stop = ctx.log.find((e) => e[0] === 'stop');
    expect(stop[1]).toBeCloseTo(0.04, 2);
  });

  it('beepMatch is a rising two-note arpeggio', () => {
    audio.beepMatch();
    const ctx = contexts[0];
    expect(ctx.oscillators).toHaveLength(2);
    const freqs = ctx.log
      .filter((e) => e[0] === 'setValueAtTime' && e[1] === 'frequency')
      .map((e) => e[2]);
    expect(freqs).toHaveLength(2);
    // The rise is what makes it read as success.
    expect(freqs[1]).toBeGreaterThan(freqs[0]);
  });

  it('beepMismatch is a low buzz with a decay', () => {
    audio.beepMismatch();
    const ctx = contexts[0];
    expect(ctx.oscillators).toHaveLength(1);
    expect(ctx.oscillators[0].type).toBe('square');
    const freq = ctx.log.find((e) => e[0] === 'setValueAtTime' && e[1] === 'frequency');
    expect(freq[2]).toBeCloseTo(180, -1);
    const ramp = ctx.log.find((e) => e[0].endsWith('RampToValueAtTime') && e[1] === 'gain');
    expect(ramp).toBeDefined();
    const stop = ctx.log.find((e) => e[0] === 'stop');
    expect(stop[1]).toBeCloseTo(0.16, 2);
  });
});

describe('the parity requirement (SPEC.md §4.3)', () => {
  it('produces identical node graphs for repeated mismatches', () => {
    // Whatever the game state, a mismatch must sound the same every time. The
    // module has no way to know the difference, which is the point.
    const first = capture(contexts, () => audio.beepMismatch());
    const second = capture(contexts, () => audio.beepMismatch());
    expect(second).toEqual(first);
  });

  it('exposes no parameter through which rig state could reach a cue', () => {
    // Structural guard. It must be impossible to make the sounds differ, not
    // merely true that they currently do not.
    expect(audio.beepFlip.length).toBe(0);
    expect(audio.beepMatch.length).toBe(0);
    expect(audio.beepMismatch.length).toBe(0);
  });

  it('ignores any argument callers try to pass', () => {
    // Even if a future caller reaches for beepMismatch({ rigged: true }), the
    // graph must not change.
    const honest = capture(contexts, () => audio.beepMismatch());
    const rigged = capture(contexts, () => audio.beepMismatch({ rigged: true }));
    expect(rigged).toEqual(honest);
  });

  it('does not import game state', async () => {
    // Resolved from the project root, not from import.meta.url: under the jsdom
    // environment import.meta.url is the jsdom document URL, so `new URL(...)`
    // yields an http: URL that readFileSync rejects before any assertion runs.
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(resolve(process.cwd(), 'js/audio.js'), 'utf8');
    expect(source).not.toMatch(/from\s+['"]\.\/game\.js['"]/);
    expect(source).not.toMatch(/\brigged\b/);
    expect(source).not.toMatch(/\brigLevel\b/);
  });
});

describe('mute', () => {
  it('silences all three cues', () => {
    // No oscillators at all, not merely zero gain. A zero-gain node would still
    // build a graph and show up asymmetrically in the parity comparison.
    audio.setMuted(true);
    audio.beepFlip();
    audio.beepMatch();
    audio.beepMismatch();
    for (const ctx of contexts) {
      expect(ctx.oscillators).toHaveLength(0);
    }
  });

  it('persists to fm.state', () => {
    audio.setMuted(true);
    expect(JSON.parse(localStorage.getItem('fm.state')).muted).toBe(true);
    audio.setMuted(false);
    expect(JSON.parse(localStorage.getItem('fm.state')).muted).toBe(false);
  });

  it('preserves sibling keys in fm.state', () => {
    // Task 21 stores rigLevel under the same key.
    localStorage.setItem('fm.state', JSON.stringify({ rigLevel: 3, muted: false }));
    audio.setMuted(true);
    expect(JSON.parse(localStorage.getItem('fm.state'))).toEqual({ rigLevel: 3, muted: true });
  });

  it('reads stored mute state on init', async () => {
    localStorage.setItem('fm.state', JSON.stringify({ muted: true }));
    vi.resetModules();
    contexts = installAudioMock();
    const fresh = await import('../../js/audio.js');
    expect(fresh.isMuted()).toBe(true);
    fresh.beepMatch();
    expect(contexts).toHaveLength(0);
  });

  it('toggleMute flips and reports the new state', () => {
    expect(audio.isMuted()).toBe(false);
    expect(audio.toggleMute()).toBe(true);
    expect(audio.isMuted()).toBe(true);
    expect(audio.toggleMute()).toBe(false);
  });

  it('survives storage being unavailable', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(() => audio.setMuted(true)).not.toThrow();
    expect(audio.isMuted()).toBe(true);
    Storage.prototype.setItem = original;
  });
});
