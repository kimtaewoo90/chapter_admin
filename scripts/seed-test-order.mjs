/**
 * Firestore에 PDF 테스트용 주문 스냅샷을 넣습니다.
 * Firebase Functions seedTestOrderData 호출 (배포 후)
 *
 * 실행: node scripts/seed-test-order.mjs
 */

const REGION = 'asia-northeast3';
const PROJECT_ID = 'chapter-cc187';

async function seedViaFunction() {
  const url = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/seedTestOrderData`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: {} }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`seedTestOrderData failed (${response.status}): ${text}`);
  }

  const result = JSON.parse(text);
  console.log('✅ 테스트 주문 시드 완료:', result.result ?? result);
  console.log('   주문 ID: test_order_pdf_001');
  console.log('   Admin 결제상황 → PDF 만들기 로 테스트하세요.');
}

seedViaFunction().catch((error) => {
  console.error('❌', error.message);
  console.error('');
  console.error('Functions 배포 후 다시 실행하세요:');
  console.error('  npx firebase-tools deploy --only functions');
  console.error('  node scripts/seed-test-order.mjs');
  process.exit(1);
});
