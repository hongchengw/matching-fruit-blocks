/**
 * The one palette every sprite draws from. See SPEC.md §3.1.
 *
 * Keys are single characters used in the 16x16 sprite grids. Uppercase is a
 * base tone, its lowercase twin is the lighter highlight. `.` is transparent
 * and is the only key whose value is not a color string.
 *
 * Earth tones only: warm, handmade, market stall. The chrome's warmth is doing
 * psychological work (SPEC.md §2.10), so no cold or neon accents belong here.
 */

/**
 * Transparent sentinel. Deliberately not a string, so a renderer that forgets
 * to check gets a loud failure rather than silently painting a color.
 */
export const TRANSPARENT = null;

export const PALETTE = Object.freeze({
  '.': TRANSPARENT,

  K: '#2b1d17', // outline, near-black warm brown
  W: '#f4ead8', // bone white: highlights, LCD digits

  R: '#b03028', // deep red: apple and tomato body
  r: '#d95c4a', // light red highlight

  O: '#c66518', // pumpkin orange, carrot body
  o: '#e8913a', // light orange highlight

  Y: '#d9a520', // corn yellow, banana body
  y: '#f2d066', // pale yellow highlight

  G: '#4a7028', // leaf green
  g: '#7a9c3c', // light green highlight

  B: '#6b4526', // bark brown: stems, crate slats
  b: '#9c6b3f', // light wood brown
});

/** True for the transparent sentinel. The renderer skips these pixels. */
export function isTransparent(value) {
  return value === TRANSPARENT;
}

/**
 * Resolve a sprite character to a color.
 * Throws on an unmapped character rather than painting black, so a typo in a
 * sprite grid surfaces at draw time with the offending character named.
 */
export function colorFor(char) {
  if (!(char in PALETTE)) {
    throw new Error(`palette: unknown character ${JSON.stringify(char)}`);
  }
  return PALETTE[char];
}
