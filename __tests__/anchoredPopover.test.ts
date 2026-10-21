import { placePanel } from '../components/shared/AnchoredPopover';

/**
 * Where a desktop dropdown opens (feedback 2026-10-21): under its field when it fits, above it
 * when it doesn't and there is more room there, never outside the window.
 */
const win = { winW: 1440, winH: 900 };
const field = { x: 500, y: 200, width: 600, height: 44 };

describe('placePanel', () => {
  it('opens under the field, as wide as it', () => {
    const p = placePanel({
      rect: field,
      ...win,
      minWidth: 200,
      maxHeight: 320,
      contentHeight: 150,
    });
    expect(p).toMatchObject({ left: 500, width: 600, height: 150, top: 248 });
    expect(p.bottom).toBeUndefined();
  });

  it('opens above a field low on the page when the content does not fit below', () => {
    const low = { ...field, y: 620 };
    // A calendar (360px) has 228px below and 608px above.
    const p = placePanel({ rect: low, ...win, minWidth: 200, maxHeight: 480, contentHeight: 360 });
    expect(p.top).toBeUndefined();
    expect(p.bottom).toBe(900 - 620 + 4);
    expect(p.height).toBe(360);
  });

  it('stays below when the content fits there, however low the field', () => {
    const low = { ...field, y: 620 };
    const p = placePanel({ rect: low, ...win, minWidth: 200, maxHeight: 320, contentHeight: 120 });
    expect(p.top).toBe(668);
  });

  it('caps the width and lines up with the end of a wide row', () => {
    const row = { x: 233, y: 300, width: 1175, height: 80 };
    const p = placePanel({
      rect: row,
      ...win,
      minWidth: 200,
      maxWidth: 360,
      align: 'end',
      maxHeight: 320,
      contentHeight: 128,
    });
    expect(p.width).toBe(360);
    expect(p.left).toBe(233 + 1175 - 360);
  });

  it('keeps the panel inside the window', () => {
    const edge = { x: 1400, y: 200, width: 30, height: 30 };
    const p = placePanel({ rect: edge, ...win, minWidth: 320, maxHeight: 320, contentHeight: 100 });
    expect(p.left + p.width).toBeLessThanOrEqual(1440 - 8);
  });
});
