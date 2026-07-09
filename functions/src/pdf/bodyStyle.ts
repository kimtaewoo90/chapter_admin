export type EntryBodyStyle =
  | 'marginRail'
  | 'dotGrid'
  | 'wash'
  | 'tape'
  | 'minimal';

export const BODY_STYLE_CATALOG: ReadonlyArray<{
  index: number;
  id: EntryBodyStyle;
  label: string;
}> = [
  { index: 1, id: 'marginRail', label: '마진 레일 (에디토리얼)' },
  { index: 2, id: 'dotGrid', label: '도트 그리드 (부저널)' },
  { index: 3, id: 'wash', label: '워시 배경 (수채화)' },
  { index: 4, id: 'tape', label: '마스킹 테이프' },
  { index: 5, id: 'minimal', label: '미니멀 (속지 직접)' },
];

let activeBodyStyle: EntryBodyStyle = 'marginRail';

export function setEntryBodyStyle(style: EntryBodyStyle): void {
  activeBodyStyle = style;
}

export function getEntryBodyStyle(): EntryBodyStyle {
  return activeBodyStyle;
}

export function resolveBodyStyleIndex(raw?: string): EntryBodyStyle {
  if (!raw) return 'marginRail';

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
