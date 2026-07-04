import {
  BookPagePlan,
  DiaryEntry,
  EntryLayout,
  LayoutPlan,
  LayoutType,
  LAYOUT_THRESHOLDS,
  PageItem,
  PageMode,
  PhotoSlot,
  TextStyle,
} from './types';
import {
  estimateCollageHeight,
} from './stickerCollage';
import {
  PHOTO_FRAME,
} from '../pdf/photoStyle';

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
  const pageMode = decidePageMode(photoCount, textLength, type);

  return {
    type,
    photoSlots,
    textStyle,
    gridColumns,
    gridRows,
    pageMode,
  };
}

/** 사진 없고 글 짧으면 compact — 한 페이지에 여러 개 묶음 */
export function decidePageMode(
  photoCount: number,
  textLength: number,
  type: LayoutType = pickLayoutType(photoCount, textLength),
): PageMode {
  if (type !== 'text-only') return 'full';
  if (textLength >= LAYOUT_THRESHOLDS.longText) return 'full';
  if (textLength <= LAYOUT_THRESHOLDS.compactTextMax) return 'compact';
  return 'full';
}

/** PDF 페이지 단위 배치 — 빈 공간이 있으면 compact를 full 아래에 이어 붙임 */
export function planBookPages(entries: DiaryEntry[]): BookPagePlan[] {
  const pages: BookPagePlan[] = [];
  let currentItems: PageItem[] = [];
  let usedHeight = 0;

  const flush = () => {
    if (currentItems.length > 0) {
      pages.push({ items: currentItems });
      currentItems = [];
      usedHeight = 0;
    }
  };

  const tryAdd = (item: PageItem): boolean => {
    const height = estimateItemHeight(item);
    const gap = currentItems.length > 0 ? LAYOUT_THRESHOLDS.itemGap : 0;

    if (usedHeight + gap + height > LAYOUT_THRESHOLDS.pageContentHeight) {
      return false;
    }

    currentItems.push(item);
    usedHeight += gap + height;
    return true;
  };

  const forceAdd = (item: PageItem) => {
    const height = estimateItemHeight(item);
    currentItems.push(item);
    usedHeight = height;
  };

  for (const entry of entries) {
    const plan = decideLayout(entry);
    const layout: EntryLayout = { entry, plan };
    const item: PageItem =
      plan.pageMode === 'full'
        ? { kind: 'full', layout }
        : { kind: 'compact', layout };

    if (!tryAdd(item)) {
      flush();
      if (!tryAdd(item)) {
        // 긴 글 등 한 페이지를 넘기는 full 항목
        forceAdd(item);
        flush();
      }
    }
  }

  flush();
  return pages;
}

const CONTENT_WIDTH = 420 - 48 * 2;

function photoAreaHeight(plan: LayoutPlan, photoCount: number): number {
  if (photoCount === 0 || plan.type === 'text-only') return 0;

  const maxLong =
    photoCount === 1 ? PHOTO_FRAME.maxLongSingle : PHOTO_FRAME.maxLongMulti;

  return estimateCollageHeight(photoCount, CONTENT_WIDTH, maxLong);
}

function estimateFullHeight(entry: DiaryEntry, plan: LayoutPlan): number {
  const bodyLines = Math.max(
    1,
    Math.ceil(entry.body.length / (plan.textStyle === 'caption' ? 40 : 32)),
  );
  const bodyLineHeight = plan.textStyle === 'caption' ? 12 : 14;

  let height = 18; // 날짜
  height += 16 + 14; // 날짜 여백 + 구분선

  const photos = photoAreaHeight(plan, entry.photoUrls.length);
  if (photos > 0) height += photos + 16;

  height += bodyLines * bodyLineHeight + 8;
  return height;
}

function estimateCompactHeight(entry: DiaryEntry): number {
  const bodyLines = Math.max(0, Math.ceil(entry.body.length / 32));

  let height = 18; // 날짜
  height += 16 + 14; // 날짜 여백 + 구분선

  if (entry.body.length > 0) {
    height += Math.max(1, bodyLines) * 14 + 8;
  }

  return height;
}

function estimateItemHeight(item: PageItem): number {
  if (item.kind === 'compact') {
    return estimateCompactHeight(item.layout.entry);
  }
  return estimateFullHeight(item.layout.entry, item.layout.plan);
}

/** 연속 배치 — 헤더+사진+글박스(최소)가 들어갈 최소 높이 */
export function estimateEntryMinHeight(entry: DiaryEntry): number {
  const plan = decideLayout(entry);

  let height = 18 + 10 + 14; // 날짜 헤더 + 구분선

  const photos = photoAreaHeight(plan, entry.photoUrls.length);
  if (photos > 0) {
    height += photos + 12 * 2 + 10; // 사진 박스 패딩 + 간격
  }

  if (entry.body.length > 0) {
    height += 2 * 20 + 12 * 2 + 4; // 공책 박스 최소 2줄
  }

  return height;
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
  const moodEmoji = String(raw.moodEmoji ?? raw.mood ?? '').trim() || undefined;
  const moodLabel = String(raw.moodLabel ?? '').trim() || undefined;

  return {
    date,
    title,
    body,
    photoUrls: extractPhotoUrls(raw),
    moodEmoji,
    moodLabel,
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
