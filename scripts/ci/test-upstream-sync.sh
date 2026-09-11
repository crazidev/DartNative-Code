#!/usr/bin/env bash
# scripts/ci/test-upstream-sync.sh
#
# Tests that our DartNative patches cleanly apply on top of the latest
# upstream Dart-Code master.
#
# Strategy:
#   1. Temporarily unpatch package.json so upstream merges cleanly.
#   2. Fetch upstream master.
#   3. Attempt a git merge (no-commit, no-ff) to simulate upstream sync.
#   4. Re-apply our DartNative manifest patches.
#   5. Build and run lint to verify the result compiles.
#   6. Always restore the branch to its original state.
#
# Usage:
#   bash scripts/ci/test-upstream-sync.sh
#
# Environment variables:
#   UPSTREAM_REMOTE  — name of the upstream remote (default: upstream)
#   UPSTREAM_BRANCH  — upstream branch to merge (default: master)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT"

UPSTREAM_REMOTE="${UPSTREAM_REMOTE:-upstream}"
UPSTREAM_BRANCH="${UPSTREAM_BRANCH:-master}"
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

cleanup() {
	echo ""
	echo "=== [cleanup] Restoring branch state ==="
	git merge --abort 2>/dev/null || true
	git checkout "$CURRENT_BRANCH" 2>/dev/null || true
	# Restore any changes that were stashed.
	git stash pop 2>/dev/null || true
	echo "  ✓ Restored to branch: $CURRENT_BRANCH"
}
trap cleanup EXIT

echo "=== [1/6] Checking upstream remote ==="
if ! git remote get-url "$UPSTREAM_REMOTE" &>/dev/null; then
	echo "  Adding upstream remote → https://github.com/Dart-Code/Dart-Code.git"
	git remote add "$UPSTREAM_REMOTE" https://github.com/Dart-Code/Dart-Code.git
fi

echo ""
echo "=== [2/6] Fetching upstream/$UPSTREAM_BRANCH ==="
git fetch "$UPSTREAM_REMOTE" "$UPSTREAM_BRANCH"

echo ""
echo "=== [3/6] Stashing local changes (if any) ==="
git stash push --include-untracked -m "upstream-sync-test: auto-stash" || true

echo ""
echo "=== [4/6] Attempting merge with upstream/$UPSTREAM_BRANCH (no-commit) ==="
if ! git merge --no-commit --no-ff "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH"; then
	echo ""
	echo "  ✗ Merge conflicts detected. Showing conflicted files:"
	git diff --name-only --diff-filter=U
	echo ""
	echo "  Review conflicts above and resolve them in the modular DartNative files."
	exit 1
fi

echo "  ✓ Merge succeeded with no conflicts."

echo ""
echo "=== [5/6] Re-applying DartNative patch suite ==="
./scripts/patch-all.sh

echo ""
echo "=== [6/6] Building and linting ==="
npm ci
npm run build
npm run lint

echo ""
echo "✓ Upstream sync test PASSED. DartNative patches apply cleanly on top of upstream/$UPSTREAM_BRANCH."
