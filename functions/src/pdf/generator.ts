import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import PDFDocument from 'pdfkit';

import { decideLayout } from '../layout/engine';
import { DiaryEntry, LayoutPlan } from '../layout/types';

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
};

let cachedFontPath: string | null | undefined;

/** Noto Sans CJK KR — 한글 PDF용 (최초 1회 다운로드 후 캐시) */
async function ensureKoreanFont(): Promise<string | null> {
  if (cachedFontPath !== undefined) {
    return cachedFontPath;
  }

  const cachePath = path.join(os.tmpdir(), 'chapter-noto-sans-kr.otf');
  if (fs.existsSync(cachePath)) {
    cachedFontPath = cachePath;
    return cachePath;
  }

  for (const url of NOTO_FONT_URLS) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(cachePath, buffer);
      cachedFontPath = cachePath;
      return cachePath;
    } catch {
      // 다음 URL 시도
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
  if (fontPath) {
    doc.font(fontPath);
  } else {
    doc.font(weight === 'bold' ? 'Helvetica-Bold' : 'Helvetica');
  }
}

function contentWidth(): number {
  return PAGE.width - PAGE.margin * 2;
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

function drawEntryPage(
  doc: PDFKit.PDFDocument,
  entry: DiaryEntry,
  plan: LayoutPlan,
  fontPath: string | null,
  imageBuffers: Map<number, Buffer>,
): void {
  const usableWidth = contentWidth();
  let cursorY = PAGE.margin;

  if (entry.date) {
    setFont(doc, fontPath, 'regular');
    doc.fontSize(10).fillColor(COLORS.muted);
    doc.text(entry.date, PAGE.margin, cursorY, { width: usableWidth });
    cursorY = doc.y + 10;
  }

  setFont(doc, fontPath, 'bold');
  doc.fontSize(16).fillColor(COLORS.title);
  doc.text(entry.title || entry.date, PAGE.margin, cursorY, { width: usableWidth });
  cursorY = doc.y + 20;

  doc
    .moveTo(PAGE.margin, cursorY)
    .lineTo(PAGE.width - PAGE.margin, cursorY)
    .strokeColor(COLORS.line)
    .lineWidth(0.5)
    .stroke();
  cursorY += 16;

  const photoAreaHeight = plan.type === 'text-only' ? 0 : 200;
  const gap = 8;

  if (plan.photoSlots.length > 0) {
    const cellWidth =
      (usableWidth - gap * (plan.gridColumns - 1)) / plan.gridColumns;
    const cellHeight =
      (photoAreaHeight - gap * (plan.gridRows - 1)) / plan.gridRows;

    for (const slot of plan.photoSlots) {
      const x = PAGE.margin + slot.col * (cellWidth + gap);
      const y = cursorY + slot.row * (cellHeight + gap);
      const width = cellWidth * slot.colSpan + gap * (slot.colSpan - 1);
      const buffer = imageBuffers.get(slot.index);

      doc.save();
      doc.roundedRect(x, y, width, cellHeight, 6).fill('#fafafa');
      doc.roundedRect(x, y, width, cellHeight, 6).stroke(COLORS.line);

      if (buffer) {
        try {
          doc.image(buffer, x + 3, y + 3, {
            fit: [width - 6, cellHeight - 6],
            align: 'center',
            valign: 'center',
          });
        } catch {
          drawPlaceholder(doc, x, y, width, cellHeight, fontPath);
        }
      } else {
        drawPlaceholder(doc, x, y, width, cellHeight, fontPath);
      }

      doc.restore();
    }

    cursorY += photoAreaHeight + 20;
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
  }
}

function drawPlaceholder(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  fontPath: string | null,
): void {
  setFont(doc, fontPath, 'regular');
  doc.fontSize(9).fillColor(COLORS.placeholder);
  doc.text('사진', x, y + height / 2 - 5, { width, align: 'center' });
}

/** 주문 스냅샷 엔트리들로 책 PDF 생성 */
export async function generateBookPdf(
  entries: DiaryEntry[],
  bookTitle: string,
): Promise<Buffer> {
  const fontPath = await ensureKoreanFont();

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

        if (entries.length === 0) {
          setFont(doc, fontPath, 'regular');
          doc.fontSize(12).fillColor(COLORS.subtitle);
          doc.text('스냅샷에 일기가 없습니다.', PAGE.margin, PAGE.height * 0.5, {
            width: contentWidth(),
            align: 'center',
          });
          doc.end();
          return;
        }

        for (const entry of entries) {
          doc.addPage();

          const plan = decideLayout(entry);
          const imageBuffers = new Map<number, Buffer>();
          await Promise.all(
            entry.photoUrls.map(async (url, index) => {
              const buffer = await fetchImageBuffer(url);
              if (buffer) imageBuffers.set(index, buffer);
            }),
          );

          drawEntryPage(doc, entry, plan, fontPath, imageBuffers);
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    })();
  });
}
