/**
 * Firestore 주문 ID로 PDF 로컬 생성
 *
 * 실행:
 *   npm run pdf:order -- <orderId> <스타일번호>
 *
 * 데이터 소스 (우선순위):
 *   1) fixtures/orders/<orderId>.json  (인증 불필요 — 회사 PC OK)
 *   2) Firestore Admin SDK              (service-account.json 필요)
 */
import fs from 'node:fs';

import { parseOrderEntries } from '../layout/engine';

import { fetchOrderDocument } from './fetchOrderDocument';
import { generatePdfFromOrderDocument, readOrderFixturePath } from './generateOrderPdfLocal';
import { logBodyStyleSelection, parseBodyStyleArg, printPdfStyleUsage } from './pdfStyleCli';

function loadLocalFixture(orderId: string): Record<string, unknown> | null {
  const fixturePath = readOrderFixturePath(orderId);
  if (!fs.existsSync(fixturePath)) return null;

  console.log(`📂 로컬 JSON 사용: ${fixturePath}`);
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as Record<string, unknown>;
}

async function main() {
  const orderId = process.argv[2];
  const styleArg = process.argv[3];

  if (!orderId) {
    console.error('사용법: npm run pdf:order -- <orderId> <스타일번호>');
    console.error('');
    printPdfStyleUsage('pdf:order');
    process.exit(1);
  }

  let bodyStyle;
  try {
    bodyStyle = parseBodyStyleArg(styleArg);
  } catch (error) {
    console.error('❌', (error as Error).message);
    printPdfStyleUsage('pdf:order');
    process.exit(1);
  }

  console.log(`🔍 주문 조회: orders/${orderId}`);
  logBodyStyleSelection(bodyStyle, styleArg);

  const order =
    loadLocalFixture(orderId) ?? (await fetchOrderDocument(orderId));

  const snapshot = order.snapshot as Record<string, unknown> | undefined;
  const bookTitle = String(
    order.bookTitle ?? order.title ?? snapshot?.bookTitle ?? 'Chapter Book',
  );
  const entries = parseOrderEntries(order);
  if (entries.length === 0) {
    throw new Error('주문에 snapshots / snapshot.entries가 없습니다.');
  }

  console.log(`📖 ${bookTitle}`);
  console.log(`📝 일기 ${entries.length}개 → PDF 생성 중...`);
  if (typeof order.diaryFontId === 'string') {
    console.log(`🔤 일기 폰트: ${order.diaryFontId}`);
  }
  const coverTitle =
    typeof order.coverTitle === 'string' ? order.coverTitle : undefined;
  const coverType = typeof order.cover === 'string' ? order.cover : 'chapter_icon';
  console.log(`🎨 표지: ${coverType}${coverTitle ? ` · ${coverTitle}` : ''}`);

  const result = await generatePdfFromOrderDocument(orderId, order, { bodyStyle });

  console.log(`✅ PDF 생성 완료!`);
  console.log(`   ${result.outPath}`);
  console.log(`   크기: ${result.sizeKb.toFixed(1)} KB`);
}

main().catch((error) => {
  console.error('❌', error.message ?? error);
  process.exit(1);
});
