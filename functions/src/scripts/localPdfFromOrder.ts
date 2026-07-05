/**
 * Firestore 주문 ID로 PDF 로컬 생성
 *
 * 실행: npm run pdf:order -- <orderId>
 */
import { execSync } from 'node:child_process';
import path from 'node:path';

import { parseOrderEntries } from '../layout/engine';
import { generateBookPdf } from '../pdf/generator';
import { decodeFirestoreDocument } from './firestoreRest';
import { writeOutputPdf } from './writeOutputPdf';

const PROJECT_ID = 'chapter-cc187';
const API_KEY = 'AIzaSyB7TS-Fk60oI_-HR7aYvXE0k0nNYha41ww';

async function fetchOrder(orderId: string): Promise<Record<string, unknown>> {
  const url =
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}` +
    `/databases/(default)/documents/orders/${orderId}?key=${API_KEY}`;

  try {
    const response = await fetch(url);
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Firestore 조회 실패 (${response.status}): ${text}`);
    }
    return decodeFirestoreDocument(JSON.parse(text));
  } catch {
    // Windows 회사망 SSL 이슈 — curl fallback
    const json = execSync(`curl.exe --ssl-no-revoke -s "${url}"`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    const parsed = JSON.parse(json);
    if (parsed.error) {
      throw new Error(parsed.error.message ?? JSON.stringify(parsed.error));
    }
    return decodeFirestoreDocument(parsed);
  }
}

async function main() {
  const orderId = process.argv[2];
  if (!orderId) {
    console.error('사용법: npm run pdf:order -- <orderId>');
    process.exit(1);
  }

  console.log(`🔍 주문 조회: orders/${orderId}`);
  const order = await fetchOrder(orderId);
  const entries = parseOrderEntries(order);

  if (entries.length === 0) {
    throw new Error('주문에 snapshots / snapshot.entries가 없습니다.');
  }

  const snapshot = order.snapshot as Record<string, unknown> | undefined;
  const bookTitle = String(
    order.bookTitle ?? order.title ?? snapshot?.bookTitle ?? 'Chapter Book',
  );

  console.log(`📖 ${bookTitle}`);
  console.log(`📝 일기 ${entries.length}개 → PDF 생성 중...`);

  const diaryFontId =
    typeof order.diaryFontId === 'string' ? order.diaryFontId : undefined;
  const cover = {
    coverType: typeof order.cover === 'string' ? order.cover : 'chapter_icon',
    coverPhotoUrl:
      typeof order.coverPhotoUrl === 'string' ? order.coverPhotoUrl : undefined,
    coverTitle: typeof order.coverTitle === 'string' ? order.coverTitle : undefined,
  };
  if (diaryFontId) {
    console.log(`🔤 일기 폰트: ${diaryFontId}`);
  }
  console.log(`🎨 표지: ${cover.coverType}${cover.coverTitle ? ` · ${cover.coverTitle}` : ''}`);

  const pdfBuffer = await generateBookPdf(entries, bookTitle, { diaryFontId, cover });

  const outDir = path.join(__dirname, '..', '..', 'output');
  const outPath = writeOutputPdf(
    path.join(outDir, `${orderId}.pdf`),
    pdfBuffer,
  );

  console.log(`✅ PDF 생성 완료!`);
  console.log(`   ${outPath}`);
  console.log(`   크기: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);
}

main().catch((error) => {
  console.error('❌', error.message ?? error);
  process.exit(1);
});
