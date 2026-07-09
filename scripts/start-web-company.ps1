# 회사 PC / 로컬 개발 — Google 로그인 없이 Admin 실행
#
# [최초 1회 — 집 PC 등 firebase login 가능한 곳]
#   .\scripts\deploy-rules-dev.ps1
#
# [PDF 만들기 CORS 오류 시 — gcloud login 가능한 곳]
#   .\scripts\fix-function-invoker.ps1
#
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Set-Location (Join-Path $PSScriptRoot '..')

Write-Host 'Chapter Admin — 회사 PC 개발 모드'
Write-Host '  1) 로그인 스kip'
Write-Host '  2) Firestore dev rules 필요 (deploy-rules-dev.ps1 1회)'
Write-Host ''

flutter pub get
flutter run -d chrome `
  --no-web-experimental-hot-reload `
  --dart-define=ADMIN_SKIP_AUTH=true `
  @args
