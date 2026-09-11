#!/usr/bin/env node
/**
 * scripts/unpatch-source.ts
 *
 * Reverts patches/dartnative-upstream-hooks.patch from upstream files.
 *
 * Usage:
 *   npx ts-node -P tsconfig.scripts.json scripts/unpatch-source.ts
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const PATCH_FILE = path.join(ROOT, "patches", "dartnative-upstream-hooks.patch");

export function isSourcePatched(): boolean {
	try {
		execSync(`git apply -R --check "${PATCH_FILE}"`, { cwd: ROOT, stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

export function unpatchSource(): boolean {
	if (!fs.existsSync(PATCH_FILE)) {
		console.error(`  ✗ Patch file not found: ${PATCH_FILE}`);
		process.exit(1);
	}

	if (!isSourcePatched()) {
		console.log("  ✓ Source files are already clean (unpatched).");
		return true;
	}

	try {
		console.log("  → Reverting patches/dartnative-upstream-hooks.patch...");
		execSync(`git apply -R "${PATCH_FILE}"`, { cwd: ROOT, stdio: "inherit" });
		console.log("  ✓ Successfully reverted upstream source files to clean state.");
		return true;
	} catch (err: any) {
		console.error("  ✗ Failed to revert source patch:", err.message);
		process.exit(1);
	}
}

if (require.main === module) {
	unpatchSource();
}
