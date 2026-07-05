import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';

import { parseOrderEntries } from '../layout/engine';
import { generateBookPdf } from '../pdf/generator';

export interface GeneratePdfResult {
  orderId: string;
  pdfUrl: string;
  entryCount: number;
}

const STORAGE_BUCKET = 'chapter-cc187.firebasestorage.app';

/** 이 시간보다 오래 generating 이면 중단된 작업으로 보고 재시도 허용 */
const STALE_GENERATING_MS = 5 * 60 * 1000;

function isStaleGenerating(order: FirebaseFirestore.DocumentData): boolean {
  if (order.pdfStatus !== 'generating') return false;

  const ts = order.pdfGeneratingAt ?? order.updatedAt;
  if (!ts || typeof ts.toDate !== 'function') return true;

  return Date.now() - ts.toDate().getTime() > STALE_GENERATING_MS;
}

/** 주문 ID로 PDF 생성 → Storage 업로드 → Firestore 업데이트 */
export async function generatePdfForOrder(
  orderId: string,
  options: { force?: boolean } = {},
): Promise<GeneratePdfResult> {
  const db = getFirestore();
  const orderRef = db.collection('orders').doc(orderId);
  const orderSnap = await orderRef.get();

  if (!orderSnap.exists) {
    throw new Error(`주문을 찾을 수 없습니다: ${orderId}`);
  }

  const order = orderSnap.data()!;
  const staleGenerating = isStaleGenerating(order);

  if (order.pdfStatus === 'generating' && !options.force && !staleGenerating) {
    throw new Error(
      '이미 PDF 생성 중입니다. 1~2분 후 다시 시도하거나 PDF 재시도를 눌러주세요.',
    );
  }

  if (staleGenerating) {
    logger.warn('PDF generating 상태가 오래됨 — 재시도 허용', { orderId });
  }

  const snapshot = order.snapshot as Record<string, unknown> | undefined;
  const entries = parseOrderEntries(order);

  if (entries.length === 0) {
    throw new Error(
      '주문 스냅샷에 일기가 없습니다. snapshot.entries 또는 snapshots 필드를 확인하세요.',
    );
  }

  await orderRef.update({
    pdfStatus: 'generating',
    pdfGeneratingAt: FieldValue.serverTimestamp(),
    pdfError: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  try {
    const bookTitle = String(
      order.bookTitle ?? order.title ?? snapshot?.bookTitle ?? 'Chapter Book',
    );

    const diaryFontId =
      typeof order.diaryFontId === 'string' ? order.diaryFontId : undefined;

    const cover = {
      coverType: typeof order.cover === 'string' ? order.cover : 'chapter_icon',
      coverPhotoUrl:
        typeof order.coverPhotoUrl === 'string' ? order.coverPhotoUrl : undefined,
      coverTitle:
        typeof order.coverTitle === 'string' ? order.coverTitle : undefined,
    };

    logger.info('PDF 생성 시작', {
      orderId,
      entryCount: entries.length,
      diaryFontId,
      coverType: cover.coverType,
    });

    const pdfBuffer = await generateBookPdf(entries, bookTitle, { diaryFontId, cover });

    const bucket = getStorage().bucket(STORAGE_BUCKET);
    const storagePath = `pdfs/${orderId}.pdf`;
    const file = bucket.file(storagePath);

    await file.save(pdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
        cacheControl: 'no-cache, max-age=0',
        metadata: { orderId, generatedAt: new Date().toISOString() },
      },
    });

    const version = Date.now();
    let pdfUrl: string;
    try {
      await file.makePublic();
      pdfUrl = `https://storage.googleapis.com/${STORAGE_BUCKET}/${storagePath}?v=${version}`;
    } catch (publicError) {
      logger.warn('PDF public 설정 실패 — signed URL 사용', {
        orderId,
        error: publicError,
      });
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: '03-01-2030',
      });
      pdfUrl = `${signedUrl}${signedUrl.includes('?') ? '&' : '?'}v=${version}`;
    }

    await orderRef.update({
      status: 'pdf_ready',
      pdfStatus: 'ready',
      pdfUrl,
      pdfGeneratedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('PDF 생성 완료', { orderId, pdfUrl });

    return { orderId, pdfUrl, entryCount: entries.length };
  } catch (error) {
    await orderRef.update({
      pdfStatus: 'failed',
      pdfError: error instanceof Error ? error.message : String(error),
      updatedAt: FieldValue.serverTimestamp(),
    });
    throw error;
  }
}
