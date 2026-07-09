import { DocumentData, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';

/** Flutter AdminConfig.devApiKey 와 동일 */
export const ADMIN_DEV_KEY = process.env.ADMIN_DEV_KEY ?? 'chapter-admin-local-dev';

const ADMIN_EMAIL = 'tangbaboda@gmail.com';

export function assertDevAdminAccess(request: CallableRequest): void {
  const devKey = request.data?.devKey;
  if (typeof devKey === 'string' && devKey === ADMIN_DEV_KEY) {
    return;
  }

  const email = request.auth?.token?.email?.toLowerCase();
  if (email === ADMIN_EMAIL) {
    return;
  }

  throw new HttpsError(
    'permission-denied',
    'Admin dev API 접근 거부. 로그인하거나 devKey를 확인하세요.',
  );
}

export function serializeFirestore(value: unknown): unknown {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeFirestore);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        serializeFirestore(entry),
      ]),
    );
  }
  return value;
}

export function serializeDoc(
  id: string,
  data: DocumentData | undefined,
): Record<string, unknown> {
  const serialized = serializeFirestore(data ?? {}) as Record<string, unknown>;
  return { id, ...serialized };
}

export function db() {
  return getFirestore();
}
