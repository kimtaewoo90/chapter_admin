/**
 * 로컬 JSON 파일로 PDF 생성
 *
 * 실행: npm run pdf:order-file -- <json경로> <스타일번호>
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  generatePdfFromOrderDocument,
  logOrderPdfMeta,
} from './generateOrderPdfLocal';
import { parseBodyStyleArg, printPdfStyleUsage } from './pdfStyleCli';

async function main() {
  const fileArg = process.argv[2];
  const styleArg = process.argv[3];

  if (!fileArg) {
    console.error('사용법: npm run pdf:order-file -- <json파일경로> <스타일번호>');
    console.error('');
    printPdfStyleUsage('pdf:order-file');
    process.exit(1);
  }

  let bodyStyle;
  try {
    bodyStyle = parseBodyStyleArg(styleArg);
  } catch (error) {
    console.error('❌', (error as Error).message);
    printPdfStyleUsage('pdf:order-file');
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(filePath)) {
    throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
  }

  const order = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  const baseName = path.basename(filePath, '.json');

  console.log(`📂 JSON: ${filePath}`);
  const result = await generatePdfFromOrderDocument(baseName, order, { bodyStyle });
  logOrderPdfMeta(baseName, order, result);
}

main().catch((error) => {
  console.error('❌', error.message ?? error);
  process.exit(1);
});
