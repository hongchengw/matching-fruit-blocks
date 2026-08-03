/**
 * Sprite registry and renderer. See SPEC.md §3.2.
 *
 * Every sprite is 16 strings of 16 characters, each character a key into the
 * palette. Sprites are drawn at their native 16x16 resolution and scaled up by
 * CSS, so the internal resolution never changes with display size.
 *
 * The renderer is pure with respect to game state. It takes a canvas and a
 * name and paints. It knows nothing about cards, matches, or the rig.
 */
import { colorFor, isTransparent } from './palette.js';

export const SPRITE_SIZE = 16;

/**
 * The six produce items (SPEC.md §2.1), in one place.
 *
 * The deck imports this rather than restating it. A typo across two lists would
 * show a blank card, and only ever in the rigged phase, which is the hardest
 * place in the app to notice anything.
 */
export const FRUITS = Object.freeze(['apple', 'banana', 'carrot', 'corn', 'tomato', 'pumpkin']);

/** The shared face-down art. Not a fruit, so it is kept out of FRUITS. */
export const CARD_BACK = 'back';

/** name -> 16x16 character grid. Populated by tasks 04 through 10. */
export const SPRITES = {};

/**
 * Validate a sprite grid and add it to the registry.
 * Shape errors throw here, at registration, rather than at draw time.
 */
export function registerSprite(name, grid) {
  if (!Array.isArray(grid) || grid.length !== SPRITE_SIZE) {
    throw new Error(
      `sprite ${name}: expected ${SPRITE_SIZE} rows, got ${Array.isArray(grid) ? grid.length : typeof grid}`,
    );
  }
  grid.forEach((row, y) => {
    if (typeof row !== 'string' || row.length !== SPRITE_SIZE) {
      throw new Error(
        `sprite ${name}: row ${y} must be ${SPRITE_SIZE} characters, got ${row?.length}`,
      );
    }
  });
  SPRITES[name] = grid;
  return grid;
}

/**
 * Paint a registered sprite onto a canvas at native resolution.
 *
 * Draws exactly once. Task 18 depends on this: drawing the true fruit and then
 * replacing it would render a visible pre-swap frame.
 */
export function drawSprite(canvas, name) {
  const grid = SPRITES[name];
  if (!grid) {
    throw new Error(`sprite ${name}: not registered`);
  }

  // Assigning width or height also clears the canvas, but clear explicitly so
  // the intent survives any future change to how sizing works.
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  canvas.style.imageRendering = 'pixelated';

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  for (let y = 0; y < SPRITE_SIZE; y += 1) {
    for (let x = 0; x < SPRITE_SIZE; x += 1) {
      const char = grid[y][x];
      let color;
      try {
        color = colorFor(char);
      } catch (cause) {
        throw new Error(`sprite ${name} at ${x},${y}: ${cause.message}`, { cause });
      }
      if (isTransparent(color)) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Produce
//
// Every fruit carries a closed K outline and a 1px transparent margin. The
// silhouette has to do the identifying work: cards render around 44px on the
// smallest supported viewport, where shading is barely legible but outline
// still reads (SPEC.md §3.2).
// ---------------------------------------------------------------------------

// Round body with a stem and a single leaf swept to the right. That asymmetric
// stem-and-leaf is the apple's signature and task 08's tomato must not reuse it.
registerSprite('apple', [
  '................',
  '................',
  '..........KKK...',
  '.......KKKGGGK..',
  '.......KK.KGK...',
  '....KKKKKKKK....',
  '...KrrRRRRRRK...',
  '..KrrRRRRRRRRK..',
  '..KrRRRRRRRRRK..',
  '..KRRRRRRRRRRK..',
  '..KRRRRRRRRRRK..',
  '...KRRRRRRRRK...',
  '...KRRRRRRRRK...',
  '....KRRRRRRK....',
  '.....KKKKKK.....',
  '................',
]);

// A pronounced diagonal crescent, the strongest silhouette in the set and the
// reference the other five are measured against. Keep the curve: a nearly
// straight banana reads as a carrot at 44px. Highlight runs along the upper
// left, matching the light-from-top-left convention the bevels use.
registerSprite('banana', [
  '................',
  '................',
  '.........KKK....',
  '........KBBBK...',
  '.......KyYYYK...',
  '......KyYYYK....',
  '.....KyYYYK.....',
  '....KyYYYK......',
  '...KyYYYK.......',
  '..KyYYYK........',
  '..KyYYK.........',
  '..KyYYK.........',
  '...KKyYK........',
  '.....KKKK.......',
  '................',
  '................',
]);

// Narrow vertical taper: widest under the frond, near a point at the bottom.
// That taper is the signature. Corn (task 07) is its inverse, narrow on top and
// flared at the base, which is what keeps the two apart at 44px.
registerSprite('carrot', [
  '................',
  '......KKKK......',
  '.....KGGGGK.....',
  '.....KGGGGK.....',
  '......KoOK......',
  '......KoOK......',
  '......KoOK......',
  '......KoOK......',
  '.......KOK......',
  '.......KOK......',
  '.......KOK......',
  '.......KK.......',
  '.......KK.......',
  '.......KK.......',
  '.......KK.......',
  '................',
]);

// Upright cob with husk leaves flaring down and out at the base. The flare is
// the inverse of the carrot's taper, which is what separates them at 44px
// despite both being tall and centered. Kernels stay at 1px granularity: larger
// blocks turn to mud when downscaled and the cob loses its texture read.
registerSprite('corn', [
  '................',
  '................',
  '......KKKK......',
  '.....KYyYyK.....',
  '.....KyYyYK.....',
  '.....KYyYyK.....',
  '.....KyYyYK.....',
  '.....KYyYyK.....',
  '.....KyYyYK.....',
  '.....KYyYyK.....',
  '....KGyYyYGK....',
  '...KGGYyYyGGK...',
  '..KGGGyYyYGGGK..',
  '.KKKKKKKKKKKKKK.',
  '................',
  '................',
]);

// Compact and squat, with a five-point calyx sitting flat across the top.
//
// The riskiest pair in the set is apple/tomato: both are round and red, and the
// distinctness check discards color entirely. So the outline carries it. The
// tomato is smaller, wider than it is tall, and has a horizontal calyx spread
// rather than the apple's stem-and-single-leaf. A recolored apple fails the
// dedicated test in tests/e2e/sprite-distinctness.spec.js, which is how that
// test earns its place.
registerSprite('tomato', [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '......KKKK......',
  '....KKGGGGKK....',
  '...KrrRRRRRRK...',
  '...KrRRRRRRRK...',
  '...KRRRRRRRRK...',
  '....KKRRRRKK....',
  '......KKKK......',
  '................',
  '................',
  '................',
]);

// The widest sprite in the set: broader than it is tall, with vertical rib
// highlights and a short thick stem.
//
// Width and the stubby stem carry the silhouette. The ribs are interior detail
// and contribute nothing to the alpha mask. Sitting high in the frame with a
// flat wide shoulder is what separates it from the apple, which is the closest
// remaining pair at 21.9 percent.
registerSprite('pumpkin', [
  '................',
  '.......KKK......',
  '.......KBK......',
  '.......KBK......',
  '..KKKKKoOOKKKK..',
  '.KOoOOOoOOOoOOK.',
  '.KOoOOOoOOOoOOK.',
  '.KOoOOOoOOOoOOK.',
  '.KOoOOOoOOOoOOK.',
  '.KOoOOOoOOOoOOK.',
  '.KOoOOOoOOOoOOK.',
  '..KKOOOoOOOoKK..',
  '....KKKKKKKK....',
  '................',
  '................',
  '................',
]);

// ---------------------------------------------------------------------------
// Card back
//
// Full-bleed crate slats with a small centered leaf. Every pixel is opaque, so
// the outline and margin rules that govern the fruits do not apply here; the
// shape suite exempts it explicitly rather than loosening those checks.
//
// Deliberately low contrast and uniform. This is the sprite the player stares
// at most, and its job is to be unmemorable: a distinctive back would let them
// fingerprint card positions and follow one through the silent reshuffle
// (SPEC.md §7.3), which would reopen the tally detection channel.
//
// There is exactly one back, shared by all 36 cards. Never add variants.
// ---------------------------------------------------------------------------
registerSprite('back', [
  'bbbbbbbbbbbbbbbb',
  'BBBBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBBBB',
  'bbbbbbbbbbbbbbbb',
  'BBBBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBBBB',
  'BBBBBBBBGBBBBBBB',
  'BBBBBBBGGBBBBBBB',
  'bbbbbbbbbbbbbbbb',
  'BBBBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBBBB',
  'bbbbbbbbbbbbbbbb',
  'BBBBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBBBB',
]);
