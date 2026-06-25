import { getFirestore, FieldValue } from 'firebase-admin/firestore';

import { buildTestOrderDocument, TEST_ORDER_ID } from './testOrderData';

export async function seedTestOrder(): Promise<{ orderId: string }> {
  const db = getFirestore();
  await db.collection('orders').doc(TEST_ORDER_ID).set({
    ...buildTestOrderDocument(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { orderId: TEST_ORDER_ID };
}
