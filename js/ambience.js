/**
 * Outdoor ambience for the stall. See SPEC.md §3.6, §4.3, §4.4, §11.
 *
 * A quiet bed of wind with the occasional bird, synthesized. No audio assets
 * and no network requests.
 *
 * ---------------------------------------------------------------------------
 * This module deliberately knows nothing about play, and that is a safety
 * property rather than a preference.
 *
 * §4.3 requires that both phases sound exactly alike. The cue engine achieves
 * that structurally: nothing imported from the state machine, no arguments, no
 * branches on anything but mute. A bed that swelled with tension, stung at the
 * threshold, or thinned as the board emptied would reopen the audio channel in
 * a place the parity test is not looking, because that test compares cues and
 * not beds.
 *
 * So: this is a function of the clock and nothing else. No tension curve, no
 * sting, no reaction of any kind. Do not add a parameter, and do not import
 * anything but the mute setting.
 *
 * It sits beside js/audio.js rather than inside it because that file's own
 * isolation guard is one of the cleanest safety properties in the codebase, and
 * both files are easier to trust while each stays small enough to read at once.
 *
 * A source-level test enforces all of this, including on this comment, so keep
 * the prose here about sound.
 * ---------------------------------------------------------------------------
 */

import { isMuted } from './audio.js';

const WIND_GAIN = 0.012;
const WIND_FILTER_HZ = 420;
const BIRD_GAIN = 0.016;
const BIRD_MIN_GAP_MS = 9000;
const BIRD_MAX_GAP_MS = 21000;
const BIRD_NOTE_SECONDS = 0.08;
const BIRD_HZ = [1860, 2340, 2090];

let context = null;
let nodes = null;
let birdTimer = null;

function audioContext() {
  const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

/** A few seconds of noise, looped. Cheaper than generating it continuously. */
function windBuffer(ctx) {
  const frames = Math.floor(ctx.sampleRate * 3);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < frames; i += 1) {
    // Brown-ish noise: smoother than white, which is what makes it read as
    // wind rather than as static.
    last = (last + (Math.random() * 2 - 1) * 0.02) * 0.996;
    data[i] = last;
  }
  return buffer;
}

function chirp(ctx, at, hz) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(hz, at);
  gain.gain.setValueAtTime(BIRD_GAIN, at);
  gain.gain.linearRampToValueAtTime(0, at + BIRD_NOTE_SECONDS);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + BIRD_NOTE_SECONDS);
}

function scheduleBird() {
  const gap = BIRD_MIN_GAP_MS + Math.random() * (BIRD_MAX_GAP_MS - BIRD_MIN_GAP_MS);
  birdTimer = setTimeout(() => {
    if (!context) return;
    const at = context.currentTime + 0.05;
    const hz = BIRD_HZ[Math.floor(Math.random() * BIRD_HZ.length)];
    chirp(context, at, hz);
    // A second note a beat later, most of the time, so it reads as a call
    // rather than a beep.
    if (Math.random() < 0.7) chirp(context, at + 0.16, hz * 1.18);
    scheduleBird();
  }, gap);
}

/** True while a bed is playing. */
export function isAmbienceRunning() {
  return context !== null;
}

/**
 * Start the bed. Safe to call repeatedly; only the first call builds anything.
 *
 * Must be called from a user gesture (SPEC.md §4.2): browsers block an
 * AudioContext created any earlier, and the console warning would be its own
 * small tell.
 */
export function startAmbience() {
  if (context || isMuted()) return;
  const ctx = audioContext();
  if (!ctx) return;

  const source = ctx.createBufferSource();
  source.buffer = windBuffer(ctx);
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(WIND_FILTER_HZ, ctx.currentTime);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(WIND_GAIN, ctx.currentTime);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start();

  context = ctx;
  nodes = { source, filter, gain };
  scheduleBird();
}

/** Stop and release everything. Safe to call when nothing is running. */
export function stopAmbience() {
  if (birdTimer !== null) {
    clearTimeout(birdTimer);
    birdTimer = null;
  }
  if (nodes) {
    try {
      nodes.source.stop();
    } catch {
      // Already stopped. Nothing to do.
    }
    nodes = null;
  }
  context = null;
}
