import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import PDFDocument from 'pdfkit';

import { planBookPages } from '../layout/engine';
import {
  StickerItem,
  layoutStickerCollage,
} from '../layout/stickerCollage';
import { fitImageSize, prepareImage, PreparedImage } from './imagePrep';
import { PHOTO_FRAME } from './photoStyle';
import { BookPagePlan, DiaryEntry, LayoutPlan } from '../layout/types';

const PAGE = { width: 420, height: 595, margin: 48 };

const NOTO_FONT_URLS = [
  'https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/Korean/NotoSansCJKkr-Regular.otf',
  'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/Korean/NotoSansCJKkr-Regular.otf',
];

const COLORS = {
  title: '#1a1a1a',
  subtitle: '#6b6b6b',
  body: '#2d2d2d',
  muted: '#999999',
  line: '#e8e8e8',
  placeholder: '#cccccc',
  cardBg: '#fafafa',
};

let cachedFontPath: string | null | undefined;

async function ensureKoreanFont(): Promise<string | null> {
  if (cachedFontPath !== undefined) return cachedFontPath;

  const cachePath = path.join(os.tmpdir(), 'chapter-noto-sans-kr.otf');
  if (fs.existsSync(cachePath)) {
    cachedFontPath = cachePath;
    return cachePath;
  }

  for (const url of NOTO_FONT_URLS) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      fs.writeFileSync(cachePath, Buffer.from(await response.arrayBuffer()));
      cachedFontPath = cachePath;
      return cachePath;
    } catch {
      // 다음 URL
    }
  }

  cachedFontPath = null;
  return null;
}

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

function drawPhotoSection(
  doc: PDFKit.PDFDocument,
  entry: DiaryEntry,
  images: Map<number, PreparedImage>,
  fontPath: string | null,
  startY: number,
  usableWidth: number,
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

  for (const placement of collage.placements) {
    const x = PAGE.margin + placement.x;
    const y = startY + placement.y;
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

  return startY + collage.totalHeight;
}

function drawCoverPage(
  doc: PDFKit.PDFDocument,
  bookTitle: string,
  fontPath: string | null,
): void {
  const centerY = PAGE.height * 0.38;

  doc
    .moveTo(PAGE.margin + 40, centerY + 50)
    .lineTo(PAGE.width - PAGE.margin - 40, centerY + 50)
    .strokeColor(COLORS.line)
    .lineWidth(0.5)
    .stroke();

  setFont(doc, fontPath, 'bold');
  doc.fontSize(24).fillColor(COLORS.title);
  doc.text(bookTitle, PAGE.margin, centerY - 20, {
    width: contentWidth(),
    align: 'center',
  });

  setFont(doc, fontPath, 'regular');
  doc.fontSize(11).fillColor(COLORS.subtitle);
  doc.text('Chapter', PAGE.margin, centerY + 64, {
    width: contentWidth(),
    align: 'center',
  });
}

const ENTRY_STYLE = {
  dateSize: 10,
  titleSize: 16,
  bodySize: 11,
  dateGap: 8,
  titleGap: 16,
  dividerGap: 14,
  entryGap: 32,
};

function drawEntryHeader(
  doc: PDFKit.PDFDocument,
  entry: DiaryEntry,
  fontPath: string | null,
  x: number,
  y: number,
  width: number,
): number {
  let cursorY = y;

  if (entry.date) {
    setFont(doc, fontPath, 'regular');
    doc.fontSize(ENTRY_STYLE.dateSize).fillColor(COLORS.muted);
    doc.text(entry.date, x, cursorY, { width });
    cursorY = doc.y + ENTRY_STYLE.dateGap;
  }

  setFont(doc, fontPath, 'bold');
  doc.fontSize(ENTRY_STYLE.titleSize).fillColor(COLORS.title);
  doc.text(entry.title || entry.date, x, cursorY, { width });
  cursorY = doc.y + ENTRY_STYLE.titleGap;

  doc
    .moveTo(x, cursorY)
    .lineTo(x + width, cursorY)
    .strokeColor(COLORS.line)
    .lineWidth(0.5)
    .stroke();

  return cursorY + ENTRY_STYLE.dividerGap;
}

/** 사진·긴 글 */
function drawFullEntry(
  doc: PDFKit.PDFDocument,
  entry: DiaryEntry,
  plan: LayoutPlan,
  fontPath: string | null,
  imageBuffers: Map<number, PreparedImage>,
  startY: number,
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
    );
  }

  if (entry.body.length > 0) {
    setFont(doc, fontPath, 'regular');
    const fontSize = plan.textStyle === 'caption' ? 10 : 11;
    doc.fontSize(fontSize).fillColor(COLORS.body);
    doc.text(entry.body, PAGE.margin, cursorY, {
      width: usableWidth,
      lineGap: plan.textStyle === 'full' ? 6 : 3,
      align: plan.textStyle === 'caption' ? 'center' : 'left',
    });
    cursorY = doc.y + 8;
  }

  return cursorY;
}

/** 짧은 글 — 사진 있는 날과 동일한 헤더 + 본문 */
function drawCompactEntry(
  doc: PDFKit.PDFDocument,
  entry: DiaryEntry,
  fontPath: string | null,
  startY: number,
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
    setFont(doc, fontPath, 'regular');
    doc.fontSize(ENTRY_STYLE.bodySize).fillColor(COLORS.body);
    doc.text(entry.body, PAGE.margin, cursorY, {
      width: usableWidth,
      lineGap: 4,
    });
    cursorY = doc.y + 8;
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

async function renderPage(
  doc: PDFKit.PDFDocument,
  pagePlan: BookPagePlan,
  fontPath: string | null,
): Promise<void> {
  let cursorY = PAGE.margin;

  for (let i = 0; i < pagePlan.items.length; i++) {
    const item = pagePlan.items[i];
    if (i > 0) cursorY += ENTRY_STYLE.entryGap;

    if (item.kind === 'full') {
      const { entry, plan } = item.layout;
      const images = await loadImages(entry);
      cursorY = drawFullEntry(doc, entry, plan, fontPath, images, cursorY);
    } else {
      cursorY = drawCompactEntry(doc, item.layout.entry, fontPath, cursorY);
    }
  }
}

/** 주문 스냅샷 엔트리들로 책 PDF 생성 */
export async function generateBookPdf(
  entries: DiaryEntry[],
  bookTitle: string,
): Promise<Buffer> {
  const fontPath = await ensureKoreanFont();
  const pagePlans = planBookPages(entries);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [PAGE.width, PAGE.height],
      margin: PAGE.margin,
      info: { Title: bookTitle, Author: 'Chapter' },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    void (async () => {
      try {
        drawCoverPage(doc, bookTitle, fontPath);

        if (pagePlans.length === 0) {
          setFont(doc, fontPath, 'regular');
          doc.fontSize(12).fillColor(COLORS.subtitle);
          doc.text('스냅샷에 일기가 없습니다.', PAGE.margin, PAGE.height * 0.5, {
            width: contentWidth(),
            align: 'center',
          });
          doc.end();
          return;
        }

        for (const pagePlan of pagePlans) {
          doc.addPage();
          await renderPage(doc, pagePlan, fontPath);
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    })();
  });
}
