/** 일기 엔트리 입력 (주문 스냅샷에서 파싱) */
export interface DiaryEntry {
  date: string;
  title: string;
  body: string;
  photoUrls: string[];
}

/**
 * Layout Engine이 결정하는 페이지 레이아웃 타입
 *
 * - single-photo-vertical: 사진 1장 + 긴 글 → 사진 위 / 제목 / 본문
 * - photo-grid: 사진 여러 장 + 짧은 글 → 그리드 + 짧은 코멘트
 * - dual-photo: 사진 2장 + 짧은 글 → 나란히 배치
 * - text-only: 사진 없음
 */
export type LayoutType =
  | 'single-photo-vertical'
  | 'photo-grid'
  | 'dual-photo'
  | 'text-only';

export type TextStyle = 'full' | 'short' | 'caption';

/** full = 단독 페이지, compact = 짧은 글끼리 한 페이지에 묶음 */
export type PageMode = 'full' | 'compact';

export interface PhotoSlot {
  index: number;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

export interface LayoutPlan {
  type: LayoutType;
  photoSlots: PhotoSlot[];
  textStyle: TextStyle;
  gridColumns: number;
  gridRows: number;
  pageMode: PageMode;
}

export interface EntryLayout {
  entry: DiaryEntry;
  plan: LayoutPlan;
}

export type PageItem =
  | { kind: 'full'; layout: EntryLayout }
  | { kind: 'compact'; layout: EntryLayout };

/** 한 PDF 페이지에 그릴 항목들 (full 아래 compact 이어 붙이기 가능) */
export type BookPagePlan = {
  items: PageItem[];
};

export const LAYOUT_THRESHOLDS = {
  /** 이 이상이면 "긴 글" → 단독 페이지 */
  longText: 200,
  /** 이 미만이면 "짧은 코멘트" */
  shortText: 150,
  /** 사진 없 + 이 글자 수 미만 → compact 묶음 가능 */
  compactTextMax: 120,
  /** 그리드 레이아웃 최소 사진 수 */
  gridPhotoMin: 3,
  /** A5 콘텐츠 영역 높이 (595 - margin×2) */
  pageContentHeight: 499,
  /** 같은 페이지 항목 사이 간격 (일기 구분) */
  itemGap: 32,
} as const;
