# Firestore dev rules 배포 (로그인 없이 Admin 조회용)
# ⚠️ 프로덕션에서 오래 두지 마세요. 끝나면 deploy-rules.sh 로 복구하세요.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Set-Location (Join-Path $PSScriptRoot '..')

Write-Host '=== Firestore DEV Rules 배포 (chapter-cc187) ==='
Write-Host '⚠️  orders/users 누구나 읽기/쓰기 허용 — 개발용만'
Write-Host ''

Copy-Item firestore.rules firestore.rules.bak -Force
Copy-Item firestore.dev.rules firestore.rules -Force

try {
  npx firebase-tools deploy --only firestore:rules --project chapter-cc187
} finally {
  Move-Item firestore.rules.bak firestore.rules -Force
}

Write-Host ''
Write-Host '완료. 프로덕션 복구: scripts/deploy-rules.ps1 (또는 deploy-rules.sh)'
