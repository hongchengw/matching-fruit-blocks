import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// SPEC.md §4.3, §4.4 and §11. A quiet outdoor bed under the game that is
// structurally incapable of reacting to anything that happens in it.

const SOURCE = readFileSync(resolve(process.cwd(), 'js/ambience.js'), 'utf8');

const { startAmbience, stopAmbience, isAmbienceRunning } = await import('../../js/ambience.js');
const { setMuted } = await import('../../js/audio.js');

class FakeParam {
  constructor() {
    this.calls = [];
  }
  setValueAtTime(v, t) {
    this.calls.push(['set', v, t]);
  }
  linearRampToValueAtTime(v, t) {
    this.calls.push(['ramp', v, t]);
  }
}

function fakeContext() {
  const created = { oscillators: 0, gains: 0, buffers: 0, sources: 0, filters: 0 };
  return {
    created,
    currentTime: 0,
    destination: {},
    sampleRate: 44100,
    state: 'running',
    createOscillator() {
      created.oscillators += 1;
      return {
        type: 'sine',
        frequency: new FakeParam(),
        connect() {},
        start() {},
        stop() {},
      };
    },
    createGain() {
      created.gains += 1;
      return { gain: new FakeParam(), connect() {}, disconnect() {} };
    },
    createBuffer(channels, length) {
      created.buffers += 1;
      return { length, getChannelData: () => new Float32Array(length) };
    },
    createBufferSource() {
      created.sources += 1;
      return { buffer: null, loop: false, connect() {}, start() {}, stop() {}, disconnect() {} };
    },
    createBiquadFilter() {
      created.filters += 1;
      return {
        type: 'lowpass',
        frequency: new FakeParam(),
        Q: new FakeParam(),
        connect() {},
        disconnect() {},
      };
    },
  };
}

beforeEach(() => {
  stopAmbience();
  localStorage.clear();
  setMuted(false);
  vi.restoreAllMocks();
});

describe('structural isolation', () => {
  it('imports no game state', () => {
    // The same guard task 14 put on js/audio.js, for the same reason: if game
    // state cannot reach this file, the bed cannot vary with it.
    const tokens = ['rig', 'match', 'card', 'fruit', 'reshuffle', 'from \'./game.js\''];
    for (const token of tokens) {
      expect(SOURCE.toLowerCase(), `ambience mentions "${token}"`).not.toContain(token);
    }
  });

  it('imports nothing but the mute setting', () => {
    const imports = [...SOURCE.matchAll(/^import .*?from '(.*?)';/gm)].map((m) => m[1]);
    for (const source of imports) {
      expect(['./audio.js']).toContain(source);
    }
  });

  it('takes no arguments', () => {
    expect(startAmbience.length).toBe(0);
    expect(stopAmbience.length).toBe(0);
    expect(isAmbienceRunning.length).toBe(0);
  });
});

describe('behaviour', () => {
  it('creates no context before it is started', () => {
    // SPEC.md §4.2. Autoplay policy blocks it, and a console warning on load is
    // its own small tell.
    const ctor = vi.fn();
    globalThis.AudioContext = ctor;
    expect(isAmbienceRunning()).toBe(false);
    expect(ctor).not.toHaveBeenCalled();
  });

  it('builds a bed when started', () => {
    const ctx = fakeContext();
    globalThis.AudioContext = vi.fn(() => ctx);
    startAmbience();
    expect(isAmbienceRunning()).toBe(true);
    expect(ctx.created.gains).toBeGreaterThan(0);
  });

  it('is silent when muted', () => {
    // Through the real setter, which is the one control §4.4 specifies. Writing
    // storage directly would not reach the cue engine's in-memory state, so it
    // would test the fixture rather than the behaviour.
    setMuted(true);
    const ctx = fakeContext();
    const ctor = vi.fn(() => ctx);
    globalThis.AudioContext = ctor;
    startAmbience();
    expect(ctor).not.toHaveBeenCalled();
    expect(isAmbienceRunning()).toBe(false);
  });

  it('starting twice does not build a second bed', () => {
    // A bed that accumulated sources would eventually distort the cue timing,
    // and timing is a channel too.
    const ctx = fakeContext();
    globalThis.AudioContext = vi.fn(() => ctx);
    startAmbience();
    const after = { ...ctx.created };
    startAmbience();
    startAmbience();
    expect(ctx.created).toEqual(after);
  });

  it('stops cleanly', () => {
    const ctx = fakeContext();
    globalThis.AudioContext = vi.fn(() => ctx);
    startAmbience();
    stopAmbience();
    expect(isAmbienceRunning()).toBe(false);
  });

  it('degrades to nothing where WebAudio is absent', () => {
    delete globalThis.AudioContext;
    delete globalThis.webkitAudioContext;
    expect(() => startAmbience()).not.toThrow();
    expect(isAmbienceRunning()).toBe(false);
  });
});
