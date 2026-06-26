/** 스티커 사진 콜라주 — 원본 비율 유지, 균일 스케일만 허용 */

import { PHOTO_FRAME } from '../pdf/photoStyle';

export interface ImageMeta {
  width: number;
  height: number;
}

export interface StickerItem {
  index: number;
  meta: ImageMeta;
}

export interface StickerPlacement {
  index: number;
  row: number;
  x: number;
  y: number;
  photoW: number;
  photoH: number;
  frameW: number;
  frameH: number;
}

export interface StickerCollage {
  placements: StickerPlacement[];
  totalHeight: number;
}

/** 사진 수에 따른 행 패턴 (2+1, 2×2 등) */
function rowPattern(count: number): number[][] {
  if (count <= 0) return [];
  if (count === 1) return [[0]];
  if (count === 2) return [[0, 1]];
  if (count === 3) return [[0, 1], [2]];
  if (count === 4) return [[0, 1], [2, 3]];
  if (count === 5) return [[0, 1, 2], [3, 4]];
  if (count === 6) return [[0, 1, 2], [3, 4, 5]];

  const rows: number[][] = [];
  for (let i = 0; i < count; i += 3) {
    rows.push(Array.from({ length: Math.min(3, count - i) }, (_, j) => i + j));
  }
  return rows;
}

/** 균일 스케일 — 가로·세로 비율 절대 변경 없음 */
function scalePhoto(
  meta: ImageMeta,
  maxPhotoW: number,
  maxPhotoH: number,
  maxLong: number,
): { photoW: number; photoH: number } {
  const scale = Math.min(
    maxPhotoW / meta.width,
    maxPhotoH / meta.height,
    maxLong / Math.max(meta.width, meta.height),
  );
  return {
    photoW: meta.width * scale,
    photoH: meta.height * scale,
  };
}

function frameSize(photoW: number, photoH: number): { frameW: number; frameH: number } {
  return { frameW: photoW, frameH: photoH };
}

interface RowItem {
  index: number;
  photoW: number;
  photoH: number;
  frameW: number;
  frameH: number;
}

function fitRowItems(
  items: RowItem[],
  usableWidth: number,
): RowItem[] {
  const gap = PHOTO_FRAME.gap;
  const total =
    items.reduce((sum, item) => sum + item.frameW, 0) + gap * (items.length - 1);

  if (total <= usableWidth) return items;

  const factor = usableWidth / total;
  return items.map((item) => {
    const photoW = item.photoW * factor;
    const photoH = item.photoH * factor;
    const { frameW, frameH } = frameSize(photoW, photoH);
    return { ...item, photoW, photoH, frameW, frameH };
  });
}

/**
 * 스티커 격자 배치
 * - 원본 비율 유지 (늘리기/찌그러짐 없음)
 * - 행마다 가운데 정렬
 * - 3장이면 2+1, 4장이면 2×2
 */
export function layoutStickerCollage(
  items: StickerItem[],
  usableWidth: number,
  options: { maxLongEdge: number; maxPhotoH?: number } = {
    maxLongEdge: PHOTO_FRAME.maxLongMulti,
  },
): StickerCollage {
  if (items.length === 0) {
    return { placements: [], totalHeight: 0 };
  }

  const maxPhotoH = options.maxPhotoH ?? options.maxLongEdge * 1.4;
  const pattern = rowPattern(items.length);
  const placements: StickerPlacement[] = [];
  let cursorY = 0;

  for (let r = 0; r < pattern.length; r++) {
    const indices = pattern[r];
    const maxPhotoW =
      indices.length === 1
        ? usableWidth
        : (usableWidth - PHOTO_FRAME.gap * (indices.length - 1)) / indices.length;

    let rowItems: RowItem[] = indices.map((index) => {
      const item = items.find((i) => i.index === index)!;
      const { photoW, photoH } = scalePhoto(
        item.meta,
        Math.max(maxPhotoW, 40),
        maxPhotoH,
        options.maxLongEdge,
      );
      const { frameW, frameH } = frameSize(photoW, photoH);
      return { index, photoW, photoH, frameW, frameH };
    });

    rowItems = fitRowItems(rowItems, usableWidth);

    const rowWidth =
      rowItems.reduce((sum, item) => sum + item.frameW, 0) +
      PHOTO_FRAME.gap * (rowItems.length - 1);
    const rowHeight = Math.max(...rowItems.map((item) => item.frameH));
    let cursorX = (usableWidth - rowWidth) / 2;

    for (const item of rowItems) {
      placements.push({
        index: item.index,
        row: r,
        x: cursorX,
        y: cursorY,
        photoW: item.photoW,
        photoH: item.photoH,
        frameW: item.frameW,
        frameH: item.frameH,
      });
      cursorX += item.frameW + PHOTO_FRAME.gap;
    }

    cursorY += rowHeight;
    if (r < pattern.length - 1) cursorY += PHOTO_FRAME.rowGap;
  }

  return { placements, totalHeight: cursorY + PHOTO_FRAME.bottomGap };
}

/** 메타 없을 때(페이지 높이 추정) — 정사각형 가정 */
export function estimateCollageHeight(
  photoCount: number,
  usableWidth: number,
  maxLongEdge: number,
): number {
  if (photoCount === 0) return 0;

  const placeholders: StickerItem[] = Array.from({ length: photoCount }, (_, i) => ({
    index: i,
    // 흔한 휴대폰 가로 사진 비율 (추정용)
    meta: { width: 1600, height: 1200 },
  }));

  return layoutStickerCollage(placeholders, usableWidth, { maxLongEdge }).totalHeight;
}
