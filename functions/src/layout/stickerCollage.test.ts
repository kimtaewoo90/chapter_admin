import assert from 'node:assert/strict';
import { test } from 'node:test';

import { layoutStickerCollage } from './stickerCollage';

const W = 324;

test('스티커 2장 — 한 줄, 비율 유지', () => {
  const collage = layoutStickerCollage(
    [
      { index: 0, meta: { width: 3000, height: 2000 } },
      { index: 1, meta: { width: 2000, height: 3000 } },
    ],
    W,
    { maxLongEdge: 158 },
  );

  assert.equal(collage.placements.length, 2);
  for (const p of collage.placements) {
    const ratio = p.photoW / p.photoH;
    assert.ok(ratio > 0.5 && ratio < 2.5);
  }
});

test('스티커 3장 — 2+1 배치', () => {
  const collage = layoutStickerCollage(
    [
      { index: 0, meta: { width: 1000, height: 1000 } },
      { index: 1, meta: { width: 1000, height: 1500 } },
      { index: 2, meta: { width: 1600, height: 900 } },
    ],
    W,
    { maxLongEdge: 158 },
  );

  assert.equal(collage.placements.length, 3);
  const row1 = collage.placements.filter((p) => p.row === 0);
  const row2 = collage.placements.filter((p) => p.row === 1);
  assert.equal(row1.length, 2);
  assert.equal(row2.length, 1);
});

test('스티커 — 행 너비 초과 시 균일 축소 (비율 유지)', () => {
  const collage = layoutStickerCollage(
    [
      { index: 0, meta: { width: 4000, height: 3000 } },
      { index: 1, meta: { width: 4000, height: 3000 } },
    ],
    W,
    { maxLongEdge: 200 },
  );

  const totalW =
    collage.placements[0].frameW +
    collage.placements[1].frameW +
    14;
  assert.ok(totalW <= W + 1);
});
