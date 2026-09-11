#!/usr/bin/env node
/**
 * scripts/patch-source.ts
 *
 * Applies patches/dartnative-upstream-hooks.patch to upstream files.
 *
 * Usage:
 *   npx ts-node -P tsconfig.scripts.json scripts/patch-source.ts
 *   npx ts-node -P tsconfig.scripts.json scripts/patch-source.ts --check
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const PATCH_FILE = path.join(ROOT, "patches", "dartnative-upstream-hooks.patch");

const isCheckOnly = process.argv.includes("--check");

export function isSourcePatched(): boolean {
	try {
		// If reverse check succeeds, the patch is currently applied.
		execSync(`git apply -R --check "${PATCH_FILE}"`, { cwd: ROOT, stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

export function patchSource(): boolean {
	if (!fs.existsSync(PATCH_FILE)) {
		console.error(`  ✗ Patch file not found: ${PATCH_FILE}`);
		process.exit(1);
	}

	if (isSourcePatched()) {
		console.log("  ✓ Source files are already patched with DartNative hooks.");
		return true;
	}

	if (isCheckOnly) {
		console.error("  ✗ Check failed: Source files are NOT patched. Run `npm run patch:source` to apply.");
		process.exit(1);
	}

	try {
		console.log("  → Applying patches/dartnative-upstream-hooks.patch...");
		execSync(`git apply "${PATCH_FILE}"`, { cwd: ROOT, stdio: "inherit" });
		console.log("  ✓ Successfully patched upstream source files.");
		return true;
	} catch (err: any) {
		console.error("  ✗ Failed to apply source patch:", err.message);
		process.exit(1);
	}
}

if (require.main === module) {
	patchSource();
}
