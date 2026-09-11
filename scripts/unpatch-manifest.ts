#!/usr/bin/env node
/**
 * scripts/unpatch-manifest.ts
 *
 * Reverts package.json to the upstream backup created by patch-manifest.ts.
 *
 * Usage:
 *   npm run unpatch:manifest
 */

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const PKG_PATH = path.join(ROOT, "package.json");
const BACKUP_PATH = path.join(ROOT, "package.json.upstream");

if (!fs.existsSync(BACKUP_PATH)) {
	console.error("  ✗ No backup found at package.json.upstream. Nothing to revert.");
	process.exit(1);
}

fs.copyFileSync(BACKUP_PATH, PKG_PATH);
fs.unlinkSync(BACKUP_PATH);
console.log("  ✓ package.json restored from upstream backup. package.json.upstream removed.");
