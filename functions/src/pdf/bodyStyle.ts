export type EntryBodyStyle =
  | 'notebook'
  | 'marginRail'
  | 'dotGrid'
  | 'wash'
  | 'tape'
  | 'minimal';

/** Admin·앱 미리보기 기본 — 공책 줄무늬 박스 */
export const DEFAULT_BODY_STYLE: EntryBodyStyle = 'notebook';

export const BODY_STYLE_CATALOG: ReadonlyArray<{
  index: number;
  id: EntryBodyStyle;
  label: string;
}> = [
  { index: 1, id: 'notebook', label: '공책 줄무늬 (앱 기본)' },
  { index: 2, id: 'marginRail', label: '마진 레일 (에디토리얼)' },
  { index: 3, id: 'dotGrid', label: '도트 그리드 (부저널)' },
  { index: 4, id: 'wash', label: '워시 배경 (수채화)' },
  { index: 5, id: 'tape', label: '마스킹 테이프' },
  { index: 6, id: 'minimal', label: '미니멀 (속지 직접)' },
];

let activeBodyStyle: EntryBodyStyle = DEFAULT_BODY_STYLE;

export function setEntryBodyStyle(style: EntryBodyStyle): void {
  activeBodyStyle = style;
}

export function getEntryBodyStyle(): EntryBodyStyle {
  return activeBodyStyle;
}

export function resolveBodyStyleIndex(raw?: string): EntryBodyStyle {
  if (!raw) return DEFAULT_BODY_STYLE;

  const byId = BODY_STYLE_CATALOG.find((item) => item.id === raw);
  if (byId) return byId.id;

  const index = Number(raw);
  if (!Number.isInteger(index) || index < 1 || index > BODY_STYLE_CATALOG.length) {
    throw new Error(formatBodyStyleHelp());
  }

  return BODY_STYLE_CATALOG[index - 1].id;
}

export function bodyStyleLabel(style: EntryBodyStyle): string {
  return BODY_STYLE_CATALOG.find((item) => item.id === style)?.label ?? style;
}

export function formatBodyStyleHelp(): string {
  const lines = BODY_STYLE_CATALOG.map(
    (item) => `  ${item.index}. ${item.label}`,
  );
  return `본문 스타일 인덱스 (1~${BODY_STYLE_CATALOG.length}):\n${lines.join('\n')}`;
}

export function printBodyStyleCatalog(): void {
  console.log(formatBodyStyleHelp());
}
