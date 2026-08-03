/**
 * 8-bit cue engine. See SPEC.md §4.
 *
 * Three cues, synthesized with WebAudio. No audio assets, no network requests.
 *
 * ---------------------------------------------------------------------------
 * This module deliberately knows nothing about the game.
 *
 * Audio is one of the four channels through which a player could detect that
 * the game has turned against them (SPEC.md §10.3). A mismatch that sounded
 * even slightly different once the rig arms would eventually be heard.
 *
 * So rather than being careful to keep the sounds the same, this module is
 * built so they cannot diverge: it imports no game state, the cues take no
 * arguments, and there is no branch anywhere below on anything but mute. If
 * rig state cannot reach this file, the cues cannot vary with it.
 *
 * Do not add a parameter to any cue. Do not import from game.js.
 * ---------------------------------------------------------------------------
 */

const STORAGE_KEY = 'fm.state';

const FLIP_HZ = 440;
const FLIP_SECONDS = 0.04;
const MATCH_LOW_HZ = 660;
const MATCH_HIGH_HZ = 880;
const MATCH_NOTE_SECONDS = 0.07;
const MISMATCH_HZ = 180;
const MISMATCH_SECONDS = 0.16;

const CLICK_GAIN = 0.06;
const CUE_GAIN = 0.12;

/** Lazily created on first cue. Never at module load: browsers block that. */
let context = null;
let muted = readMuted();

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    // Private browsing can throw on access. Degrade to in-memory.
    return {};
  }
}

function readMuted() {
  return readStored().muted === true;
}

/** Read-modify-write, so sibling settings under the same key survive. */
function writeMuted(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readStored(), muted: value }));
  } catch {
    // Storage unavailable. The setting still applies for this session.
  }
}

function audioContext() {
  if (!context) {
    const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }
  return context;
}

/**
 * Schedule one square-wave tone.
 * The only sound primitive in the module, so every cue is built the same way.
 */
function tone(ctx, hz, startOffset, seconds, peak) {
  const at = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(hz, at);

  gain.gain.setValueAtTime(peak, at);
  gain.gain.linearRampToValueAtTime(0, at + seconds);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + seconds);
}

/** Short click on any card reveal. */
export function beepFlip() {
  if (muted) return;
  const ctx = audioContext();
  if (!ctx) return;
  tone(ctx, FLIP_HZ, 0, FLIP_SECONDS, CLICK_GAIN);
}

/** Rising two-note arpeggio. The rise is what reads as success. */
export function beepMatch() {
  if (muted) return;
  const ctx = audioContext();
  if (!ctx) return;
  tone(ctx, MATCH_LOW_HZ, 0, MATCH_NOTE_SECONDS, CUE_GAIN);
  tone(ctx, MATCH_HIGH_HZ, MATCH_NOTE_SECONDS, MATCH_NOTE_SECONDS, CUE_GAIN);
}

/**
 * Low buzz with a short decay.
 *
 * Plays for every failed attempt without exception. There is no second variant
 * and there must never be one.
 */
export function beepMismatch() {
  if (muted) return;
  const ctx = audioContext();
  if (!ctx) return;
  tone(ctx, MISMATCH_HZ, 0, MISMATCH_SECONDS, CUE_GAIN);
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = Boolean(value);
  writeMuted(muted);
  return muted;
}

export function toggleMute() {
  return setMuted(!muted);
}
