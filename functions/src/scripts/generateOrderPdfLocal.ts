import path from 'node:path';

import { parseOrderEntries } from '../layout/engine';
import { EntryBodyStyle, setEntryBodyStyle } from '../pdf/bodyStyle';
import { generateBookPdf } from '../pdf/generator';
import { writeOutputPdf } from './writeOutputPdf';

export interface OrderPdfOptions {
  diaryFontId?: string;
  cover?: {
    coverType?: string;
    coverPhotoUrl?: string;
    coverTitle?: string;
    dateRangeLabel?: string;
  };
}

export function readOrderFixturePath(orderId: string): string {
  return path.join(__dirname, '..', '..', 'fixtures', 'orders', `${orderId}.json`);
}

export async function generatePdfFromOrderDocument(
  orderId: string,
  order: Record<string, unknown>,
  pdfOptions: { bodyStyle?: EntryBodyStyle } = {},
): Promise<{
  outPath: string;
  sizeKb: number;
  entryCount: number;
  bookTitle: string;
  bodyStyle: EntryBodyStyle;
}> {
  const entries = parseOrderEntries(order);

  if (entries.length === 0) {
    throw new Error('주문에 snapshots / snapshot.entries가 없습니다.');
  }

  const snapshot = order.snapshot as Record<string, unknown> | undefined;
  const bookTitle = String(
    order.bookTitle ?? order.title ?? snapshot?.bookTitle ?? 'Chapter Book',
  );

  const diaryFontId =
    typeof order.diaryFontId === 'string' ? order.diaryFontId : undefined;
  const cover = {
    coverType: typeof order.cover === 'string' ? order.cover : 'chapter_icon',
    coverPhotoUrl:
      typeof order.coverPhotoUrl === 'string' ? order.coverPhotoUrl : undefined,
    coverTitle: typeof order.coverTitle === 'string' ? order.coverTitle : undefined,
    dateRangeLabel:
      typeof order.coverDateRangeLabel === 'string'
        ? order.coverDateRangeLabel
        : undefined,
  };

  const bodyStyle = pdfOptions.bodyStyle ?? 'marginRail';
  setEntryBodyStyle(bodyStyle);

  const pdfBuffer = await generateBookPdf(entries, bookTitle, {
    diaryFontId,
    cover,
    bodyStyle,
  });

  const outDir = path.join(__dirname, '..', '..', 'output');
  const outPath = writeOutputPdf(
    path.join(outDir, `${orderId}-${bodyStyle}.pdf`),
    pdfBuffer,
  );

  return {
    outPath,
    sizeKb: pdfBuffer.length / 1024,
    entryCount: entries.length,
    bookTitle,
    bodyStyle,
  };
}

export function logOrderPdfMeta(
  orderId: string,
  order: Record<string, unknown>,
  result: Awaited<ReturnType<typeof generatePdfFromOrderDocument>>,
): void {
  const diaryFontId =
    typeof order.diaryFontId === 'string' ? order.diaryFontId : undefined;
  const coverType = typeof order.cover === 'string' ? order.cover : 'chapter_icon';
  const coverTitle =
    typeof order.coverTitle === 'string' ? order.coverTitle : undefined;

  console.log(`📖 ${result.bookTitle}`);
  console.log(`📝 일기 ${result.entryCount}개 → PDF 생성 중...`);
  if (diaryFontId) console.log(`🔤 일기 폰트: ${diaryFontId}`);
  console.log(
    `🎨 표지: ${coverType}${coverTitle ? ` · ${coverTitle}` : ''}`,
  );
  console.log(`📐 본문 스타일: ${result.bodyStyle}`);
  console.log(`✅ PDF 생성 완료!`);
  console.log(`   ${result.outPath}`);
  console.log(`   크기: ${result.sizeKb.toFixed(1)} KB`);
}
