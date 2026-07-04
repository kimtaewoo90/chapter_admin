/** PDF Layout Engine 테스트용 주문 스냅샷 */
export const TEST_ORDER_ID = 'test_order_pdf_001';

const longBody =
  '첫 직장생활 첫날, 설렘과 긴장이 함께했습니다. '.repeat(20);

export function buildTestOrderDocument() {
  return {
    userId: 'test_user_pdf',
    bookId: 'book001',
    bookTitle: '첫 직장생활 (PDF 테스트)',
    amount: 39900,
    status: 'paid',
    shippingAddress: '서울시 강남구 테헤란로 123 (테스트)',
    shippingName: '홍길동 (테스트)',
    shippingPhone: '010-1234-5678',
    paidAt: new Date(),
    createdAt: new Date(),
    snapshot: {
      bookTitle: '첫 직장생활',
      '이름': '홍길동 (테스트)',
      '전화번호': '010-1234-5678',
      entries: [
        {
          date: '2026-03-01',
          title: '3월 1일 — 첫 출근',
          body: longBody,
          photoUrls: ['https://picsum.photos/seed/chapter1/600/400'],
        },
        {
          date: '2026-03-15',
          title: '3월 15일 — 팀 회식',
          body: '팀 회식 첫 참석. 분위기 좋았다.',
          photoUrls: [
            'https://picsum.photos/seed/chapter2/400/300',
            'https://picsum.photos/seed/chapter3/400/300',
            'https://picsum.photos/seed/chapter4/400/300',
            'https://picsum.photos/seed/chapter5/400/300',
          ],
        },
        {
          date: '2026-03-20',
          title: '3월 20일 — 글만',
          body: '사진 없이 기록만 남기는 날. 오늘은 조용히 퇴근했다.',
          photoUrls: [],
        },
      ],
    },
  };
}
