#!/usr/bin/env node
"use strict";
/**
 * scripts/unpatch-source.ts
 *
 * Reverts patches/dartnative-upstream-hooks.patch from upstream files.
 *
 * Usage:
 *   npx ts-node -P tsconfig.scripts.json scripts/unpatch-source.ts
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSourcePatched = isSourcePatched;
exports.unpatchSource = unpatchSource;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ROOT = path.resolve(__dirname, "..");
const PATCH_FILE = path.join(ROOT, "patches", "dartnative-upstream-hooks.patch");
function isSourcePatched() {
    try {
        (0, child_process_1.execSync)(`git apply -R --check "${PATCH_FILE}"`, { cwd: ROOT, stdio: "ignore" });
        return true;
    }
    catch {
        return false;
    }
}
function unpatchSource() {
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
        (0, child_process_1.execSync)(`git apply -R "${PATCH_FILE}"`, { cwd: ROOT, stdio: "inherit" });
        console.log("  ✓ Successfully reverted upstream source files to clean state.");
        return true;
    }
    catch (err) {
        console.error("  ✗ Failed to revert source patch:", err.message);
        process.exit(1);
    }
}
if (require.main === module) {
    unpatchSource();
}
//# sourceMappingURL=unpatch-source.js.map