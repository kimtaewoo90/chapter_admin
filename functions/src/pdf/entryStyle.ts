import { getEntryBodyStyle } from './bodyStyle';
import { drawMonthPageWatermark } from './pageWatermark';

export type { EntryBodyStyle } from './bodyStyle';
export {
  BODY_STYLE_CATALOG,
  bodyStyleLabel,
  formatBodyStyleHelp,
  getEntryBodyStyle,
  printBodyStyleCatalog,
  resolveBodyStyleIndex,
  setEntryBodyStyle,
} from './bodyStyle';

/**
 * 일기 본문 배경 — 5가지 스타일 (bodyStyle.ts 참고)
 */

export const ENTRY_BOX = {
  radius: 6,
  pad: 12,
  /** marginRail 전용 */
  padLeft: 22,
  border: '#DDD6CA',
  photoBg: '#FFFFFF',
  noteBg: '#FAF7F1',
  railColor: '#8B7355',
  railWidth: 2,
  railInset: 6,
  dotSpacing: 16,
  dotRadius: 0.65,
  dotColor: '#CBC2B4',
  tapeColor: '#F3E4B8',
  tapeShadow: '#D9C99A',
  tapeFiber: '#E8D8A8',
  lineGap: 7,
  sectionGap: 10,
  boxGap: 14,
} as const;

export const PAGE_PAPER = '#F5F0E8';

export const DIARY_PAGE = {
  width: 420,
  height: 595,
  margin: 48,
} as const;

type TextAlign = 'left' | 'center' | 'right' | 'justify';

function setFont(
  doc: PDFKit.PDFDocument,
  fontPath: string | null,
  weight: 'regular' | 'bold',
): void {
  if (fontPath) doc.font(fontPath);
  else doc.font(weight === 'bold' ? 'Helvetica-Bold' : 'Helvetica');
}

function getTextMetrics(
  doc: PDFKit.PDFDocument,
  fontPath: string | null,
  fontSize: number,
): { lineHeight: number; lineGap: number; lineStep: number } {
  setFont(doc, fontPath, 'regular');
  doc.fontSize(fontSize);
  const lineHeight = doc.currentLineHeight();
  const lineGap = ENTRY_BOX.lineGap;
  return { lineHeight, lineGap, lineStep: lineHeight + lineGap };
}

function measureTextBlockHeight(
  doc: PDFKit.PDFDocument,
  text: string,
  innerWidth: number,
  metrics: ReturnType<typeof getTextMetrics>,
): number {
  if (!text) return 0;
  return doc.heightOfString(text, {
    width: innerWidth,
    lineGap: metrics.lineGap,
  });
}

function drawMarginRail(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  h: number,
): void {
  const { railColor, railWidth, railInset } = ENTRY_BOX;
  const railX = x + railInset;

  doc
    .moveTo(railX, y + railInset)
    .lineTo(railX, y + h - railInset)
    .lineWidth(railWidth)
    .lineCap('round')
    .strokeColor(railColor)
    .stroke();
}

function drawCornerBrackets(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const len = Math.min(14, w * 0.12, h * 0.2);
  const { railColor } = ENTRY_BOX;

  doc.lineWidth(0.7).strokeColor(railColor);

  doc.moveTo(x, y + len).lineTo(x, y).lineTo(x + len, y).stroke();
  doc.moveTo(x + w - len, y).lineTo(x + w, y).lineTo(x + w, y + len).stroke();
  doc.moveTo(x, y + h - len).lineTo(x, y + h).lineTo(x + len, y + h).stroke();
  doc
    .moveTo(x + w - len, y + h)
    .lineTo(x + w, y + h)
    .lineTo(x + w, y + h - len)
    .stroke();
}

function drawDotGrid(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const { pad, dotSpacing, dotRadius, dotColor, noteBg, radius } = ENTRY_BOX;

  doc.roundedRect(x, y, w, h, radius).fillColor(noteBg).fill();

  const left = x + pad;
  const top = y + pad;
  const right = x + w - pad;
  const bottom = y + h - pad;
  const areaW = right - left;
  const areaH = bottom - top;

  if (areaW <= 0 || areaH <= 0) return;

  const cols = Math.max(1, Math.floor(areaW / dotSpacing));
  const rows = Math.max(1, Math.floor(areaH / dotSpacing));
  const gridW = cols * dotSpacing;
  const gridH = rows * dotSpacing;
  const startX = left + (areaW - gridW) / 2;
  const startY = top + (areaH - gridH) / 2;

  doc.fillColor(dotColor);
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= cols; col++) {
      doc.circle(startX + col * dotSpacing, startY + row * dotSpacing, dotRadius).fill();
    }
  }
}

/** 겹친 타원으로 수채화 워시 */
function drawWash(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const { radius } = ENTRY_BOX;
  const blobs = [
    { cx: 0.28, cy: 0.22, rx: 0.42, ry: 0.32, color: '#E8D4C8', opacity: 0.5 },
    { cx: 0.72, cy: 0.48, rx: 0.48, ry: 0.38, color: '#D4E0E8', opacity: 0.38 },
    { cx: 0.4, cy: 0.78, rx: 0.44, ry: 0.28, color: '#E8E0D0', opacity: 0.45 },
    { cx: 0.55, cy: 0.35, rx: 0.3, ry: 0.22, color: '#F0E4DC', opacity: 0.35 },
  ];

  doc.save();
  doc.roundedRect(x, y, w, h, radius).clip();

  for (const blob of blobs) {
    doc.save();
    doc.fillOpacity(blob.opacity);
    doc
      .ellipse(x + w * blob.cx, y + h * blob.cy, w * blob.rx, h * blob.ry)
      .fill(blob.color);
    doc.restore();
  }

  doc.restore();
  doc
    .roundedRect(x, y, w, h, radius)
    .lineWidth(0.4)
    .strokeColor('#E8E0D4')
    .stroke();
}

/** 마스킹 테이프 스트립 */
function drawTape(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const { tapeColor, tapeShadow, tapeFiber } = ENTRY_BOX;
  const insetX = 6;
  const insetY = 4;
  const tapeX = x + insetX;
  const tapeY = y + insetY;
  const tapeW = w - insetX * 2;
  const tapeH = h - insetY * 2;

  doc.save();
  doc.translate(tapeX + tapeW / 2, tapeY + tapeH / 2);
  doc.rotate(-0.6);
  doc.translate(-(tapeX + tapeW / 2), -(tapeY + tapeH / 2));

  doc
    .roundedRect(tapeX + 2, tapeY + 3, tapeW, tapeH, 4)
    .fillColor(tapeShadow)
    .fillOpacity(0.25)
    .fill();

  doc.fillOpacity(1);
  doc.roundedRect(tapeX, tapeY, tapeW, tapeH, 4).fillColor(tapeColor).fill();

  doc.strokeColor(tapeFiber).lineWidth(0.35).opacity(0.55);
  for (let i = 0; i < 7; i++) {
    const ly = tapeY + tapeH * (0.12 + i * 0.13);
    doc
      .moveTo(tapeX + 10, ly)
      .lineTo(tapeX + tapeW - 10, ly + (i % 2 === 0 ? 1.5 : -1))
      .stroke();
  }

  doc.opacity(1);
  doc.restore();
}

function drawTextBlockDecoration(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  align: TextAlign,
): void {
  switch (getEntryBodyStyle()) {
    case 'marginRail':
      if (align === 'center') drawCornerBrackets(doc, x, y, w, h);
      else drawMarginRail(doc, x, y, h);
      break;
    case 'dotGrid':
      drawDotGrid(doc, x, y, w, h);
      break;
    case 'wash':
      drawWash(doc, x, y, w, h);
      break;
    case 'tape':
      drawTape(doc, x, y, w, h);
      break;
    case 'minimal':
      break;
  }
}

function drawPhotoFrameBoxInner(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
): void {
  doc
    .roundedRect(x, y, w, h, ENTRY_BOX.radius)
    .fillColor(fill)
    .fill()
    .lineWidth(0.6)
    .strokeColor(ENTRY_BOX.border)
    .stroke();
}

export function measureNotebookTextHeight(
  doc: PDFKit.PDFDocument,
  fontPath: string | null,
  text: string,
  innerWidth: number,
  fontSize: number,
): number {
  const metrics = getTextMetrics(doc, fontPath, fontSize);
  return measureTextBlockHeight(doc, text, innerWidth, metrics);
}

function fitTextChunk(
  doc: PDFKit.PDFDocument,
  text: string,
  innerWidth: number,
  maxHeight: number,
  metrics: ReturnType<typeof getTextMetrics>,
): string {
  if (!text) return '';

  const fits = (candidate: string) =>
    measureTextBlockHeight(doc, candidate, innerWidth, metrics) <= maxHeight;

  if (fits(text)) return text;

  let lo = 0;
  let hi = text.length;

  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = text.slice(0, mid);
    if (fits(candidate)) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  if (lo <= 0) return text.slice(0, 1);

  const slice = text.slice(0, lo);
  const lastNewline = slice.lastIndexOf('\n');
  const lastSpace = slice.lastIndexOf(' ');

  if (lastNewline > lo * 0.6) return text.slice(0, lastNewline + 1);
  if (lastSpace > lo * 0.6) return text.slice(0, lastSpace + 1);
  return slice;
}

function contentBottom(): number {
  return DIARY_PAGE.height - DIARY_PAGE.margin;
}

function minBlockHeight(minLines: number, metrics: ReturnType<typeof getTextMetrics>): number {
  return ENTRY_BOX.pad * 2 + Math.max(1, minLines) * metrics.lineStep;
}

function textOrigin(
  x: number,
  width: number,
  align: TextAlign,
): { textX: number; innerWidth: number } {
  const { pad, padLeft } = ENTRY_BOX;

  if (getEntryBodyStyle() === 'marginRail' && align !== 'center') {
    return { textX: x + padLeft, innerWidth: width - padLeft - pad };
  }

  return { textX: x + pad, innerWidth: width - pad * 2 };
}

export function drawNotebookTextFlow(
  doc: PDFKit.PDFDocument,
  fontPath: string | null,
  text: string,
  x: number,
  startY: number,
  width: number,
  options: {
    fontSize: number;
    align?: TextAlign;
    textColor?: string;
    minLines?: number;
    onNewPage: () => void;
  },
): number {
  const { pad, sectionGap } = ENTRY_BOX;
  const fontSize = options.fontSize;
  const align = options.align ?? 'left';
  const textColor = options.textColor ?? '#2C2824';
  const minLines = options.minLines ?? 3;
  const bottom = contentBottom();

  let remaining = text.trim();
  let cursorY = startY;

  while (remaining.length > 0) {
    const metrics = getTextMetrics(doc, fontPath, fontSize);
    const { textX, innerWidth } = textOrigin(x, width, align);

    let maxBoxHeight = bottom - cursorY;
    const minHeight = minBlockHeight(1, metrics);

    if (maxBoxHeight < minHeight) {
      doc.addPage();
      options.onNewPage();
      cursorY = DIARY_PAGE.margin;
      maxBoxHeight = bottom - cursorY;
    }

    const maxContentHeight = Math.max(metrics.lineStep, maxBoxHeight - pad * 2);
    const chunk = fitTextChunk(doc, remaining, innerWidth, maxContentHeight, metrics);
    let contentHeight = measureTextBlockHeight(doc, chunk, innerWidth, metrics);
    const minContentHeight = minLines * metrics.lineStep;
    contentHeight = Math.max(contentHeight, Math.min(minContentHeight, maxContentHeight));
    const boxHeight = Math.min(maxBoxHeight, pad * 2 + contentHeight);
    const textY = cursorY + pad;

    drawTextBlockDecoration(doc, x, cursorY, width, boxHeight, align);

    setFont(doc, fontPath, 'regular');
    doc.fillColor(textColor);
    doc.fontSize(fontSize);
    doc.text(chunk, textX, textY, {
      width: innerWidth,
      lineGap: metrics.lineGap,
      align,
      lineBreak: true,
      height: boxHeight - pad * 2,
    });

    remaining = remaining.slice(chunk.length).trimStart();
    cursorY += boxHeight;

    if (remaining.length > 0) {
      cursorY += sectionGap;
      if (cursorY + minBlockHeight(1, metrics) > bottom) {
        doc.addPage();
        options.onNewPage();
        cursorY = DIARY_PAGE.margin;
      }
    }
  }

  return cursorY;
}

export function drawNotebookTextBox(
  doc: PDFKit.PDFDocument,
  fontPath: string | null,
  text: string,
  x: number,
  y: number,
  width: number,
  options: {
    fontSize: number;
    align?: TextAlign;
    textColor?: string;
    minLines?: number;
    onNewPage?: () => void;
  },
): number {
  if (options.onNewPage) {
    return drawNotebookTextFlow(doc, fontPath, text, x, y, width, {
      ...options,
      onNewPage: options.onNewPage,
    });
  }

  const { pad } = ENTRY_BOX;
  const fontSize = options.fontSize;
  const align = options.align ?? 'left';
  const textColor = options.textColor ?? '#2C2824';
  const minLines = options.minLines ?? 3;
  const metrics = getTextMetrics(doc, fontPath, fontSize);
  const { textX, innerWidth } = textOrigin(x, width, align);

  const contentHeight = Math.max(
    measureTextBlockHeight(doc, text, innerWidth, metrics),
    minLines * metrics.lineStep,
  );
  const boxHeight = pad * 2 + contentHeight;

  drawTextBlockDecoration(doc, x, y, width, boxHeight, align);

  setFont(doc, fontPath, 'regular');
  doc.fillColor(textColor);
  doc.fontSize(fontSize);
  doc.text(text, textX, y + pad, {
    width: innerWidth,
    lineGap: metrics.lineGap,
    align,
  });

  return y + boxHeight;
}

export function drawPhotoFrameBox(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  collageHeight: number,
): number {
  const { pad, photoBg } = ENTRY_BOX;
  const boxHeight = collageHeight + pad * 2;
  drawPhotoFrameBoxInner(doc, x, y, width, boxHeight, photoBg);
  return boxHeight;
}

export function bodyTextInnerWidth(outerWidth: number): number {
  if (getEntryBodyStyle() === 'marginRail') {
    return outerWidth - ENTRY_BOX.padLeft - ENTRY_BOX.pad;
  }
  return outerWidth - ENTRY_BOX.pad * 2;
}

export function photoBoxInnerWidth(outerWidth: number): number {
  return outerWidth - ENTRY_BOX.pad * 2;
}

export function photoBoxInnerOrigin(
  boxX: number,
  boxY: number,
): { x: number; y: number } {
  return { x: boxX + ENTRY_BOX.pad, y: boxY + ENTRY_BOX.pad };
}

export function fillDiaryPageBackground(
  doc: PDFKit.PDFDocument,
  pageW: number,
  pageH: number,
  options?: {
    watermarkMonth?: { year: number; month: number };
    fontPath?: string | null;
  },
): void {
  doc.rect(0, 0, pageW, pageH).fill(PAGE_PAPER);

  if (options?.watermarkMonth) {
    drawMonthPageWatermark(
      doc,
      options.fontPath ?? null,
      options.watermarkMonth.year,
      options.watermarkMonth.month,
      pageW,
      pageH,
    );
  }
}
