#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Firestore Rules 배포 (chapter-cc187) ==="
echo ""
echo "⚠️  Chapter 앱과 같은 프로젝트입니다."
echo "    이 repo의 firestore.rules(병합 규칙)만 배포합니다."
echo ""

npx firebase-tools deploy --only firestore:rules --project chapter-cc187

echo ""
echo "완료."
