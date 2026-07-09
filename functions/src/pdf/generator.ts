import PDFDocument from 'pdfkit';

import { decideLayout } from '../layout/engine';
import {
  StickerItem,
  layoutStickerCollage,
} from '../layout/stickerCollage';
import {
  buildCalendarMonthLayout,
  calendarContentGridSize,
  entriesForMonth,
  indexEntriesByDate,
  listMonthsWithEntries,
} from './calendarLayout';
import { drawCalendarMonthPage } from './calendarPage';
import {
  bodyTextInnerWidth,
  drawNotebookTextFlow,
  ENTRY_BOX,
  fillDiaryPageBackground,
  measureNotebookTextHeight,
} from './entryStyle';
import { fitImageSize, prepareImage, PreparedImage } from './imagePrep';
import { drawCoverPage, formatCoverDateRange, BookCoverOptions } from './coverPage';
import { resolveDiaryFontPath } from './diaryFonts';
import { stampPageNumbers } from './pageNumbers';
import { EntryBodyStyle, setEntryBodyStyle } from './bodyStyle';
import { PHOTO_FRAME } from './photoStyle';
import { DiaryEntry, LayoutPlan } from '../layout/types';

const PAGE = { width: 420, height: 595, margin: 48 };

const COLORS = {
  title: '#2C2824',
  subtitle: '#6B6560',
  body: '#2C2824',
  muted: '#9A948C',
  line: '#8B7355',
  placeholder: '#C5BFB8',
};

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

function setFont(
  doc: PDFKit.PDFDocument,
  fontPath: string | null,
  weight: 'regular' | 'bold',
) {
  if (fontPath) doc.font(fontPath);
  else doc.font(weight === 'bold' ? 'Helvetica-Bold' : 'Helvetica');
}

function contentWidth(): number {
  return PAGE.width - PAGE.margin * 2;
}

/** Chapter 브랜드 — 테두리 없음, 살짝 둥근 모서리만 */
function drawChapterPhoto(
  doc: PDFKit.PDFDocument,
  prepared: PreparedImage,
  x: number,
  y: number,
  slotW: number,
  slotH: number,
): void {
  const fitted = fitImageSize(prepared, slotW, slotH);
  const imgX = x + (slotW - fitted.width) / 2;
  const imgY = y + (slotH - fitted.height) / 2;

  doc.save();
  doc.roundedRect(imgX, imgY, fitted.width, fitted.height, PHOTO_FRAME.radius).clip();
  doc.image(prepared.buffer, imgX, imgY, { width: fitted.width });
  doc.restore();
}

function pageContentBottom(): number {
  return PAGE.height - PAGE.margin;
}

function pageContentHeight(): number {
  return pageContentBottom() - PAGE.margin;
}

function estimateHeaderHeight(entry: DiaryEntry): number {
  let height = ENTRY_STYLE.headerBottomGap + 14;
  if (entry.date) {
    height += ENTRY_STYLE.dateSize * 1.2 + ENTRY_STYLE.dateGap;
  }
  return height;
}

function measurePhotoBlockHeight(
  entry: DiaryEntry,
  images: Map<number, PreparedImage>,
  usableWidth: number,
): number {
  const photoCount = entry.photoUrls.length;
  if (photoCount === 0) return 0;

  const stickerItems: StickerItem[] = [];
  for (let i = 0; i < photoCount; i++) {
    stickerItems.push({
      index: i,
      meta: images.get(i) ?? { width: 4, height: 3 },
    });
  }

  const maxLong =
    photoCount === 1 ? PHOTO_FRAME.maxLongSingle : PHOTO_FRAME.maxLongMulti;
  const collage = layoutStickerCollage(stickerItems, usableWidth, {
    maxLongEdge: maxLong,
  });

  return collage.totalHeight + ENTRY_BOX.sectionGap;
}

function estimateEntryDrawHeight(
  doc: PDFKit.PDFDocument,
  entry: DiaryEntry,
  plan: LayoutPlan,
  fontPath: string | null,
  images: Map<number, PreparedImage>,
): number {
  const usableWidth = contentWidth();
  let height = estimateHeaderHeight(entry);

  if (entry.photoUrls.length > 0) {
    height += measurePhotoBlockHeight(entry, images, usableWidth);
  }

  if (entry.body.length > 0) {
    const fontSize = plan.textStyle === 'caption' ? 10 : ENTRY_STYLE.bodySize;
    const innerWidth = bodyTextInnerWidth(usableWidth);
    const textBlockHeight = measureNotebookTextHeight(
      doc,
      fontPath,
      entry.body,
      innerWidth,
      fontSize,
    );
    height += ENTRY_BOX.pad * 2 + textBlockHeight + ENTRY_BOX.boxGap;
  }

  return height;
}

function centeredEntryStartY(entryHeight: number): number {
  const available = pageContentHeight();
  if (entryHeight >= available) return PAGE.margin;
  return PAGE.margin + (available - entryHeight) / 2;
}

/** 짧은 글만 / 월 첫 일기 → 페이지 세로 중앙 */
function shouldCenterEntryOnPage(
  entryIndexInMonth: number,
  plan: LayoutPlan,
): boolean {
  return entryIndexInMonth === 0 || plan.pageMode === 'compact';
}

function ensureVerticalSpace(
  doc: PDFKit.PDFDocument,
  cursorY: number,
  neededHeight: number,
  onNewPage: () => void,
): number {
  if (cursorY + neededHeight <= pageContentBottom()) return cursorY;
  doc.addPage();
  onNewPage();
  return PAGE.margin;
}

function drawPhotoSection(
  doc: PDFKit.PDFDocument,
  entry: DiaryEntry,
  images: Map<number, PreparedImage>,
  fontPath: string | null,
  startY: number,
  usableWidth: number,
  onNewPage: () => void,
): number {
  const photoCount = entry.photoUrls.length;
  if (photoCount === 0) return startY;

  const stickerItems: StickerItem[] = [];
  for (let i = 0; i < photoCount; i++) {
    const prepared = images.get(i);
    stickerItems.push({
      index: i,
      meta: prepared ?? { width: 4, height: 3 },
    });
  }

  const maxLong =
    photoCount === 1 ? PHOTO_FRAME.maxLongSingle : PHOTO_FRAME.maxLongMulti;
  const collage = layoutStickerCollage(stickerItems, usableWidth, {
    maxLongEdge: maxLong,
  });

  const sectionHeight = collage.totalHeight + ENTRY_BOX.sectionGap;
  const photoX = PAGE.margin;
  const photoY = ensureVerticalSpace(doc, startY, sectionHeight, onNewPage);

  for (const placement of collage.placements) {
    const x = photoX + placement.x;
    const y = photoY + placement.y;
    const prepared = images.get(placement.index);

    if (prepared) {
      drawChapterPhoto(
        doc,
        prepared,
        x,
        y,
        placement.photoW,
        placement.photoH,
      );
    } else {
      drawPlaceholder(
        doc,
        x,
        y,
        placement.frameW,
        placement.frameH,
        fontPath,
      );
    }
  }

  return photoY + collage.totalHeight + ENTRY_BOX.sectionGap;
}

const ENTRY_STYLE = {
  dateSize: 12,
  moodSize: 10,
  bodySize: 11,
  dateGap: 16,
  headerBottomGap: 14,
};

function formatEntryDateLabel(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (match) {
    return `${Number(match[2])}월 ${Number(match[3])}일`;
  }
  return date;
}

function formatMoodDisplay(entry: DiaryEntry): string | undefined {
  const emoji = entry.moodEmoji?.trim();
  const label = entry.moodLabel?.trim();
  const hasEmoji = !!emoji;
  const hasLabel = !!label;
  if (hasEmoji && hasLabel) return `${emoji} ${label}`;
  if (hasEmoji) return emoji;
  if (hasLabel) return label;
  return undefined;
}

function drawEntryHeader(
  doc: PDFKit.PDFDocument,
  entry: DiaryEntry,
  fontPath: string | null,
  x: number,
  y: number,
  width: number,
): number {
  let cursorY = y;
  const dateLabel = entry.date ? formatEntryDateLabel(entry.date) : '';
  const moodText = formatMoodDisplay(entry);

  if (dateLabel) {
    const headerY = cursorY;
    setFont(doc, fontPath, 'bold');
    doc.fontSize(ENTRY_STYLE.dateSize).fillColor(COLORS.title);
    doc.text(dateLabel, x, headerY, { width, lineBreak: false });

    if (moodText) {
      setFont(doc, fontPath, 'regular');
      doc.fontSize(ENTRY_STYLE.moodSize).fillColor(COLORS.muted);
      const moodWidth = doc.widthOfString(moodText);
      doc.text(moodText, x + width - moodWidth, headerY, { lineBreak: false });
    }

    cursorY = Math.max(doc.y, headerY + ENTRY_STYLE.dateSize * 1.2) + ENTRY_STYLE.dateGap;
  }

  doc
    .moveTo(x, cursorY)
    .lineTo(x + width, cursorY)
    .strokeColor(COLORS.line)
    .lineWidth(0.5)
    .stroke();

  return cursorY + ENTRY_STYLE.headerBottomGap;
}

/** 사진·긴 글 */
function drawFullEntry(
  doc: PDFKit.PDFDocument,
  entry: DiaryEntry,
  plan: LayoutPlan,
  fontPath: string | null,
  imageBuffers: Map<number, PreparedImage>,
  startY: number,
  onNewPage: () => void,
): number {
  const usableWidth = contentWidth();
  let cursorY = drawEntryHeader(
    doc,
    entry,
    fontPath,
    PAGE.margin,
    startY,
    usableWidth,
  );

  if (entry.photoUrls.length > 0) {
    cursorY = drawPhotoSection(
      doc,
      entry,
      imageBuffers,
      fontPath,
      cursorY,
      usableWidth,
      onNewPage,
    );
  }

  if (entry.body.length > 0) {
    const fontSize = plan.textStyle === 'caption' ? 10 : ENTRY_STYLE.bodySize;
    cursorY = drawNotebookTextFlow(
      doc,
      fontPath,
      entry.body,
      PAGE.margin,
      cursorY,
      usableWidth,
      {
        fontSize,
        align: plan.textStyle === 'caption' ? 'center' : 'left',
        textColor: COLORS.body,
        minLines: plan.textStyle === 'caption' ? 2 : 4,
        onNewPage,
      },
    );
    cursorY += ENTRY_BOX.boxGap;
  }

  return cursorY;
}

/** 짧은 글 — 사진 있는 날과 동일한 헤더 + 본문 */
function drawCompactEntry(
  doc: PDFKit.PDFDocument,
  entry: DiaryEntry,
  fontPath: string | null,
  startY: number,
  onNewPage: () => void,
): number {
  const usableWidth = contentWidth();
  let cursorY = drawEntryHeader(
    doc,
    entry,
    fontPath,
    PAGE.margin,
    startY,
    usableWidth,
  );

  if (entry.body.length > 0) {
    cursorY = drawNotebookTextFlow(
      doc,
      fontPath,
      entry.body,
      PAGE.margin,
      cursorY,
      usableWidth,
      {
        fontSize: ENTRY_STYLE.bodySize,
        textColor: COLORS.body,
        minLines: 1,
        onNewPage,
      },
    );
    cursorY += ENTRY_BOX.boxGap;
  }

  return cursorY;
}

function drawPlaceholder(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  fontPath: string | null,
): void {
  doc
    .roundedRect(x, y, width, height, PHOTO_FRAME.radius)
    .lineWidth(0.5)
    .strokeColor(COLORS.line)
    .stroke();
  setFont(doc, fontPath, 'regular');
  doc.fontSize(9).fillColor(COLORS.placeholder);
  doc.text('사진', x, y + height / 2 - 5, { width, align: 'center' });
}

async function loadImages(entry: DiaryEntry): Promise<Map<number, PreparedImage>> {
  const images = new Map<number, PreparedImage>();
  await Promise.all(
    entry.photoUrls.map(async (url, index) => {
      const raw = await fetchImageBuffer(url);
      if (!raw) return;
      const prepared = await prepareImage(raw);
      if (prepared) images.set(index, prepared);
    }),
  );
  return images;
}

async function loadCalendarCoverImages(
  layout: ReturnType<typeof buildCalendarMonthLayout>,
): Promise<Map<string, PreparedImage>> {
  const urls = new Set<string>();
  for (const cell of layout.cells) {
    if (cell.coverPhotoUrl) urls.add(cell.coverPhotoUrl);
  }

  const images = new Map<string, PreparedImage>();
  await Promise.all(
    [...urls].map(async (url) => {
      const raw = await fetchImageBuffer(url);
      if (!raw) return;
      const prepared = await prepareImage(raw);
      if (prepared) images.set(url, prepared);
    }),
  );
  return images;
}

async function renderMonthEntries(
  doc: PDFKit.PDFDocument,
  entries: DiaryEntry[],
  fontPath: string | null,
): Promise<void> {
  const paintPage = () => fillDiaryPageBackground(doc, PAGE.width, PAGE.height);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const plan = decideLayout(entry);

    doc.addPage();
    paintPage();

    const images =
      plan.pageMode === 'full' ? await loadImages(entry) : new Map<number, PreparedImage>();

    let startY = PAGE.margin;
    if (shouldCenterEntryOnPage(i, plan)) {
      const estimatedHeight = estimateEntryDrawHeight(
        doc,
        entry,
        plan,
        fontPath,
        images,
      );
      startY = centeredEntryStartY(estimatedHeight);
    }

    if (plan.pageMode === 'full') {
      drawFullEntry(
        doc,
        entry,
        plan,
        fontPath,
        images,
        startY,
        paintPage,
      );
    } else {
      drawCompactEntry(doc, entry, fontPath, startY, paintPage);
    }
  }
}

/** 주문 스냅샷 엔트리들로 책 PDF 생성 */
export async function generateBookPdf(
  entries: DiaryEntry[],
  bookTitle: string,
  options: {
    diaryFontId?: string;
    cover?: BookCoverOptions;
    bodyStyle?: EntryBodyStyle;
  } = {},
): Promise<Buffer> {
  setEntryBodyStyle(options.bodyStyle ?? 'marginRail');
  const fontPath = await resolveDiaryFontPath(options.diaryFontId);
  const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const cover: BookCoverOptions = {
    coverType: options.cover?.coverType ?? 'chapter_icon',
    coverPhotoUrl: options.cover?.coverPhotoUrl,
    coverTitle: options.cover?.coverTitle?.trim() || undefined,
    dateRangeLabel:
      options.cover?.dateRangeLabel?.trim() || formatCoverDateRange(sortedEntries),
  };
  const months = listMonthsWithEntries(sortedEntries);
  const { gridWidth } = calendarContentGridSize();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [PAGE.width, PAGE.height],
      margin: PAGE.margin,
      bufferPages: true,
      info: { Title: bookTitle, Author: 'Chapter' },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    void (async () => {
      try {
        await drawCoverPage(doc, fontPath, cover);

        if (sortedEntries.length === 0) {
          setFont(doc, fontPath, 'regular');
          doc.fontSize(12).fillColor(COLORS.subtitle);
          doc.text('스냅샷에 일기가 없습니다.', PAGE.margin, PAGE.height * 0.5, {
            width: contentWidth(),
            align: 'center',
          });
          stampPageNumbers(doc, fontPath, PAGE);
          doc.end();
          return;
        }

        for (const { year, month } of months) {
          const monthEntries = entriesForMonth(sortedEntries, year, month);
          const entriesByDate = indexEntriesByDate(monthEntries);
          const calendarLayout = buildCalendarMonthLayout({
            year,
            month,
            gridWidth,
            entriesByDate,
          });
          const calendarImages = await loadCalendarCoverImages(calendarLayout);

          doc.addPage();
          drawCalendarMonthPage(doc, calendarLayout, fontPath, calendarImages);

          await renderMonthEntries(doc, monthEntries, fontPath);
        }

        stampPageNumbers(doc, fontPath, PAGE);
        doc.end();
      } catch (error) {
        reject(error);
      }
    })();
  });
}
