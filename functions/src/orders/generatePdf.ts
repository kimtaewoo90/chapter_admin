import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';

import { parseSnapshotEntries } from '../layout/engine';
import { generateBookPdf } from '../pdf/generator';

export interface GeneratePdfResult {
  orderId: string;
  pdfUrl: string;
  entryCount: number;
}

/** 주문 ID로 PDF 생성 → Storage 업로드 → Firestore 업데이트 */
export async function generatePdfForOrder(
  orderId: string,
): Promise<GeneratePdfResult> {
  const db = getFirestore();
  const orderRef = db.collection('orders').doc(orderId);
  const orderSnap = await orderRef.get();

  if (!orderSnap.exists) {
    throw new Error(`주문을 찾을 수 없습니다: ${orderId}`);
  }

  const order = orderSnap.data()!;

  if (order.pdfStatus === 'generating') {
    throw new Error('이미 PDF 생성 중입니다.');
  }

  const snapshot = order.snapshot as Record<string, unknown> | undefined;
  const entries = parseSnapshotEntries(snapshot);

  if (entries.length === 0) {
    throw new Error('주문 스냅샷에 일기(entries)가 없습니다.');
  }

  await orderRef.update({
    pdfStatus: 'generating',
    updatedAt: FieldValue.serverTimestamp(),
  });

  const bookTitle = String(
    order.bookTitle ?? order.title ?? snapshot?.bookTitle ?? 'Chapter Book',
  );

  logger.info('PDF 생성 시작', { orderId, entryCount: entries.length });

  const pdfBuffer = await generateBookPdf(entries, bookTitle);

  const bucket = getStorage().bucket();
  const storagePath = `pdfs/${orderId}.pdf`;
  const file = bucket.file(storagePath);

  await file.save(pdfBuffer, {
    metadata: {
      contentType: 'application/pdf',
      metadata: { orderId, generatedAt: new Date().toISOString() },
    },
  });

  await file.makePublic().catch(() => {
    logger.warn('PDF public 설정 실패 — signed URL 사용', { orderId });
  });

  const pdfUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

  await orderRef.update({
    status: 'pdf_ready',
    pdfStatus: 'ready',
    pdfUrl,
    pdfGeneratedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.info('PDF 생성 완료', { orderId, pdfUrl });

  return { orderId, pdfUrl, entryCount: entries.length };
}
