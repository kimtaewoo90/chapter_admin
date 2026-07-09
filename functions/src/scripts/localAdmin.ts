/**
 * 로컬 스크립트용 Firebase Admin 초기화
 *
 * 인증 순서:
 * 1. functions/service-account.json
 * 2. GOOGLE_APPLICATION_CREDENTIALS / gcloud application-default
 */
import fs from 'node:fs';
import path from 'node:path';

import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';

const PROJECT_ID = 'chapter-cc187';
const STORAGE_BUCKET = 'chapter-cc187.firebasestorage.app';

const CREDENTIAL_HINT = `
Firebase Admin 인증이 필요합니다. 아래 중 하나를 설정하세요.

1) 서비스 계정 키 (권장)
   Firebase Console → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
   → functions/service-account.json 으로 저장

2) 환경 변수
   set GOOGLE_APPLICATION_CREDENTIALS=D:\\path\\to\\key.json

3) gcloud ADC
   gcloud auth application-default login
`.trim();

function serviceAccountCandidates(): string[] {
  const fromEnv = process.env.CHAPTER_SERVICE_ACCOUNT;
  const roots = [
    path.join(__dirname, '..', '..'),
    process.cwd(),
  ];

  const names = ['service-account.json'];
  if (fromEnv) names.unshift(fromEnv);

  const paths: string[] = [];
  for (const root of roots) {
    for (const name of names) {
      paths.push(path.isAbsolute(name) ? name : path.join(root, name));
    }
  }
  return [...new Set(paths)];
}

export function resolveServiceAccountPath(): string {
  for (const file of serviceAccountCandidates()) {
    if (fs.existsSync(file)) return file;
  }

  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  throw new Error(CREDENTIAL_HINT);
}

export function ensureLocalAdminApp(): void {
  if (getApps().length > 0) return;

  for (const file of serviceAccountCandidates()) {
    if (!fs.existsSync(file)) continue;

    const serviceAccount = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      project_id?: string;
    };

    initializeApp({
      credential: cert(file),
      projectId: serviceAccount.project_id ?? PROJECT_ID,
      storageBucket: STORAGE_BUCKET,
    });
    return;
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    initializeApp({
      credential: applicationDefault(),
      projectId: PROJECT_ID,
      storageBucket: STORAGE_BUCKET,
    });
    return;
  }

  throw new Error(CREDENTIAL_HINT);
}
