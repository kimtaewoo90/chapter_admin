import { monthLabelKo } from './calendarLayout';

const WATERMARK = {
  opacity: 0.06,
  color: '#8B7355',
  fontSize: 34,
  rightInset: 40,
  /** 페이지 번호 위 */
  bottomInset: 52,
  textWidth: 220,
} as const;

/** 일기 속지 우하단 — 「yyyy년 M월」 워터마크 */
export function drawMonthPageWatermark(
  doc: PDFKit.PDFDocument,
  fontPath: string | null,
  year: number,
  month: number,
  pageW: number,
  pageH: number,
): void {
  const label = monthLabelKo(year, month);
  const x = pageW - WATERMARK.rightInset - WATERMARK.textWidth;
  const y = pageH - WATERMARK.bottomInset - WATERMARK.fontSize;

  doc.save();
  doc.fillOpacity(WATERMARK.opacity);

  if (fontPath) doc.font(fontPath);
  else doc.font('Helvetica-Bold');

  doc
    .fontSize(WATERMARK.fontSize)
    .fillColor(WATERMARK.color);
  doc.text(label, x, y, {
    width: WATERMARK.textWidth,
    align: 'right',
    lineBreak: false,
  });

  doc.restore();
}

export function parseEntryYearMonth(
  date: string,
): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})/.exec(date.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!year || month < 1 || month > 12) return null;

  return { year, month };
}
