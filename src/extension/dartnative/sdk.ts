import * as fs from "fs";
import * as path from "path";
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
	for (const searchPath of searchPaths) {
		if (!searchPath) continue;
		candidatePaths.push(searchPath);

		const hasDnBinary =
			containsFile(searchPath, "bin/" + executableNames.dn) ||
			containsFile(searchPath, executableNames.dn);

		if (!hasDnBinary) continue;

		const hasAnchor =
			containsFile(searchPath, "analysis_options.yaml") ||
			containsFile(searchPath, "bin/dn") ||
			containsFile(searchPath, "bin/dn.bat") ||
			containsFile(searchPath, "bin/flutter");

		if (hasAnchor) {
			logger.info(`Found DartNative SDK at: ${searchPath}`);
			return { sdkPath: searchPath, candidatePaths };
		}
	}
	return { sdkPath: undefined, candidatePaths };
}

/**
 * Given a resolved Flutter/DartNative SDK path, returns the path to the
 * `dn` executable if it exists, otherwise falls back to flutter.
 */
export function resolveDnExecutable(sdkFlutterPath: string, flutterExecutable: string): string {
	const dnPath = path.join(sdkFlutterPath, "bin", executableNames.dn);
	if (fs.existsSync(dnPath))
		return dnPath;
	return flutterExecutable;
}

/**
 * Returns true if the workspace folder, cwd, or program is inside a DartNative project,
 * or if the SDK contains a `dn` binary.
 */
export function isDartNativeDebugSession(opts: {
	workspaceFolderUri?: { fsPath: string } | undefined;
	cwd?: string | undefined;
	program?: string | undefined;
	sessionName?: string | undefined;
	sdkFlutterPath?: string | undefined;
}): boolean {
	const { workspaceFolderUri, cwd, program, sessionName, sdkFlutterPath } = opts;

	if (workspaceFolderUri && isDartNativeProjectFolder(fsPath(workspaceFolderUri as any)))
		return true;
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

/**
 * Returns true if any ancestor folder of the given file path is a DartNative project folder.
 */
export function isPathInsideDartNativeProject(filePath: string): boolean {
	let dir = path.dirname(filePath);
	// Walk up at most 10 levels to find a pubspec that references dartnative.
	for (let i = 0; i < 10; i++) {
		if (isDartNativeProjectFolder(dir))
			return true;
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return false;
}
