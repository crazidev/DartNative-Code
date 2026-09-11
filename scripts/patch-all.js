#!/usr/bin/env node
"use strict";
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
const isCheckOnly = process.argv.includes("--check");
console.log("\n📦 DartNative Patch Suite\n" + "=".repeat(40));
// 1. Manifest
console.log("\n[1/2] Manifest (package.json):");
try {
    (0, child_process_1.execSync)(`node scripts/patch-manifest.js${isCheckOnly ? " --check" : ""}`, { cwd: ROOT, stdio: "inherit" });
}
catch (e) {
    process.exit(1);
}
// 2. Source code
console.log("\n[2/2] Upstream Source Hooks:");
try {
    (0, child_process_1.execSync)(`node scripts/patch-source.js${isCheckOnly ? " --check" : ""}`, { cwd: ROOT, stdio: "inherit" });
}
catch (e) {
    process.exit(1);
}
console.log("\n✨ DartNative patch suite complete!\n");
//# sourceMappingURL=patch-all.js.map