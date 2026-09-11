import * as fs from "fs";
import * as path from "path";
import { executableNames, flutterPath } from "../../shared/constants";
import { isDartNativeProjectFolder } from "../../shared/dartnative/project_detection";
import { fsPath } from "../../shared/utils/fs";
import * as vs from "vscode";

// NOTE: DartNative CLI routing logic extracted from src/extension/commands/sdk.ts
// and src/extension/commands/packages.ts.
// Call these helpers before dispatching to runFlutter/runPub to route to dn.

/**
 * Returns true if the given URI/folder belongs to a DartNative project.
 */
export function isUriInsideDartNativeProject(uri: vs.Uri | string): boolean {
	const folder = typeof uri === "string" ? uri : fsPath(uri);
	return isDartNativeProjectFolder(folder);
}

/**
 * Given a Flutter SDK path and a folder, resolves the correct binary path:
 * returns the `dn` executable if the folder is a DartNative project and `dn`
 * exists in the SDK, otherwise returns the flutter binary.
 */
export function resolveBinaryForFolder(sdkFlutterPath: string, folder: string): string {
	const isDartNative = isDartNativeProjectFolder(folder);
	const dnBinaryPath = path.join(sdkFlutterPath, "bin", executableNames.dn);
	const flutterBinaryPath = path.join(sdkFlutterPath, flutterPath);

	if (isDartNative && fs.existsSync(dnBinaryPath))
		return dnBinaryPath;

	return flutterBinaryPath;
}

/**
 * Returns global Flutter args — empty for DartNative projects since `dn`
 * does not accept Flutter-specific global flags.
 */
export function getArgsForFolder(folder: string, globalFlutterArgs: string[]): string[] {
	return isDartNativeProjectFolder(folder) ? [] : globalFlutterArgs;
}

/**
 * Returns the human-readable tool name ("dn" or "flutter") for display in
 * command palette and progress notifications.
 */
export function toolNameForFolder(folder: string): string {
	return isDartNativeProjectFolder(folder) ? "dn" : "flutter";
}
