import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import PDFDocument from 'pdfkit';

import { decideLayout } from '../layout/engine';
import { DiaryEntry, LayoutPlan } from '../layout/types';

const PAGE = { width: 420, height: 595, margin: 40 }; // A5-ish (pt)

const NOTO_FONT_URL =
  'https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/Korean/NotoSansCJKkr-Regular.otf';

let cachedFontPath: string | null = null;

async function ensureKoreanFont(): Promise<string | null> {
  if (cachedFontPath && fs.existsSync(cachedFontPath)) {
    return cachedFontPath;
  }

  const fontPath = path.join(os.tmpdir(), 'chapter-noto-sans-kr.otf');
  if (fs.existsSync(fontPath)) {
    cachedFontPath = fontPath;
    return fontPath;
  }

  try {
    const response = await fetch(NOTO_FONT_URL);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(fontPath, buffer);
    cachedFontPath = fontPath;
    return fontPath;
  } catch {
    return null;
  }
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

function applyFont(doc: PDFKit.PDFDocument, fontPath: string | null, bold = false) {
  if (fontPath) {
    doc.font(fontPath);
  } else {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
  }
}

function contentWidth(): number {
  return PAGE.width - PAGE.margin * 2;
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

  applyFont(doc, fontPath, true);
  doc.fontSize(14).fillColor('#222222');
  doc.text(entry.title || entry.date, PAGE.margin, cursorY, { width: usableWidth });
  cursorY = doc.y + 8;

  if (entry.date && entry.title !== entry.date) {
    applyFont(doc, fontPath);
    doc.fontSize(9).fillColor('#888888');
    doc.text(entry.date, PAGE.margin, cursorY, { width: usableWidth });
    cursorY = doc.y + 12;
  } else {
    cursorY += 4;
  }

  const photoAreaHeight = plan.type === 'text-only' ? 0 : 220;
  const gap = 10;

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
      doc.roundedRect(x, y, width, cellHeight, 4).stroke('#dddddd');

      if (buffer) {
        try {
          doc.image(buffer, x + 2, y + 2, {
            fit: [width - 4, cellHeight - 4],
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

    cursorY += photoAreaHeight + 16;
  }

  if (entry.body.length > 0) {
    applyFont(doc, fontPath);
    const fontSize =
      plan.textStyle === 'caption' ? 10 : plan.textStyle === 'short' ? 11 : 11;
    doc.fontSize(fontSize).fillColor('#333333');
    doc.text(entry.body, PAGE.margin, cursorY, {
      width: usableWidth,
      lineGap: plan.textStyle === 'full' ? 4 : 2,
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
  applyFont(doc, fontPath);
  doc.fontSize(9).fillColor('#bbbbbb');
  doc.text('사진', x, y + height / 2 - 6, { width, align: 'center' });
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
        applyFont(doc, fontPath, true);
        doc.fontSize(22).fillColor('#111111');
        doc.text(bookTitle, { align: 'center' });
        doc.moveDown(2);

        if (entries.length === 0) {
          applyFont(doc, fontPath);
          doc.fontSize(12).fillColor('#666666');
          doc.text('스냅샷에 일기가 없습니다.', { align: 'center' });
          doc.end();
          return;
        }

        for (let i = 0; i < entries.length; i++) {
          if (i > 0) doc.addPage();

          const entry = entries[i];
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
