#!/usr/bin/env node
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

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const PKG_PATH = path.join(ROOT, "package.json");
const OVERLAY_PATH = path.join(ROOT, "package.dartnative.json");
const BACKUP_PATH = path.join(ROOT, "package.json.upstream");

const isDryRun = process.argv.includes("--check");

function main() {
	// Backup the original if not already done.
	if (!fs.existsSync(BACKUP_PATH)) {
		fs.copyFileSync(PKG_PATH, BACKUP_PATH);
		console.log("  ✓ Backed up original package.json → package.json.upstream");
	}

	// Always load from pristine upstream backup to ensure idempotent patching.
	const pkg = JSON.parse(fs.readFileSync(BACKUP_PATH, "utf8"));
	const overlay = JSON.parse(fs.readFileSync(OVERLAY_PATH, "utf8"));

	// 1. Apply top-level field overrides.
	for (const field of ["name", "displayName", "description", "icon", "keywords"] as const) {
		if (overlay[field]) {
			console.log(`  → ${field}: "${pkg[field]}" → "${overlay[field]}"`);
			pkg[field] = overlay[field];
		}
	}

	// 2. Rename command titles and categories.
	const titleRenames: Record<string, string> = overlay.commandTitleRenames || {};
	const catRenames: Record<string, string> = overlay.commandCategoryRenames || {};
	const catOverrides: Record<string, string> = overlay.commandCategoryOverrides || {};
	const commands: any[] = pkg.contributes?.commands || [];

	for (const cmd of commands) {
		if (titleRenames[cmd.command]) {
			console.log(`  → command title [${cmd.command}]: "${cmd.title}" → "${titleRenames[cmd.command]}"`);
			cmd.title = titleRenames[cmd.command];
		}
		if (catOverrides[cmd.command]) {
			console.log(`  → command category override [${cmd.command}]: "${cmd.category}" → "${catOverrides[cmd.command]}"`);
			cmd.category = catOverrides[cmd.command];
		} else if (cmd.category && catRenames[cmd.category]) {
			console.log(`  → command category [${cmd.command}]: "${cmd.category}" → "${catRenames[cmd.category]}"`);
			cmd.category = catRenames[cmd.category];
		}
	}

	// 2.5 Add additional commands if defined in overlay.
	if (Array.isArray(overlay.additionalCommands)) {
		pkg.contributes = pkg.contributes || {};
		pkg.contributes.commands = pkg.contributes.commands || [];
		const existingCommands = new Set(pkg.contributes.commands.map((c: any) => c.command));
		for (const cmd of overlay.additionalCommands) {
			if (!existingCommands.has(cmd.command)) {
				console.log(`  → adding command: ${cmd.command} ("${cmd.title}")`);
				pkg.contributes.commands.push(cmd);
				existingCommands.add(cmd.command);
			}
		}
	}

	// 3. Disable incompatible commands across all menus.
	const disabledCommands: Set<string> = new Set(overlay.disabledCommands || []);
	const menus: Record<string, any[]> = pkg.contributes?.menus || {};

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

	const palette: any[] = menus.commandPalette || [];
	const paletteMap = new Map<string, any>(palette.map((e: any) => [e.command, e]));

	for (const cmdId of disabledCommands) {
		if (!paletteMap.has(cmdId)) {
			// Add new hidden entry.
			console.log(`  → adding hidden command palette entry: ${cmdId}`);
			palette.push({ command: cmdId, when: "false" });
		}
	}

	// 4. Rename debugger configuration snippets.
	const debuggers: any[] = pkg.contributes?.debuggers || [];
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
	const removeContainers = new Set<string>(overlay.removeViewContainers || []);
	if (pkg.contributes?.viewsContainers?.activitybar) {
		const initialCount = pkg.contributes.viewsContainers.activitybar.length;
		pkg.contributes.viewsContainers.activitybar = pkg.contributes.viewsContainers.activitybar.filter(
			(c: any) => {
				if (removeContainers.has(c.id)) {
					console.log(`  → removing view container: ${c.id}`);
					return false;
				}
				return true;
			},
		);
		console.log(`  → view containers: kept ${pkg.contributes.viewsContainers.activitybar.length} of ${initialCount}`);
	}

	// 6. Rename view containers.
	const renameContainers: Record<string, any> = overlay.renameViewContainers || {};
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
	const removeViews = new Set<string>(overlay.removeViews || []);
	if (pkg.contributes?.views) {
		for (const containerId of Object.keys(pkg.contributes.views)) {
			// If the entire container was removed, delete its views section
			if (removeContainers.has(containerId)) {
				console.log(`  → deleting views section for removed container: ${containerId}`);
				delete pkg.contributes.views[containerId];
				continue;
			}
			// Otherwise filter out individual views to remove
			pkg.contributes.views[containerId] = pkg.contributes.views[containerId].filter((v: any) => {
				if (removeViews.has(v.id)) {
					console.log(`  → removing view: ${v.id} from ${containerId}`);
					return false;
				}
				return true;
			});
		}
	}

	// 8. Rename views (name and contextualTitle).
	const renameViews: Record<string, any> = overlay.renameViews || {};
	if (pkg.contributes?.views) {
		for (const viewsList of Object.values<any[]>(pkg.contributes.views)) {
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

	// 9. Remove unwanted configuration properties.
	const removeConfigProps = new Set<string>(overlay.removeConfigurationProperties || []);
	const configs: any[] = Array.isArray(pkg.contributes?.configuration)
		? pkg.contributes.configuration
		: [pkg.contributes?.configuration];

	if (removeConfigProps.size > 0) {
		for (const config of configs) {
			if (config.properties) {
				for (const propKey of Object.keys(config.properties)) {
					if (removeConfigProps.has(propKey)) {
						console.log(`  → removing configuration property: ${propKey}`);
						delete config.properties[propKey];
					}
				}
			}
		}
	}

	// 10. Rename configuration sections.
	const renameSections: Record<string, string> = overlay.renameConfigurationSections || {};
	for (const config of configs) {
		if (config.title && renameSections[config.title]) {
			console.log(`  → configuration section title: "${config.title}" → "${renameSections[config.title]}"`);
			config.title = renameSections[config.title];
		}
	}

	// 11. Apply configuration property overrides.
	const propOverrides: Record<string, any> = overlay.configurationPropertyOverrides || {};
	for (const [propKey, overrides] of Object.entries(propOverrides)) {
		for (const config of configs) {
			if (config.properties && config.properties[propKey]) {
				console.log(`  → overriding configuration property: ${propKey}`);
				const target = config.properties[propKey];
				// If an override specifies description, ensure markdownDescription does not keep stale text.
				if (overrides.description && !overrides.markdownDescription && target.markdownDescription) {
					target.markdownDescription = overrides.description;
				}
				if (overrides.markdownDescription && !overrides.description && target.description) {
					target.description = overrides.markdownDescription;
				}
				Object.assign(target, overrides);
			}
		}
	}

	// 12. Add or update configuration properties by section.
	const propsBySection: Record<string, Record<string, any>> = overlay.configurationPropertiesBySection || {};
	for (const [sectionTitle, props] of Object.entries(propsBySection)) {
		let targetSection = configs.find((c: any) => c?.title === sectionTitle);
		if (!targetSection) {
			console.log(`  → creating new configuration section: "${sectionTitle}"`);
			targetSection = { title: sectionTitle, properties: {} };
			if (Array.isArray(pkg.contributes?.configuration))
				pkg.contributes.configuration.push(targetSection);
			else
				pkg.contributes.configuration = [pkg.contributes.configuration, targetSection];
		}
		for (const [propKey, propVal] of Object.entries(props)) {
			console.log(`  → adding configuration property [${sectionTitle}]: ${propKey}`);
			targetSection.properties[propKey] = propVal;
		}
	}

	// Legacy fallback: configurationProperties adds to "Editor" section if not specified in configurationPropertiesBySection.
	const legacyConfigProps: Record<string, any> = overlay.configurationProperties || {};
	if (Object.keys(legacyConfigProps).length > 0 && !overlay.configurationPropertiesBySection) {
		const editorSection = configs.find((c: any) => c?.title === "Editor") || configs[0];
		if (editorSection?.properties) {
			for (const [propKey, propVal] of Object.entries(legacyConfigProps)) {
				console.log(`  → adding configuration property [Editor]: ${propKey}`);
				editorSection.properties[propKey] = propVal;
			}
		}
	}

	// 13. Add snippets if configured in overlay.
	if (Array.isArray(overlay.snippets)) {
		pkg.contributes = pkg.contributes || {};
		pkg.contributes.snippets = overlay.snippets;
		console.log(`  → adding contributes.snippets (${overlay.snippets.length} entries)`);
	}

	// 13.5 Rename configuration property keys (e.g. dart.flutterAdditionalArgs -> dart.dartNativeAdditionalArgs).
	const keyRenames: Record<string, string> = overlay.configurationKeyRenames || {};
	if (Object.keys(keyRenames).length > 0) {
		for (const config of configs) {
			if (config.properties) {
				for (const [oldKey, newKey] of Object.entries(keyRenames)) {
					if (config.properties[oldKey]) {
						console.log(`  → renaming configuration key: ${oldKey} → ${newKey}`);
						config.properties[newKey] = config.properties[oldKey];
						delete config.properties[oldKey];
					}
				}
			}
		}

		// Update cross-references in descriptions: #dart.flutterRunAdditionalArgs# -> #dart.dartNativeRunAdditionalArgs#
		for (const config of configs) {
			if (config.properties) {
				for (const val of Object.values<any>(config.properties)) {
					for (const [oldKey, newKey] of Object.entries(keyRenames)) {
						if (typeof val.description === "string" && val.description.includes(`#${oldKey}#`)) {
							val.description = val.description.split(`#${oldKey}#`).join(`#${newKey}#`);
						}
						if (typeof val.markdownDescription === "string" && val.markdownDescription.includes(`#${oldKey}#`)) {
							val.markdownDescription = val.markdownDescription.split(`#${oldKey}#`).join(`#${newKey}#`);
						}
					}
				}
			}
		}

		// Update when clauses in menus that check config.dart.<oldKey>
		const menus: Record<string, any[]> = pkg.contributes?.menus || {};
		for (const menuItems of Object.values(menus)) {
			if (Array.isArray(menuItems)) {
				for (const entry of menuItems) {
					for (const [oldKey, newKey] of Object.entries(keyRenames)) {
						if (typeof entry.when === "string" && entry.when.includes(`config.${oldKey}`)) {
							entry.when = entry.when.split(`config.${oldKey}`).join(`config.${newKey}`);
						}
					}
				}
			}
		}
	}

	// 14. Rename configuration setting prefix (e.g. dart. -> dartx.) so that
	// VS Code Settings editor headings display "DartX: <Setting Title>".
	if (overlay.settingPrefixRename) {
		const { fromPrefix, toPrefix } = overlay.settingPrefixRename;
		console.log(`  → renaming configuration setting prefix: "${fromPrefix}" → "${toPrefix}"`);

		for (const config of configs) {
			if (config.properties) {
				const oldEntries = Object.entries(config.properties);
				config.properties = {};
				for (const [key, val] of oldEntries) {
					const newKey = key.startsWith(fromPrefix) ? toPrefix + key.slice(fromPrefix.length) : key;
					config.properties[newKey] = val;
				}
			}
		}

		// Update internal setting references in descriptions: #dart.foo# -> #dartx.foo#
		const escapedFromPrefix = fromPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		for (const config of configs) {
			if (config.properties) {
				for (const val of Object.values<any>(config.properties)) {
					if (typeof val.description === "string") {
						val.description = val.description.replace(new RegExp(`#${escapedFromPrefix}`, "g"), `#${toPrefix}`);
					}
					if (typeof val.markdownDescription === "string") {
						val.markdownDescription = val.markdownDescription.replace(new RegExp(`#${escapedFromPrefix}`, "g"), `#${toPrefix}`);
					}
				}
			}
		}

		// Update when clauses in menus that check config.dart.*
		const menus: Record<string, any[]> = pkg.contributes?.menus || {};
		for (const menuItems of Object.values(menus)) {
			if (Array.isArray(menuItems)) {
				for (const entry of menuItems) {
					if (typeof entry.when === "string" && entry.when.includes(`config.${fromPrefix}`)) {
						entry.when = entry.when.replace(new RegExp(`config\\.${escapedFromPrefix}`, "g"), `config.${toPrefix}`);
					}
				}
			}
		}
	}

	const patched = JSON.stringify(pkg, null, "\t") + "\n";

	if (isDryRun) {
		const original = fs.readFileSync(PKG_PATH, "utf8");
		if (original !== patched) {
			console.error("\n  ✗ Dry run: package.json would be changed. Run `npm run patch:manifest` to apply.");
			process.exit(1);
		} else {
			console.log("\n  ✓ Dry run: package.json is already patched.");
		}
		return;
	}

	fs.writeFileSync(PKG_PATH, patched);
	console.log("\n  ✓ DartNative patches applied to package.json");
}

main();
