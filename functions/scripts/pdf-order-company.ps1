# 회사 PC — SSL 검사(자체 서명 인증서) 우회 후 주문 PDF 생성
# 사용: .\scripts\pdf-order-company.ps1 1dcbacbe-7e66-4c67-bf10-012f105e1e0a
param(
  [Parameter(Mandatory = $true)]
  [string]$OrderId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Set-Location (Join-Path $PSScriptRoot '..')

$env:CHAPTER_INSECURE_SSL = '1'
npm run pdf:order -- $OrderId
