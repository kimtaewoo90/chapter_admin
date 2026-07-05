/** Chapter 브랜드 사진 스타일 (MVP: 1종) */
export type PhotoStyle = 'chapter';

export const DEFAULT_PHOTO_STYLE: PhotoStyle = 'chapter';

export const PHOTO_FRAME = {
  /** 사진 모서리 — 테두리 없이 살짝만 둥글게 */
  radius: 5,
  gap: 16,
  rowGap: 20,
  /** 1장 — 세로 사진도 같은 페이지에 글(최소 4줄)이 들어가도록 축소 */
  maxLongSingle: 220,
  maxLongMulti: 128,
  bottomGap: 16,
} as const;

export function parsePhotoStyle(value: unknown): PhotoStyle {
  if (value === 'chapter') return 'chapter';
  return DEFAULT_PHOTO_STYLE;
}
