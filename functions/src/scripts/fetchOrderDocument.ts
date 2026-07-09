import { execSync } from 'node:child_process';

import { GoogleAuth } from 'google-auth-library';
import { getFirestore } from 'firebase-admin/firestore';

import { decodeFirestoreDocument } from './firestoreRest';
import { ensureLocalAdminApp, resolveServiceAccountPath } from './localAdmin';

const PROJECT_ID = 'chapter-cc187';

function isGrpcSslError(error: unknown): boolean {
  const msg = String((error as Error)?.message ?? error);
  return (
    msg.includes('self-signed certificate') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('certificate') ||
    msg.includes('CERT_')
  );
}

async function withInsecureSsl<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  try {
    return await fn();
  } finally {
    if (prev === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev;
    }
  }
}

async function getServiceAccountAccessToken(keyFile: string): Promise<string> {
  return withInsecureSsl(async () => {
    const auth = new GoogleAuth({
      keyFile,
      scopes: ['https://www.googleapis.com/auth/datastore'],
    });
    const client = await auth.getClient();
    const res = await client.getAccessToken();
    if (!res.token) {
      throw new Error('OAuth access token을 받지 못했습니다.');
    }
    return res.token;
  });
}

function curlGetJson(
  url: string,
  headers: Record<string, string>,
): Record<string, unknown> {
  const headerArgs = Object.entries(headers)
    .map(([key, value]) => `-H "${key}: ${value.replace(/"/g, '\\"')}"`)
    .join(' ');

  const raw = execSync(`curl.exe --ssl-no-revoke -s ${headerArgs} "${url}"`, {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });

  return JSON.parse(raw) as Record<string, unknown>;
}

function orderDocumentUrl(orderId: string): string {
  return (
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}` +
    `/databases/(default)/documents/orders/${orderId}`
  );
}

async function fetchOrderViaRest(orderId: string): Promise<Record<string, unknown>> {
  const keyFile = resolveServiceAccountPath();
  const token = await getServiceAccountAccessToken(keyFile);
  const url = orderDocumentUrl(orderId);
  const headers = { Authorization: `Bearer ${token}` };

  let json: Record<string, unknown>;

  if (process.platform === 'win32') {
    json = curlGetJson(url, headers);
  } else {
    json = await withInsecureSsl(async () => {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error(`Firestore REST ${res.status}: ${await res.text()}`);
      }
      return (await res.json()) as Record<string, unknown>;
    });
  }

  const error = json.error as { message?: string } | undefined;
  if (error?.message) {
    throw new Error(error.message);
  }

  const fields = json.fields as Record<string, unknown> | undefined;
  if (!fields) {
    throw new Error(`주문을 찾을 수 없습니다: orders/${orderId}`);
  }

  return decodeFirestoreDocument(json);
}

async function fetchOrderViaAdminSdk(orderId: string): Promise<Record<string, unknown>> {
  ensureLocalAdminApp();

  const snap = await getFirestore().collection('orders').doc(orderId).get();
  if (!snap.exists) {
    throw new Error(`주문을 찾을 수 없습니다: orders/${orderId}`);
  }

  return snap.data() as Record<string, unknown>;
}

/** Firestore orders/{orderId} — gRPC 실패 시 REST+curl 자동 재시도 (회사망 SSL) */
export async function fetchOrderDocument(
  orderId: string,
): Promise<Record<string, unknown>> {
  try {
    return await fetchOrderViaAdminSdk(orderId);
  } catch (error) {
    if (!isGrpcSslError(error)) throw error;

    console.warn(
      '⚠️  Firestore gRPC SSL 오류 → REST+curl 로 재시도 (회사망)',
    );
    return fetchOrderViaRest(orderId);
  }
}
