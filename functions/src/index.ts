import { initializeApp } from 'firebase-admin/app';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

import { generatePdfForOrder } from './orders/generatePdf';
import { seedTestOrder } from './orders/seedTestOrder';

const STORAGE_BUCKET = 'chapter-cc187.firebasestorage.app';

initializeApp({
  storageBucket: STORAGE_BUCKET,
});

/** Firestore에 PDF 테스트용 주문 스냅샷 삽입 */
export const seedTestOrderData = onCall(
  {
    region: 'asia-northeast3',
    invoker: 'public',
  },
  async () => {
    try {
      const result = await seedTestOrder();
      logger.info('테스트 주문 시드 완료', result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpsError('internal', message);
    }
  },
);

/** Admin에서 "PDF 만들기" 클릭 시 호출 */
export const generateOrderPdf = onCall(
  {
    region: 'asia-northeast3',
    timeoutSeconds: 300,
    memory: '1GiB',
    invoker: 'public',
  },
  async (request) => {
    const orderId = request.data?.orderId;
    const force = request.data?.force === true;

    if (typeof orderId !== 'string' || orderId.trim().length === 0) {
      throw new HttpsError('invalid-argument', 'orderId가 필요합니다.');
    }

    try {
      const result = await generatePdfForOrder(orderId.trim(), { force });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('generateOrderPdf 실패', { orderId, message, stack: error instanceof Error ? error.stack : undefined });
      throw new HttpsError('failed-precondition', message, { orderId });
    }
  },
);

/** 입금 확인(status → paid) 시 자동 PDF 생성 */
export const onOrderPaidGeneratePdf = onDocumentUpdated(
  {
    document: 'orders/{orderId}',
    region: 'asia-northeast3',
    timeoutSeconds: 300,
    memory: '1GiB',
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    if (before.status === 'paid' || after.status !== 'paid') return;

    const orderId = event.params.orderId;

    if (after.pdfUrl && after.status === 'pdf_ready') {
      logger.info('이미 PDF가 있음 — 스킵', { orderId });
      return;
    }

    try {
      await generatePdfForOrder(orderId);
    } catch (error) {
      logger.error('onOrderPaidGeneratePdf 실패', {
        orderId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
);
