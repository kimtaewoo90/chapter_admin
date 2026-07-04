#!/usr/bin/env bash
# Flutter Web — hot restart(R) 시 EngineFlutterView disposed 에러 우회
# https://github.com/flutter/flutter/issues/175260
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

flutter pub get
exec flutter run -d chrome --no-web-experimental-hot-reload "$@"
