#!/usr/bin/env bash
# Cloud Run이 Callable 요청을 403으로 막을 때 실행하세요.
# 증상: Flutter에서 [firebase_functions/internal] internal
set -euo pipefail

PROJECT=chapter-cc187
REGION=asia-northeast3

echo "=== Cloud Run Invoker 권한 설정 ==="
echo "gcloud 로그인이 필요합니다: gcloud auth login"
echo ""

for SERVICE in generateorderpdf seedtestorderdata \
  admindevlistorders admindevupdateorder admindevlistusers \
  admindevgetuserorders admindevupdateuser admindevgetuserstats; do
  echo "→ $SERVICE"
  gcloud run services add-iam-policy-binding "$SERVICE" \
    --region="$REGION" \
    --project="$PROJECT" \
    --member="allUsers" \
    --role="roles/run.invoker"
done

echo ""
echo "완료. curl 테스트:"
curl -s -o /dev/null -w "generateOrderPdf HTTP %{http_code}\n" \
  -X POST "https://${REGION}-${PROJECT}.cloudfunctions.net/generateOrderPdf" \
  -H "Content-Type: application/json" \
  -d '{"data":{"orderId":"test"}}'
echo "(400/500이면 권한 OK, 403이면 아직 실패)"
