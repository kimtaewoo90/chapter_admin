/**
 * 일기 페이지 — 사진 박스 + 공책 줄무늬 글 박스
 */

export const ENTRY_BOX = {
  radius: 8,
  pad: 12,
  border: '#DDD6CA',
  photoBg: '#FFFFFF',
  noteBg: '#FFFEF8',
  ruleColor: '#E8E2D6',
  ruleSpacing: 20,
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

/** 공책 줄 간격 — ruleSpacing 과 PDFKit 줄 높이를 맞춤 */
function getNotebookMetrics(
  doc: PDFKit.PDFDocument,
  fontPath: string | null,
  fontSize: number,
): {
  lineHeight: number;
  lineGap: number;
  lineStep: number;
  /** 안쪽 상단 → 첫 줄 텍스트 y (baseline 이 첫 줄에 닿도록) */
  textOffsetTop: number;
} {
  const { ruleSpacing } = ENTRY_BOX;
  setFont(doc, fontPath, 'regular');
  doc.fontSize(fontSize);
  const lineHeight = doc.currentLineHeight();
  const lineGap = ruleSpacing - lineHeight;
  return {
    lineHeight,
    lineGap,
    lineStep: ruleSpacing,
    textOffsetTop: ruleSpacing - lineHeight,
  };
}

function countNotebookLines(
  doc: PDFKit.PDFDocument,
  text: string,
  innerWidth: number,
  metrics: ReturnType<typeof getNotebookMetrics>,
): number {
  if (!text) return 0;
  const height = doc.heightOfString(text, {
    width: innerWidth,
    lineGap: metrics.lineGap,
  });
  if (height <= metrics.lineHeight + 0.5) return 1;
  return Math.max(
    1,
    Math.round((height - metrics.lineHeight) / metrics.lineStep + 1),
  );
}

function notebookContentHeight(lineCount: number): number {
  return lineCount * ENTRY_BOX.ruleSpacing;
}

function drawRoundedBox(
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

function drawNotebookLines(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const { pad, ruleSpacing, ruleColor } = ENTRY_BOX;
  const innerX = x + pad;
  const innerW = w - pad * 2;
  const top = y + pad;
  const bottom = y + h - pad;

  for (let lineY = top + ruleSpacing; lineY < bottom; lineY += ruleSpacing) {
    doc
      .moveTo(innerX, lineY)
      .lineTo(innerX + innerW, lineY)
      .lineWidth(0.35)
      .strokeColor(ruleColor)
      .stroke();
  }
}

export function measureNotebookTextHeight(
  doc: PDFKit.PDFDocument,
  fontPath: string | null,
  text: string,
  innerWidth: number,
  fontSize: number,
): number {
  const metrics = getNotebookMetrics(doc, fontPath, fontSize);
  const lineCount = countNotebookLines(doc, text, innerWidth, metrics);
  return notebookContentHeight(lineCount);
}

/** maxHeight 안에 들어가는 텍스트 덩어리 (단어/줄 경계 우선) */
function fitTextChunk(
  doc: PDFKit.PDFDocument,
  text: string,
  innerWidth: number,
  maxHeight: number,
  metrics: ReturnType<typeof getNotebookMetrics>,
): string {
  if (!text) return '';

  const fits = (candidate: string) =>
    notebookContentHeight(
      countNotebookLines(doc, candidate, innerWidth, metrics),
    ) <= maxHeight;

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

function minBoxHeight(minLines: number): number {
  return minLines * ENTRY_BOX.ruleSpacing + ENTRY_BOX.pad * 2;
}

/**
 * 공책 글 박스 — 페이지를 넘기면 다음 페이지에도 박스+줄무늬 유지
 */
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
  const { pad, noteBg, sectionGap } = ENTRY_BOX;
  const innerWidth = width - pad * 2;
  const fontSize = options.fontSize;
  const align = options.align ?? 'left';
  const textColor = options.textColor ?? '#2C2824';
  const minLines = options.minLines ?? 3;
  const bottom = contentBottom();

  let remaining = text.trim();
  let cursorY = startY;

  while (remaining.length > 0) {
    const metrics = getNotebookMetrics(doc, fontPath, fontSize);
    let maxBoxHeight = bottom - cursorY;
    const minHeight = minBoxHeight(1);

    if (maxBoxHeight < minHeight) {
      doc.addPage();
      options.onNewPage();
      cursorY = DIARY_PAGE.margin;
      maxBoxHeight = bottom - cursorY;
    }

    const maxContentHeight = Math.max(metrics.lineStep, maxBoxHeight - pad * 2);
    const chunk = fitTextChunk(doc, remaining, innerWidth, maxContentHeight, metrics);
    const lineCount = Math.max(1, countNotebookLines(doc, chunk, innerWidth, metrics));
    const effectiveMinLines = Math.min(minLines, lineCount);
    const contentHeight = notebookContentHeight(
      Math.max(lineCount, effectiveMinLines),
    );
    const boxHeight = Math.min(maxBoxHeight, pad * 2 + contentHeight);
    const textY = cursorY + pad + metrics.textOffsetTop;
    const textHeight = contentHeight - metrics.textOffsetTop;

    drawRoundedBox(doc, x, cursorY, width, boxHeight, noteBg);
    drawNotebookLines(doc, x, cursorY, width, boxHeight);

    doc.fillColor(textColor);
    doc.text(chunk, x + pad, textY, {
      width: innerWidth,
      lineGap: metrics.lineGap,
      align,
      lineBreak: true,
      height: textHeight,
    });

    remaining = remaining.slice(chunk.length).trimStart();
    cursorY += boxHeight;

    if (remaining.length > 0) {
      cursorY += sectionGap;
      if (cursorY + minBoxHeight(1) > bottom) {
        doc.addPage();
        options.onNewPage();
        cursorY = DIARY_PAGE.margin;
      }
    }
  }

  return cursorY;
}

/** 짧은 글 — 한 페이지 안에 들어갈 때 */
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

  const { pad, noteBg } = ENTRY_BOX;
  const innerWidth = width - pad * 2;
  const fontSize = options.fontSize;
  const align = options.align ?? 'left';
  const textColor = options.textColor ?? '#2C2824';
  const minLines = options.minLines ?? 3;
  const metrics = getNotebookMetrics(doc, fontPath, fontSize);

  const lineCount = Math.max(
    minLines,
    countNotebookLines(doc, text, innerWidth, metrics),
  );
  const contentHeight = notebookContentHeight(lineCount);
  const boxHeight = pad * 2 + contentHeight;

  drawRoundedBox(doc, x, y, width, boxHeight, noteBg);
  drawNotebookLines(doc, x, y, width, boxHeight);

  doc.fillColor(textColor);
  doc.text(text, x + pad, y + pad + metrics.textOffsetTop, {
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
  drawRoundedBox(doc, x, y, width, boxHeight, photoBg);
  return boxHeight;
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
): void {
  doc.rect(0, 0, pageW, pageH).fill(PAGE_PAPER);
}
