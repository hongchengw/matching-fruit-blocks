import { describe, it, expect, beforeEach } from 'vitest';
import { SPRITES, SPRITE_SIZE, drawSprite, registerSprite } from '../../js/sprites.js';
import { PALETTE } from '../../js/palette.js';

// A throwaway fixture, not a real fruit. Task 03 must be testable before any
// of tasks 04-10 exist, so nothing here depends on the SPRITES registry having
// real content.
const FIXTURE = [
  'RRRR............',
  '.G..............',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..............KK',
];
const FIXTURE_OPAQUE = 7; // 4 R + 1 G + 2 K

/** Records every context call so assertions can inspect the draw sequence. */
function mockCanvas() {
  const calls = [];
  let fillStyle = null;
  const ctx = {
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(v) {
      fillStyle = v;
    },
    clearRect: (...args) => calls.push({ op: 'clearRect', args }),
    fillRect: (...args) => calls.push({ op: 'fillRect', args, fillStyle }),
  };
  return {
    width: 0,
    height: 0,
    style: {},
    getContext: () => ctx,
    calls,
  };
}

describe('sprite renderer', () => {
  beforeEach(() => {
    registerSprite('__fixture__', FIXTURE);
  });

  it('exports drawSprite and a SPRITES registry', () => {
    expect(drawSprite).toBeTypeOf('function');
    expect(SPRITES).toBeTypeOf('object');
    expect(SPRITE_SIZE).toBe(16);
  });

  it('sets canvas to 16x16 internal resolution', () => {
    const canvas = mockCanvas();
    canvas.width = 512; // pretend it was sized for display
    drawSprite(canvas, '__fixture__');
    expect(canvas.width).toBe(16);
    expect(canvas.height).toBe(16);
  });

  it('clears before drawing', () => {
    // Without this, a rigged swap (task 18) would paint the new fruit over the
    // old one and leave artifacts.
    const canvas = mockCanvas();
    drawSprite(canvas, '__fixture__');
    const firstFill = canvas.calls.findIndex((c) => c.op === 'fillRect');
    const clear = canvas.calls.findIndex((c) => c.op === 'clearRect');
    expect(clear).toBeGreaterThanOrEqual(0);
    expect(clear).toBeLessThan(firstFill);
    expect(canvas.calls[clear].args).toEqual([0, 0, 16, 16]);
  });

  it('fills one 1x1 rect per opaque pixel', () => {
    const canvas = mockCanvas();
    drawSprite(canvas, '__fixture__');
    const fills = canvas.calls.filter((c) => c.op === 'fillRect');
    expect(fills).toHaveLength(FIXTURE_OPAQUE);
    for (const fill of fills) {
      expect(fill.args[2]).toBe(1);
      expect(fill.args[3]).toBe(1);
    }
  });

  it('skips transparent pixels', () => {
    const canvas = mockCanvas();
    drawSprite(canvas, '__fixture__');
    const painted = new Set(
      canvas.calls.filter((c) => c.op === 'fillRect').map((c) => `${c.args[0]},${c.args[1]}`),
    );
    for (let y = 0; y < 16; y += 1) {
      for (let x = 0; x < 16; x += 1) {
        if (FIXTURE[y][x] === '.') {
          expect(painted.has(`${x},${y}`), `painted transparent pixel ${x},${y}`).toBe(false);
        }
      }
    }
  });

  it('maps chars to palette colors', () => {
    const canvas = mockCanvas();
    drawSprite(canvas, '__fixture__');
    const fills = canvas.calls.filter((c) => c.op === 'fillRect');
    const at = (x, y) => fills.find((f) => f.args[0] === x && f.args[1] === y);
    expect(at(0, 0).fillStyle).toBe(PALETTE.R);
    expect(at(1, 1).fillStyle).toBe(PALETTE.G);
    expect(at(15, 15).fillStyle).toBe(PALETTE.K);
  });

  it('throws on an unknown sprite name', () => {
    // A silent no-op would show a blank card, which reads as a rendering bug
    // during the rigged phase.
    expect(() => drawSprite(mockCanvas(), 'nope')).toThrow(/nope/);
  });

  it('throws on a char missing from the palette', () => {
    const bad = [...FIXTURE];
    bad[0] = 'Z'.padEnd(16, '.');
    registerSprite('__bad_char__', bad);
    expect(() => drawSprite(mockCanvas(), '__bad_char__')).toThrow(/Z/);
  });

  it('rejects a sprite that is not 16 rows', () => {
    expect(() => registerSprite('__short__', FIXTURE.slice(0, 15))).toThrow(/16/);
  });

  it('rejects a row that is not 16 chars', () => {
    const bad = [...FIXTURE];
    bad[3] = '.....';
    expect(() => registerSprite('__narrow__', bad)).toThrow(/16/);
  });

  it('names the sprite in shape errors', () => {
    expect(() => registerSprite('__named__', ['.'])).toThrow(/__named__/);
  });

  it('sets pixelated rendering on the canvas', () => {
    const canvas = mockCanvas();
    drawSprite(canvas, '__fixture__');
    expect(canvas.style.imageRendering).toBe('pixelated');
  });
});
