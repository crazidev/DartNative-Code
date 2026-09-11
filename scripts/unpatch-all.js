#!/usr/bin/env node
"use strict";
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
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const ROOT = path.resolve(__dirname, "..");
console.log("\n🧹 DartNative Unpatch Suite\n" + "=".repeat(40));
// 1. Source code
console.log("\n[1/2] Reverting Upstream Source Hooks:");
try {
    (0, child_process_1.execSync)(`node scripts/unpatch-source.js`, { cwd: ROOT, stdio: "inherit" });
}
catch (e) {
    process.exit(1);
}
// 2. Manifest
console.log("\n[2/2] Reverting Manifest (package.json):");
try {
    (0, child_process_1.execSync)(`node scripts/unpatch-manifest.js`, { cwd: ROOT, stdio: "inherit" });
}
catch (e) {
    process.exit(1);
}
console.log("\n✨ Repository restored to clean upstream baseline!\n");
//# sourceMappingURL=unpatch-all.js.map