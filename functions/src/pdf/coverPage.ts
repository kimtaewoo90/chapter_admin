import fs from 'node:fs';
import path from 'node:path';

import { DiaryEntry } from '../layout/types';
import { fitImageSize, prepareImage, PreparedImage } from './imagePrep';

const PAGE = { width: 420, height: 595 };

/** `generator.ts` PDFDocument margin — text()는 이 안쪽만 씀 */
const DOC_MARGIN = 48;

const COVER_STYLE = {
  padding: 28,
  /** 속지(#F5F0E8)보다 한 톤 진한 린넨 — 하드커버 느낌 */
  paper: '#E6DCC8',
  border: '#D4C8B4',
  ink: '#2C2824',
  inkMuted: '#6B6560',
  titleSize: 15,
  dateSize: 11,
  titleGap: 12,
  dateGap: 10,
  bottomPad: 6,
  horizontalScale: 1.25,
  wordmarkAspect: 737 / 324,
} as const;

const COVER_TYPE = {
  chapterIcon: 'chapter_icon',
  customPhoto: 'custom_photo',
} as const;

export interface BookCoverOptions {
  coverType?: string;
  coverPhotoUrl?: string;
  coverTitle?: string;
  dateRangeLabel?: string;
}

let cachedWordmark: PreparedImage | null | undefined;

function setFont(
  doc: PDFKit.PDFDocument,
  fontPath: string | null,
  weight: 'regular' | 'bold',
): void {
  if (fontPath) doc.font(fontPath);
  else doc.font(weight === 'bold' ? 'Helvetica-Bold' : 'Helvetica');
}

function wordmarkAssetPath(): string {
  const candidates = [
    path.join(__dirname, '..', '..', 'assets', 'images', 'app_icon_foreground.png'),
    path.join(process.cwd(), 'assets', 'images', 'app_icon_foreground.png'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

async function loadWordmark(): Promise<PreparedImage | null> {
  if (cachedWordmark !== undefined) return cachedWordmark;

  const assetPath = wordmarkAssetPath();
  if (!fs.existsSync(assetPath)) {
    cachedWordmark = null;
    return null;
  }

  const raw = fs.readFileSync(assetPath);
  cachedWordmark = await prepareImage(raw);
  return cachedWordmark;
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

/** 앱 `bookCoverDateRangeLabel` — yyyy.MM - yyyy.MM */
export function formatCoverDateRange(entries: DiaryEntry[]): string {
  if (entries.length === 0) return '';

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const fmt = (date: string) => {
    const match = /^(\d{4})-(\d{2})/.exec(date.trim());
    return match ? `${match[1]}.${match[2]}` : date;
  };

  const first = fmt(sorted[0].date);
  const last = fmt(sorted[sorted.length - 1].date);
  return first === last ? first : `${first} - ${last}`;
}

function fitWordmarkHeight(
  maxWidth: number,
  maxHeight: number,
  hasTitle: boolean,
): number {
  if (maxWidth <= 0 || maxHeight <= 0) return 56;

  const heightRatio = hasTitle ? 0.56 : 0.62;
  const maxCap = hasTitle ? 100 : 112;
  const heightCap = Math.min(maxHeight * heightRatio, maxCap);
  const widthCap = maxWidth / (COVER_STYLE.wordmarkAspect * COVER_STYLE.horizontalScale);
  return Math.max(48, Math.min(Math.min(heightCap, widthCap), 128));
}

function fitPhotoSize(
  maxWidth: number,
  maxHeight: number,
  hasTitle: boolean,
): number {
  if (maxWidth <= 0 || maxHeight <= 0) return 100;

  const cap = Math.min(maxWidth, maxHeight);
  const ratio = hasTitle ? 0.42 : 0.48;
  const maxPx = hasTitle ? 132 : 148;
  return Math.max(68, Math.min(cap * ratio, maxPx));
}

function drawRoundedCoverPhoto(
  doc: PDFKit.PDFDocument,
  prepared: PreparedImage,
  x: number,
  y: number,
  size: number,
): void {
  const fitted = fitImageSize(prepared, size, size);
  const imgX = x + (size - fitted.width) / 2;
  const imgY = y + (size - fitted.height) / 2;
  const radius = size * 0.1;

  doc.save();
  doc.roundedRect(x, y, size, size, radius).clip();
  doc.image(prepared.buffer, imgX, imgY, { width: fitted.width, height: fitted.height });
  doc.restore();
}

/** 앱 `BookCoverArtwork`와 동일한 표지 페이지 */
export async function drawCoverPage(
  doc: PDFKit.PDFDocument,
  fontPath: string | null,
  cover: BookCoverOptions,
): Promise<void> {
  const padding = COVER_STYLE.padding;
  const innerW = PAGE.width - padding * 2;
  const contentBottom = PAGE.height - DOC_MARGIN;

  doc.rect(0, 0, PAGE.width, PAGE.height).fill(COVER_STYLE.paper);
  doc
    .rect(padding, padding, innerW, PAGE.height - padding * 2)
    .lineWidth(0.8)
    .strokeColor(COVER_STYLE.border)
    .stroke();

  const titleText = cover.coverTitle?.trim() ?? '';
  const hasTitle = titleText.length > 0;
  const dateRangeLabel = cover.dateRangeLabel?.trim() ?? '';
  const showDate = dateRangeLabel.length > 0;

  const dateLineH = COVER_STYLE.dateSize * 1.35;
  const titleLineH = COVER_STYLE.titleSize * 1.25;

  // 아래에서 위로 — PDFKit 하단 margin 안에 날짜·제목 고정
  let layoutBottom = contentBottom - COVER_STYLE.bottomPad;

  let dateY = 0;
  if (showDate) {
    dateY = layoutBottom - dateLineH;
    layoutBottom = dateY - COVER_STYLE.dateGap;
  }

  let titleY = 0;
  if (hasTitle) {
    titleY = layoutBottom - titleLineH * 2;
    layoutBottom = titleY - COVER_STYLE.titleGap;
  }

  const centerTop = padding;
  const centerBottom = layoutBottom;
  const maxCenterH = Math.max(0, centerBottom - centerTop);
  const maxCenterW = innerW;

  const isPhoto =
    cover.coverType === COVER_TYPE.customPhoto && !!cover.coverPhotoUrl?.trim();

  let artworkW = 0;
  let artworkH = 0;

  if (isPhoto) {
    const size = fitPhotoSize(maxCenterW, maxCenterH, hasTitle);
    artworkW = size;
    artworkH = size;
  } else {
    artworkH = fitWordmarkHeight(maxCenterW, maxCenterH, hasTitle);
    artworkW = artworkH * COVER_STYLE.wordmarkAspect * COVER_STYLE.horizontalScale;
  }

  const centerAnchorY = hasTitle
    ? centerTop + maxCenterH * 0.41
    : centerTop + maxCenterH / 2;
  const artworkX = (PAGE.width - artworkW) / 2;
  const artworkY = centerAnchorY - artworkH / 2;

  if (isPhoto) {
    const raw = await fetchImageBuffer(cover.coverPhotoUrl!.trim());
    if (raw) {
      const prepared = await prepareImage(raw);
      if (prepared) {
        drawRoundedCoverPhoto(doc, prepared, artworkX, artworkY, artworkW);
      } else {
        await drawWordmarkFallback(doc, artworkX, artworkY, artworkW, artworkH);
      }
    } else {
      await drawWordmarkFallback(doc, artworkX, artworkY, artworkW, artworkH);
    }
  } else {
    await drawWordmarkFallback(doc, artworkX, artworkY, artworkW, artworkH);
  }

  if (hasTitle) {
    setFont(doc, fontPath, 'bold');
    doc.fontSize(COVER_STYLE.titleSize).fillColor(COVER_STYLE.ink);
    doc.text(titleText, padding + 6, titleY, {
      width: innerW - 12,
      align: 'center',
      lineGap: 2,
      lineBreak: true,
      height: titleLineH * 2,
    });
  }

  if (showDate) {
    setFont(doc, fontPath, 'regular');
    doc.fontSize(COVER_STYLE.dateSize).fillColor(COVER_STYLE.inkMuted);
    doc.text(dateRangeLabel, padding, dateY, {
      width: innerW,
      align: 'center',
      characterSpacing: 0.5,
      lineBreak: false,
    });
  }
}

async function drawWordmarkFallback(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<void> {
  const wordmark = await loadWordmark();
  if (wordmark) {
    doc.image(wordmark.buffer, x, y, { width, height });
    return;
  }

  setFont(doc, null, 'bold');
  doc.fontSize(28).fillColor(COVER_STYLE.ink);
  doc.text('Chapter', x, y + height * 0.2, { width, align: 'center' });
}
