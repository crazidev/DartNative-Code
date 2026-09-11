#!/usr/bin/env node
/**
 * scripts/patch-all.ts
 *
 * Full DartNative patch workflow:
 *  1. Patches package.json using package.dartnative.json overlay
 *  2. Applies patches/dartnative-upstream-hooks.patch to source files
 *
 * Usage:
 *   npx ts-node -P tsconfig.scripts.json scripts/patch-all.ts
 *   npx ts-node -P tsconfig.scripts.json scripts/patch-all.ts --check
 */

import { execSync } from "child_process";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const isCheckOnly = process.argv.includes("--check");

console.log("\n📦 DartNative Patch Suite\n" + "=".repeat(40));

// 1. Manifest
console.log("\n[1/2] Manifest (package.json):");
try {
	execSync(
		`node scripts/patch-manifest.js${isCheckOnly ? " --check" : ""}`,
		{ cwd: ROOT, stdio: "inherit" },
	);
} catch (e) {
	process.exit(1);
}

// 2. Source code
console.log("\n[2/2] Upstream Source Hooks:");
try {
	execSync(
		`node scripts/patch-source.js${isCheckOnly ? " --check" : ""}`,
		{ cwd: ROOT, stdio: "inherit" },
	);
} catch (e) {
	process.exit(1);
}

console.log("\n✨ DartNative patch suite complete!\n");
