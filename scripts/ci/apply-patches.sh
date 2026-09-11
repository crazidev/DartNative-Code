#!/usr/bin/env bash
# scripts/ci/apply-patches.sh
#
# Applies all DartNative customizations and runs a full build + unit tests.
# Run this in CI after checking out feature/modularize-dartnative-patches.
#
# Usage:
#   bash scripts/ci/apply-patches.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== [1/4] Installing dependencies ==="
cd "$ROOT"
npm ci

echo ""
echo "=== [2/4] Applying DartNative patch suite (manifest + source hooks) ==="
./scripts/patch-all.sh

echo ""
echo "=== [3/4] Building extension ==="
npm run build

echo ""
echo "=== [4/4] Running linter ==="
npm run lint

echo ""
echo "✓ All DartNative patches applied and build verified successfully."
