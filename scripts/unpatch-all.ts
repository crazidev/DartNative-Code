#!/usr/bin/env node
/**
 * scripts/unpatch-all.ts
 *
 * Full DartNative unpatch workflow:
 *  1. Restores package.json from package.json.upstream
 *  2. Reverts patches/dartnative-upstream-hooks.patch
 *
 * Usage:
 *   npx ts-node -P tsconfig.scripts.json scripts/unpatch-all.ts
 */

import { execSync } from "child_process";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

console.log("\n🧹 DartNative Unpatch Suite\n" + "=".repeat(40));

// 1. Source code
console.log("\n[1/2] Reverting Upstream Source Hooks:");
try {
	execSync(
		`node scripts/unpatch-source.js`,
		{ cwd: ROOT, stdio: "inherit" },
	);
} catch (e) {
	process.exit(1);
}

// 2. Manifest
console.log("\n[2/2] Reverting Manifest (package.json):");
try {
	execSync(
		`node scripts/unpatch-manifest.js`,
		{ cwd: ROOT, stdio: "inherit" },
	);
} catch (e) {
	process.exit(1);
}

console.log("\n✨ Repository restored to clean upstream baseline!\n");
