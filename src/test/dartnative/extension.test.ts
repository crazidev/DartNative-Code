import { strict as assert } from "assert";
import * as path from "path";
import * as vs from "vscode";
import { isDartNativeProjectFolder } from "../../shared/dartnative/project_detection";
import { fsPath } from "../../shared/utils/fs";
import { activateWithoutAnalysis, ext, logger, privateApi } from "../helpers";

describe("DartNative test environment", () => {
	it("has opened the dartnative_starter fixture folder", () => {
		const wfs = vs.workspace.workspaceFolders || [];
		assert.equal(wfs.length, 1);
		const folderPath = fsPath(wfs[0].uri);
		assert.ok(
			folderPath.endsWith(path.sep + "dartnative_starter"),
			`${folderPath} does not end with ${path.sep}dartnative_starter`,
		);
	});

	it("identifies workspace as a valid DartNative project", () => {
		const wfs = vs.workspace.workspaceFolders || [];
		assert.equal(wfs.length, 1);
		const folderPath = fsPath(wfs[0].uri);
		assert.equal(isDartNativeProjectFolder(folderPath), true);
	});
});

describe("DartNative extension activation and commands", () => {
	it("activates successfully in DartNative workspace", async () => {
		await activateWithoutAnalysis();
		assert.equal(ext.isActive, true);
	});

	it("registers DartNative specific commands", async () => {
		await activateWithoutAnalysis();
		const allCommands = await vs.commands.getCommands(true);

		// Core DartNative commands registered by the extension.
		assert.ok(allCommands.includes("dart.locateDartNativeSdk"), "Missing dart.locateDartNativeSdk command");
		assert.ok(allCommands.includes("dart.setDartNativeLicenseKey"), "Missing dart.setDartNativeLicenseKey command");
		assert.ok(allCommands.includes("dartnative.addSdkToPath"), "Missing dartnative.addSdkToPath command");
		assert.ok(allCommands.includes("flutter.clean"), "Missing flutter.clean command (DartNative clean)");
		assert.ok(allCommands.includes("flutter.clean.all"), "Missing flutter.clean.all command (DartNative clean all)");
	});

	it("configures tool environment for DartNative", async () => {
		await activateWithoutAnalysis();
		if (privateApi) {
			const toolEnv = privateApi.getToolEnv();
			logger.info(`DartNative toolEnv: ${JSON.stringify(toolEnv)}`);
			// If an SDK is found, DARTNATIVE_ROOT must be set.
			if (privateApi.workspaceContext?.sdks?.flutter) {
				assert.ok(toolEnv?.DARTNATIVE_ROOT, "DARTNATIVE_ROOT should be populated in toolEnv");
			}
		}
	});
});
