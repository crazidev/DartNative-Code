#!/usr/bin/env node
"use strict";
/**
 * scripts/patch-manifest.ts
 *
 * Applies DartNative customizations to package.json at build time.
 * Reads overrides from package.dartnative.json and:
 *  1. Renames top-level fields (name, displayName, description)
 *  2. Renames command titles and categories
 *  3. Disables incompatible commands in commandPalette (when: "false")
 *
 * Usage:
 *   npm run patch:manifest          — apply DartNative patches
 *   npm run patch:manifest -- --check  — dry-run, exits 1 if patch would change anything
 *
 * The original package.json is preserved as package.json.upstream for reverting.
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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ROOT = path.resolve(__dirname, "..");
const PKG_PATH = path.join(ROOT, "package.json");
const OVERLAY_PATH = path.join(ROOT, "package.dartnative.json");
const BACKUP_PATH = path.join(ROOT, "package.json.upstream");
const isDryRun = process.argv.includes("--check");
function main() {
    // Load files.
    const pkg = JSON.parse(fs.readFileSync(PKG_PATH, "utf8"));
    const overlay = JSON.parse(fs.readFileSync(OVERLAY_PATH, "utf8"));
    // Backup the original if not already done.
    if (!fs.existsSync(BACKUP_PATH)) {
        fs.copyFileSync(PKG_PATH, BACKUP_PATH);
        console.log("  ✓ Backed up original package.json → package.json.upstream");
    }
    // 1. Apply top-level field overrides.
    for (const field of ["name", "displayName", "description"]) {
        if (overlay[field]) {
            console.log(`  → ${field}: "${pkg[field]}" → "${overlay[field]}"`);
            pkg[field] = overlay[field];
        }
    }
    // 2. Rename command titles and categories.
    const titleRenames = overlay.commandTitleRenames || {};
    const catRenames = overlay.commandCategoryRenames || {};
    const catOverrides = overlay.commandCategoryOverrides || {};
    const commands = pkg.contributes?.commands || [];
    for (const cmd of commands) {
        if (titleRenames[cmd.command]) {
            console.log(`  → command title [${cmd.command}]: "${cmd.title}" → "${titleRenames[cmd.command]}"`);
            cmd.title = titleRenames[cmd.command];
        }
        if (catOverrides[cmd.command]) {
            console.log(`  → command category override [${cmd.command}]: "${cmd.category}" → "${catOverrides[cmd.command]}"`);
            cmd.category = catOverrides[cmd.command];
        }
        else if (cmd.category && catRenames[cmd.category]) {
            console.log(`  → command category [${cmd.command}]: "${cmd.category}" → "${catRenames[cmd.category]}"`);
            cmd.category = catRenames[cmd.category];
        }
    }
    // 3. Disable incompatible commands across all menus.
    const disabledCommands = new Set(overlay.disabledCommands || []);
    const menus = pkg.contributes?.menus || {};
    for (const [menuName, menuItems] of Object.entries(menus)) {
        if (Array.isArray(menuItems)) {
            for (const entry of menuItems) {
                if (entry.command && disabledCommands.has(entry.command)) {
                    if (entry.when !== "false") {
                        console.log(`  → disabling menu entry in ${menuName}: ${entry.command} (was: "${entry.when}")`);
                        entry.when = "false";
                    }
                }
            }
        }
    }
    const palette = menus.commandPalette || [];
    const paletteMap = new Map(palette.map((e) => [e.command, e]));
    for (const cmdId of disabledCommands) {
        if (!paletteMap.has(cmdId)) {
            // Add new hidden entry.
            console.log(`  → adding hidden command palette entry: ${cmdId}`);
            palette.push({ command: cmdId, when: "false" });
        }
    }
    // 4. Rename debugger configuration snippets.
    const debuggers = pkg.contributes?.debuggers || [];
    for (const dbg of debuggers) {
        if (dbg.label && typeof dbg.label === "string" && dbg.label.includes("Flutter")) {
            const newDbgLabel = dbg.label.replace("Flutter", "DartNative");
            console.log(`  → debugger label: "${dbg.label}" → "${newDbgLabel}"`);
            dbg.label = newDbgLabel;
        }
        if (Array.isArray(dbg.configurationSnippets)) {
            for (const snippet of dbg.configurationSnippets) {
                if (typeof snippet.label === "string" && snippet.label.startsWith("Flutter:")) {
                    const newLabel = snippet.label.replace("Flutter:", "DartNative:");
                    console.log(`  → debugger snippet label: "${snippet.label}" → "${newLabel}"`);
                    snippet.label = newLabel;
                }
                if (typeof snippet.description === "string" && snippet.description.includes("Flutter")) {
                    snippet.description = snippet.description.replace(/Flutter/g, "DartNative");
                }
                if (typeof snippet.body?.name === "string" && snippet.body.name.includes("Flutter")) {
                    snippet.body.name = snippet.body.name.replace(/Flutter/g, "DartNative");
                }
            }
        }
    }
    // 5. Remove unwanted view containers.
    const removeContainers = new Set(overlay.removeViewContainers || []);
    if (pkg.contributes?.viewsContainers?.activitybar) {
        const initialCount = pkg.contributes.viewsContainers.activitybar.length;
        pkg.contributes.viewsContainers.activitybar = pkg.contributes.viewsContainers.activitybar.filter((c) => {
            if (removeContainers.has(c.id)) {
                console.log(`  → removing view container: ${c.id}`);
                return false;
            }
            return true;
        });
        console.log(`  → view containers: kept ${pkg.contributes.viewsContainers.activitybar.length} of ${initialCount}`);
    }
    // 6. Rename view containers.
    const renameContainers = overlay.renameViewContainers || {};
    if (pkg.contributes?.viewsContainers?.activitybar) {
        for (const container of pkg.contributes.viewsContainers.activitybar) {
            if (renameContainers[container.id]) {
                const override = renameContainers[container.id];
                if (override.title) {
                    console.log(`  → view container title [${container.id}]: "${container.title}" → "${override.title}"`);
                    container.title = override.title;
                }
                if (override.icon) {
                    container.icon = override.icon;
                }
            }
        }
    }
    // 7. Remove unwanted views and clean up orphaned containers in views.
    const removeViews = new Set(overlay.removeViews || []);
    if (pkg.contributes?.views) {
        for (const containerId of Object.keys(pkg.contributes.views)) {
            // If the entire container was removed, delete its views section
            if (removeContainers.has(containerId)) {
                console.log(`  → deleting views section for removed container: ${containerId}`);
                delete pkg.contributes.views[containerId];
                continue;
            }
            // Otherwise filter out individual views to remove
            pkg.contributes.views[containerId] = pkg.contributes.views[containerId].filter((v) => {
                if (removeViews.has(v.id)) {
                    console.log(`  → removing view: ${v.id} from ${containerId}`);
                    return false;
                }
                return true;
            });
        }
    }
    // 8. Rename views (name and contextualTitle).
    const renameViews = overlay.renameViews || {};
    if (pkg.contributes?.views) {
        for (const viewsList of Object.values(pkg.contributes.views)) {
            for (const view of viewsList) {
                if (renameViews[view.id]) {
                    const override = renameViews[view.id];
                    if (override.name !== undefined) {
                        console.log(`  → view name [${view.id}]: "${view.name}" → "${override.name}"`);
                        view.name = override.name;
                    }
                    if (override.contextualTitle !== undefined) {
                        console.log(`  → view contextualTitle [${view.id}]: "${view.contextualTitle}" → "${override.contextualTitle}"`);
                        view.contextualTitle = override.contextualTitle;
                    }
                }
            }
        }
    }
    // 9. Add or update configuration properties.
    const configProps = overlay.configurationProperties || {};
    const configs = Array.isArray(pkg.contributes?.configuration)
        ? pkg.contributes.configuration
        : [pkg.contributes?.configuration];
    const targetConfig = configs.find((c) => c?.title === "Editor") || configs[0];
    if (targetConfig?.properties) {
        for (const [propKey, propVal] of Object.entries(configProps)) {
            console.log(`  → adding configuration property: ${propKey}`);
            targetConfig.properties[propKey] = propVal;
        }
    }
    // 10. Add snippets if configured in overlay.
    if (Array.isArray(overlay.snippets)) {
        pkg.contributes = pkg.contributes || {};
        pkg.contributes.snippets = overlay.snippets;
        console.log(`  → adding contributes.snippets (${overlay.snippets.length} entries)`);
    }
    const patched = JSON.stringify(pkg, null, "\t") + "\n";
    if (isDryRun) {
        const original = fs.readFileSync(PKG_PATH, "utf8");
        if (original !== patched) {
            console.error("\n  ✗ Dry run: package.json would be changed. Run `npm run patch:manifest` to apply.");
            process.exit(1);
        }
        else {
            console.log("\n  ✓ Dry run: package.json is already patched.");
        }
        return;
    }
    fs.writeFileSync(PKG_PATH, patched);
    console.log("\n  ✓ DartNative patches applied to package.json");
}
main();
//# sourceMappingURL=patch-manifest.js.map