/**
 * PDF 월간 캘린더 페이지
 */

import { fitImageSize, PreparedImage } from './imagePrep';
import {
  CALENDAR_COLORS,
  CALENDAR_HEADER,
  CALENDAR_PAGE,
  CALENDAR_WEEKDAYS,
  CalendarMonthLayout,
  calendarBlockStartY,
  calendarGridOriginX,
  calendarHeaderHeight,
} from './calendarLayout';

const STYLE = {
  weekdaySize: 9,
  dayNumSize: 7,
  dayEntrySize: 8,
  moodSize: 12,
  cellRadius: 5,
  photoRadius: 4,
};

function contentWidth(): number {
  return CALENDAR_PAGE.width - CALENDAR_PAGE.margin * 2;
}

function setFont(
  doc: PDFKit.PDFDocument,
  fontPath: string | null,
  weight: 'regular' | 'bold',
): void {
  if (fontPath) doc.font(fontPath);
  else doc.font(weight === 'bold' ? 'Helvetica-Bold' : 'Helvetica');
}

function drawEntryCellBackground(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  doc
    .roundedRect(x, y, w, h, STYLE.cellRadius)
    .fillColor(CALENDAR_COLORS.cellHasEntry)
    .fill()
    .lineWidth(0.5)
    .strokeColor(CALENDAR_COLORS.cellBorderEntry)
    .stroke();
}

function drawCoverPhoto(
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
  doc.roundedRect(imgX, imgY, fitted.width, fitted.height, STYLE.photoRadius).clip();
  doc.image(prepared.buffer, imgX, imgY, { width: fitted.width });
  doc.restore();
}

export function drawCalendarMonthPage(
  doc: PDFKit.PDFDocument,
  layout: CalendarMonthLayout,
  fontPath: string | null,
  images: Map<string, PreparedImage> = new Map(),
): void {
  const usableW = contentWidth();
  const blockY = calendarBlockStartY(layout.totalGridHeight);
  const headerH = calendarHeaderHeight();
  const gridStartY = blockY + headerH;
  const gridX = calendarGridOriginX(layout);

  doc.rect(0, 0, CALENDAR_PAGE.width, CALENDAR_PAGE.height).fill(CALENDAR_COLORS.paper);

  setFont(doc, fontPath, 'bold');
  doc.fontSize(CALENDAR_HEADER.titleSize).fillColor(CALENDAR_COLORS.ink);
  doc.text(layout.monthLabel, CALENDAR_PAGE.margin, blockY, {
    width: usableW,
    align: 'center',
  });

  const weekdayY = blockY + CALENDAR_HEADER.titleSize + CALENDAR_HEADER.titleBottomGap;
  const colW = usableW / 7;
  setFont(doc, fontPath, 'regular');
  doc.fontSize(STYLE.weekdaySize).fillColor(CALENDAR_COLORS.inkMuted);
  for (let c = 0; c < 7; c++) {
    doc.text(CALENDAR_WEEKDAYS[c], CALENDAR_PAGE.margin + colW * c, weekdayY, {
      width: colW,
      align: 'center',
    });
  }

  const gap = layout.gap;
  const cellW = layout.cellWidth;
  const innerPad = layout.innerPad;

  for (let row = 0; row < layout.rowCount; row++) {
    const rowY = gridStartY + row * (layout.rowHeight + gap);

    for (let col = 0; col < 7; col++) {
      const cell = layout.cells[row * 7 + col];
      if (!cell?.day) continue;

      const cellX = gridX + col * (cellW + gap);

      if (!cell.hasEntry) {
        setFont(doc, fontPath, 'regular');
        doc.fontSize(STYLE.dayNumSize).fillColor(CALENDAR_COLORS.dayEmpty);
        doc.text(String(cell.day), cellX + 1, rowY + 1, {
          width: cellW - 2,
          align: 'left',
        });
        continue;
      }

      drawEntryCellBackground(doc, cellX, rowY, cellW, layout.rowHeight);

      setFont(doc, fontPath, 'regular');
      doc.fontSize(STYLE.dayEntrySize).fillColor(CALENDAR_COLORS.ink);
      doc.text(String(cell.day), cellX + innerPad, rowY + innerPad, {
        width: cellW - innerPad * 2,
      });

      const photoX = cellX + innerPad;
      const photoY = rowY + innerPad + layout.dateRowHeight;
      const photoW = cellW - innerPad * 2;
      const photoH = layout.photoHeight;

      if (cell.coverPhotoUrl && images.has(cell.coverPhotoUrl)) {
        drawCoverPhoto(
          doc,
          images.get(cell.coverPhotoUrl)!,
          photoX,
          photoY,
          photoW,
          photoH,
        );
      } else if (cell.moodEmoji) {
        doc.fontSize(STYLE.moodSize).fillColor(CALENDAR_COLORS.ink);
        doc.text(cell.moodEmoji, photoX, photoY + photoH * 0.2, {
          width: photoW,
          align: 'center',
        });
      }
    }
  }
}

export { CALENDAR_PAGE as CALENDAR_PAGE_SPEC };
