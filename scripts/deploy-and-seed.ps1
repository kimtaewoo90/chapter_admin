param(
    [switch]$SeedOnly,
    [switch]$DeployOnly
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot + "\.."

Write-Host "=== Chapter Admin Deploy ===" -ForegroundColor Cyan

if (-not $SeedOnly) {
    Write-Host "`n[1/3] Functions 빌드..." -ForegroundColor Yellow
    Push-Location functions
    npm run build
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Pop-Location

    Write-Host "`n[2/3] Firebase Functions 배포..." -ForegroundColor Yellow
    npx firebase-tools deploy --only functions --project chapter-cc187
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n배포 실패 — firebase login 이 필요할 수 있습니다:" -ForegroundColor Red
        Write-Host "  npx firebase-tools login" -ForegroundColor White
        exit $LASTEXITCODE
    }
}

if (-not $DeployOnly) {
    Write-Host "`n[3/3] 테스트 주문 시드..." -ForegroundColor Yellow
    node scripts/seed-test-order.mjs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "`n✅ 완료! flutter run -d chrome 후 결제상황에서 테스트하세요." -ForegroundColor Green
