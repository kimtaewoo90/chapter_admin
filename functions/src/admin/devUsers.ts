import { FieldValue } from 'firebase-admin/firestore';

import { assertDevAdminAccess, db, serializeDoc } from './devApi';

async function collectUserIds(): Promise<Set<string>> {
  const ids = new Set<string>();

  const usersSnap = await db().collection('users').get();
  for (const doc of usersSnap.docs) {
    ids.add(doc.id);
  }

  const ordersSnap = await db().collection('orders').get();
  for (const doc of ordersSnap.docs) {
    const userId = doc.data().userId;
    if (typeof userId === 'string' && userId.length > 0) {
      ids.add(userId);
    }
  }

  const entriesSnap = await db().collectionGroup('entries').limit(1000).get();
  for (const doc of entriesSnap.docs) {
    const userId = doc.ref.parent.parent?.id;
    if (userId) ids.add(userId);
  }

  return ids;
}

export async function listUsersDev(
  request: Parameters<typeof assertDevAdminAccess>[0],
) {
  assertDevAdminAccess(request);

  const ids = await collectUserIds();
  const users = await Promise.all(
    [...ids].map(async (userId) => {
      const doc = await db().collection('users').doc(userId).get();
      return serializeDoc(userId, doc.data());
    }),
  );

  users.sort((a, b) => {
    const aTime = String(a.createdAt ?? '');
    const bTime = String(b.createdAt ?? '');
    return bTime.localeCompare(aTime);
  });

  return { users };
}

export async function getUserOrdersDev(
  request: Parameters<typeof assertDevAdminAccess>[0],
) {
  assertDevAdminAccess(request);

  const userId = request.data?.userId;
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    throw new Error('userId가 필요합니다.');
  }

  const snapshot = await db()
    .collection('orders')
    .where('userId', '==', userId.trim())
    .get();

  const orders = snapshot.docs.map((doc) => serializeDoc(doc.id, doc.data()));
  orders.sort((a, b) =>
    String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')),
  );

  return { orders };
}

export async function updateUserAdminFieldsDev(
  request: Parameters<typeof assertDevAdminAccess>[0],
) {
  assertDevAdminAccess(request);

  const userId = request.data?.userId;
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    throw new Error('userId가 필요합니다.');
  }

  const payload: Record<string, unknown> = {};

  if (typeof request.data?.adminMemo === 'string') {
    payload.adminMemo = request.data.adminMemo;
    payload.adminMemoUpdatedAt = FieldValue.serverTimestamp();
  }

  if (typeof request.data?.disabled === 'boolean') {
    payload.disabled = request.data.disabled;
    payload.disabledUpdatedAt = FieldValue.serverTimestamp();
  }

  if (Object.keys(payload).length === 0) {
    throw new Error('adminMemo 또는 disabled 가 필요합니다.');
  }

  await db().collection('users').doc(userId.trim()).set(payload, { merge: true });
  return { userId: userId.trim() };
}

export async function getUserStatsDev(
  request: Parameters<typeof assertDevAdminAccess>[0],
) {
  assertDevAdminAccess(request);

  const userId = request.data?.userId;
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    throw new Error('userId가 필요합니다.');
  }

  const userRef = db().collection('users').doc(userId.trim());
  const [entriesCount, booksCount] = await Promise.all([
    userRef.collection('entries').count().get(),
    userRef.collection('books').count().get(),
  ]);

  return {
    entries: entriesCount.data().count ?? 0,
    books: booksCount.data().count ?? 0,
  };
}
