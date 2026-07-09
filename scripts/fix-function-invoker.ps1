# Cloud Run Callable 403/CORS 수정 (Windows)
# 증상: CORS policy / adminDevListOrders / generateOrderPdf internal
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$PROJECT = 'chapter-cc187'
$REGION = 'asia-northeast3'

$services = @(
  'generateorderpdf',
  'seedtestorderdata',
  'admindevlistorders',
  'admindevupdateorder',
  'admindevlistusers',
  'admindevgetuserorders',
  'admindevupdateuser',
  'admindevgetuserstats'
)

Write-Host '=== Cloud Run Invoker 권한 설정 ==='
Write-Host 'gcloud 로그인 필요: gcloud auth login'
Write-Host ''

foreach ($service in $services) {
  Write-Host "-> $service"
  gcloud run services add-iam-policy-binding $service `
    --region=$REGION `
    --project=$PROJECT `
    --member='allUsers' `
    --role='roles/run.invoker'
}

Write-Host ''
Write-Host '완료.'
