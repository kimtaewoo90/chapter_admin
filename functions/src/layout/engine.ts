import {
  DiaryEntry,
  LayoutPlan,
  LayoutType,
  LAYOUT_THRESHOLDS,
  PhotoSlot,
  TextStyle,
} from './types';

/**
 * Layout Engine
 *
 * 콘텐츠 특성(사진 수, 글 길이)에 따라 PDF 페이지 레이아웃을 결정합니다.
 *
 * 예시:
 * - 사진 1장 + 글 500자 → single-photo-vertical
 * - 사진 4장 + 글 100자 → photo-grid (2×2)
 */
export function decideLayout(entry: DiaryEntry): LayoutPlan {
  const photoCount = entry.photoUrls.length;
  const textLength = entry.body.trim().length;

  const type = pickLayoutType(photoCount, textLength);
  const textStyle = pickTextStyle(type, textLength);
  const { gridColumns, gridRows, photoSlots } = buildPhotoSlots(type, photoCount);

  return {
    type,
    photoSlots,
    textStyle,
    gridColumns,
    gridRows,
  };
}

function pickLayoutType(photoCount: number, textLength: number): LayoutType {
  if (photoCount === 0) {
    return 'text-only';
  }

  if (
    photoCount >= LAYOUT_THRESHOLDS.gridPhotoMin &&
    textLength < LAYOUT_THRESHOLDS.shortText
  ) {
    return 'photo-grid';
  }

  if (photoCount === 1) {
    return 'single-photo-vertical';
  }

  if (photoCount === 2 && textLength < LAYOUT_THRESHOLDS.shortText) {
    return 'dual-photo';
  }

  if (photoCount >= LAYOUT_THRESHOLDS.gridPhotoMin) {
    return 'photo-grid';
  }

  // 사진 2장 + 긴 글, 또는 중간 케이스 → 세로 스택
  return 'single-photo-vertical';
}

function pickTextStyle(type: LayoutType, textLength: number): TextStyle {
  if (type === 'photo-grid' || type === 'dual-photo') {
    return 'caption';
  }
  if (textLength >= LAYOUT_THRESHOLDS.longText) {
    return 'full';
  }
  if (textLength < LAYOUT_THRESHOLDS.shortText) {
    return 'short';
  }
  return 'full';
}

function buildPhotoSlots(
  type: LayoutType,
  photoCount: number,
): { gridColumns: number; gridRows: number; photoSlots: PhotoSlot[] } {
  switch (type) {
    case 'text-only':
      return { gridColumns: 0, gridRows: 0, photoSlots: [] };

    case 'single-photo-vertical':
      return {
        gridColumns: 1,
        gridRows: 1,
        photoSlots: [{ index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 1 }],
      };

    case 'dual-photo':
      return {
        gridColumns: 2,
        gridRows: 1,
        photoSlots: [
          { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 1 },
          { index: 1, row: 0, col: 1, rowSpan: 1, colSpan: 1 },
        ],
      };

    case 'photo-grid':
      return buildGridSlots(photoCount);

    default:
      return { gridColumns: 1, gridRows: 1, photoSlots: [] };
  }
}

/** 2열 그리드 — 4장이면 2×2, 3장이면 2+1 */
function buildGridSlots(photoCount: number): {
  gridColumns: number;
  gridRows: number;
  photoSlots: PhotoSlot[];
} {
  const gridColumns = 2;
  const gridRows = Math.ceil(photoCount / gridColumns);
  const photoSlots: PhotoSlot[] = [];

  for (let i = 0; i < photoCount; i++) {
    const row = Math.floor(i / gridColumns);
    const col = i % gridColumns;
    const isLastOdd =
      photoCount % 2 === 1 && i === photoCount - 1 && photoCount > 1;

    photoSlots.push({
      index: i,
      row,
      col,
      rowSpan: 1,
      colSpan: isLastOdd ? 2 : 1,
    });
  }

  return { gridColumns, gridRows, photoSlots };
}

/** Firestore 스냅샷 raw → DiaryEntry */
export function parseDiaryEntry(raw: Record<string, unknown>): DiaryEntry {
  const body = String(raw.body ?? raw.text ?? raw.content ?? '').trim();
  const title = String(raw.title ?? raw.headline ?? '').trim();
  const date = String(raw.date ?? raw.entryDate ?? raw.month ?? '').trim();

  return {
    date,
    title: title || date,
    body,
    photoUrls: extractPhotoUrls(raw),
  };
}

function extractPhotoUrls(raw: Record<string, unknown>): string[] {
  const listCandidates = [raw.photos, raw.photoUrls, raw.images, raw.imageUrls];

  for (const candidate of listCandidates) {
    if (Array.isArray(candidate)) {
      return candidate.map(String).filter((url) => url.length > 0);
    }
  }

  const single = raw.photoUrl ?? raw.imageUrl;
  if (typeof single === 'string' && single.length > 0) {
    return [single];
  }

  return [];
}

export function parseSnapshotEntries(
  snapshot: Record<string, unknown> | undefined,
): DiaryEntry[] {
  if (!snapshot) return [];

  const entries = snapshot.entries;
  if (!Array.isArray(entries)) return [];

  return entries
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => parseDiaryEntry(item));
}

/** 주문 문서에서 일기 목록 추출 (snapshot.entries / snapshots[] 모두 지원) */
export function parseOrderEntries(
  order: Record<string, unknown>,
): DiaryEntry[] {
  const fromNested = parseSnapshotEntries(
    order.snapshot as Record<string, unknown> | undefined,
  );
  if (fromNested.length > 0) return fromNested;

  const snapshots = order.snapshots;
  if (Array.isArray(snapshots)) {
    return snapshots
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => parseDiaryEntry(item));
  }

  return [];
}
