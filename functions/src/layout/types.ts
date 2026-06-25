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
}

export const LAYOUT_THRESHOLDS = {
  /** 이 이상이면 "긴 글" */
  longText: 200,
  /** 이 미만이면 "짧은 코멘트" */
  shortText: 150,
  /** 그리드 레이아웃 최소 사진 수 */
  gridPhotoMin: 3,
} as const;
