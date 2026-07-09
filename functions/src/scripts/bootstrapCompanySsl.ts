/**
 * 회사망 SSL 검사(자체 서명 인증서) 우회 — 로컬 PDF 스크립트 전용
 *
 * 사용: CHAPTER_INSECURE_SSL=1 npm run pdf:order -- <orderId>
 * ⚠️ Google API 호출 시에만 쓰세요. 로컬 PDF 생성 후에는 끄는 것을 권장합니다.
 */
if (process.env.CHAPTER_INSECURE_SSL === '1') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.warn(
    '[Chapter] CHAPTER_INSECURE_SSL=1 — TLS 인증서 검증 비활성 (회사망 로컬 전용)',
  );
}
