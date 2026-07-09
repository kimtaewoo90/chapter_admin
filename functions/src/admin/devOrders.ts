import { FieldValue } from 'firebase-admin/firestore';

import { assertDevAdminAccess, db, serializeDoc } from './devApi';

export async function listOrdersDev(
  request: Parameters<typeof assertDevAdminAccess>[0],
) {
  assertDevAdminAccess(request);

  const snapshot = await db()
    .collection('orders')
    .orderBy('createdAt', 'desc')
    .get();

  return {
    orders: snapshot.docs.map((doc) => serializeDoc(doc.id, doc.data())),
  };
}

export async function updateOrderDev(
  request: Parameters<typeof assertDevAdminAccess>[0],
) {
  assertDevAdminAccess(request);

  const orderId = request.data?.orderId;
  const action = request.data?.action;

  if (typeof orderId !== 'string' || orderId.trim().length === 0) {
    throw new Error('orderId가 필요합니다.');
  }

  const ref = db().collection('orders').doc(orderId.trim());

  if (action === 'confirmPayment') {
    await ref.update({
      status: 'paid',
      paidAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { orderId, status: 'paid' };
  }

  const status = request.data?.status;
  if (typeof status !== 'string' || status.trim().length === 0) {
    throw new Error('action 또는 status가 필요합니다.');
  }

  await ref.update({
    status: status.trim(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { orderId, status: status.trim() };
}
