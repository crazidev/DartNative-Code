import * as fs from "fs";
import * as path from "path";
import { Uri } from "vscode";
import { executableNames } from "../../shared/constants";
import { Logger } from "../../shared/interfaces";
import { isDartNativeProjectFolder } from "../../shared/dartnative/project_detection";
import { fsPath } from "../../shared/utils/fs";

// NOTE: DartNative SDK resolution logic extracted from src/extension/sdk/utils.ts.
// SdkUtils.findDartNativeSdk() and the scanWorkspace() DartNative block reference these.

export interface SdkSearchResult {
	sdkPath: string | undefined;
	candidatePaths: string[];
}

/**
 * Searches the given folders for the DartNative SDK (identified by the
 * presence of the `dn` binary alongside either `bin/flutter`, `bin/dn`,
 * or `analysis_options.yaml`).
 */
export function findDartNativeSdk(
	logger: Logger,
	searchPaths: string[],
	containsFile: (folder: string, filePath: string) => boolean,
): SdkSearchResult {
	const candidatePaths: string[] = [];

	for (const folder of searchPaths) {
		if (!folder) continue;
		candidatePaths.push(folder);
		// Does this folder look like a DartNative SDK?
		if (isDartNativeSdk(folder, containsFile)) {
			logger.info(`Found DartNative SDK at ${folder}`);
			return { candidatePaths, sdkPath: folder };
		}
	}

	return { candidatePaths, sdkPath: undefined };
}

/**
 * Returns true if the folder contains a DartNative SDK.
 */
export function isDartNativeSdk(
	folder: string,
	containsFile: (folder: string, filePath: string) => boolean,
): boolean {
	const hasDnBinary = containsFile(folder, `bin/${executableNames.dn}`);
	const hasFlutterBinary = containsFile(folder, `bin/${executableNames.flutter}`);
	return hasDnBinary && (hasFlutterBinary || containsFile(folder, "bin/dn") || containsFile(folder, "analysis_options.yaml"));
}

/**
 * Given a resolved DartNative SDK path, returns the path to the
 * `dn` executable if it exists, otherwise throws or returns fallback if provided.
 */
export function resolveDnExecutable(sdkFlutterPath: string, fallbackExecutable?: string): string {
	const dnPath = path.join(sdkFlutterPath, "bin", executableNames.dn);
	if (fs.existsSync(dnPath))
		return dnPath;
	if (fallbackExecutable)
		return fallbackExecutable;
	throw new Error(`DartNative binary ('dn') not found in SDK: ${sdkFlutterPath}`);
}

/**
 * Returns true if a path is inside a DartNative project folder.
 */
export function isPathInsideDartNativeProject(targetPath: string): boolean {
	let current = path.resolve(targetPath);
	while (true) {
		if (isDartNativeProjectFolder(current))
			return true;
		const parent = path.dirname(current);
		if (parent === current)
			break;
		current = parent;
	}
	return false;
}

/**
 * Returns true if the debug session should be treated as a DartNative session,
 * based on workspace folder, program path, cwd, session name,
 * or if the SDK contains a `dn` binary.
 */
export function isDartNativeDebugSession(opts: {
	workspaceFolderUri?: Uri | string | undefined;
	cwd?: string | undefined;
	program?: string | undefined;
	sessionName?: string | undefined;
	sdkFlutterPath?: string | undefined;
}): boolean {
	const { workspaceFolderUri, cwd, program, sessionName, sdkFlutterPath } = opts;

	if (workspaceFolderUri) {
		const folderPath = typeof workspaceFolderUri === "string" ? workspaceFolderUri : fsPath(workspaceFolderUri);
		if (isDartNativeProjectFolder(folderPath))
			return true;
	}
	if (cwd && isDartNativeProjectFolder(cwd))
		return true;
	if (program && isPathInsideDartNativeProject(program))
		return true;
	if (sessionName?.includes("DartNative"))
		return true;
	if (sdkFlutterPath && fs.existsSync(path.join(sdkFlutterPath, "bin", executableNames.dn)))
		return true;

	return false;
}
