/**
 * Firestore 주문 → fixtures/orders/<orderId>.json 저장
 *
 * 실행: npm run pdf:export-order -- <orderId>
 * (service-account.json 필요 — 집 PC에서 1회)
 */
import fs from 'node:fs';
import path from 'node:path';

import { fetchOrderDocument } from './fetchOrderDocument';
import { readOrderFixturePath } from './generateOrderPdfLocal';

async function main() {
  const orderId = process.argv[2];
  if (!orderId) {
    console.error('사용법: npm run pdf:export-order -- <orderId>');
    process.exit(1);
  }

  const order = await fetchOrderDocument(orderId);

  const fixturePath = readOrderFixturePath(orderId);
  fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
  fs.writeFileSync(fixturePath, JSON.stringify(order, null, 2), 'utf8');

  console.log(`✅ 주문 JSON 저장 완료`);
  console.log(`   ${fixturePath}`);
  console.log('');
  console.log('회사 PC에서 (인증 없이):');
  console.log(`   npm run pdf:order -- ${orderId}`);
}

main().catch((error) => {
  console.error('❌', error.message ?? error);
  process.exit(1);
});
