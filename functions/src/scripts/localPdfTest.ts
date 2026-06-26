/**
 * Firebase 배포 없이 Layout Engine + PDF 생성 로컬 테스트
 *
 * 실행: npm run pdf:local
 * 결과: output/sample.pdf
 */
import path from 'node:path';

import { parseSnapshotEntries } from '../layout/engine';
import { generateBookPdf } from '../pdf/generator';
import { buildTestOrderDocument } from '../orders/testOrderData';
import { writeOutputPdf } from './writeOutputPdf';

async function main() {
  const order = buildTestOrderDocument();
  const snapshot = order.snapshot as Record<string, unknown>;
  const entries = parseSnapshotEntries(snapshot);

  console.log(`📖 책: ${order.bookTitle}`);
  console.log(`📝 일기 ${entries.length}개 → PDF 생성 중...`);

  const pdfBuffer = await generateBookPdf(entries, order.bookTitle);

  const outDir = path.join(__dirname, '..', '..', 'output');
  const outPath = writeOutputPdf(path.join(outDir, 'sample.pdf'), pdfBuffer);

  console.log(`✅ PDF 생성 완료!`);
  console.log(`   ${outPath}`);
  console.log(`   크기: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);
  console.log('');
  console.log('파일을 열어서 레이아웃을 확인하세요:');
  console.log('  - 3/1  사진1 + 긴글  → 세로 배치');
  console.log('  - 3/15 사진4 + 짧은글 → 2x2 그리드');
  console.log('  - 3/20 글만          → 텍스트만');
}

main().catch((error) => {
  console.error('❌ PDF 생성 실패:', error);
  process.exit(1);
});
