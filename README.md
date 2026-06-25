# chapter_admin

Chapter 앱 관리자 페이지 (Flutter Web)

## 기능

- **결제상황** — 주문 목록, 입금 확인, **PDF 만들기**, PDF 다운로드
- **유저상황** — Firestore 유저 목록, 활동 현황, 관리자 메모
- **Analytics** — 준비 중

## 실행

```bash
flutter pub get
flutter run -d chrome
```

## Firebase Functions (PDF + Layout Engine)

주문 스냅샷의 일기(entries)를 Layout Engine으로 조판해 PDF를 생성합니다.

```bash
cd functions
npm install
npm test          # Layout Engine 테스트
npm run build
firebase deploy --only functions
```

### Functions

| 함수 | 트리거 | 설명 |
|------|--------|------|
| `generateOrderPdf` | HTTPS Callable | Admin **PDF 만들기** 버튼 |
| `onOrderPaidGeneratePdf` | Firestore `orders` 업데이트 | `status → paid` 시 자동 생성 |

### Layout Engine 규칙 (`functions/src/layout/engine.ts`)

| 조건 | 레이아웃 |
|------|----------|
| 사진 1장 + 긴 글 (200자+) | `single-photo-vertical` — 사진 위 / 제목 / 본문 |
| 사진 3장+ + 짧은 글 (150자 미만) | `photo-grid` — 2열 그리드 + 짧은 코멘트 |
| 사진 2장 + 짧은 글 | `dual-photo` — 나란히 |
| 사진 없음 | `text-only` |

PDF 저장 경로: `storage/pdfs/{orderId}.pdf`

## Firebase

프로젝트: `chapter-cc187` (리전: `asia-northeast3`)

`lib/firebase_options.dart`에 웹 앱 설정이 포함되어 있습니다.
