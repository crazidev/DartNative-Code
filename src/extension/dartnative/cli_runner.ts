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

/**
 * Builds the final CLI args list for a DartNative `dn` invocation.
 *
 * Properly positions global args, subcommand-specific additional args, and
 * the subcommand itself so that `dn` receives arguments in the expected order:
 *   dn [globalArgs] <subcommand> [subcommandArgs] [executionArgs...]
 *
 * For non-DartNative folders, returns the execution args unchanged and
 * expects the caller to prepend Flutter global args separately.
 */
export function buildDartNativeCliArgs(options: {
	folder: string;
	executionArgs: string[];
	globalAdditionalArgs: string[];
	runAdditionalArgs: string[];
	testAdditionalArgs: string[];
	pubAdditionalArgs?: string[];
}): { isDartNative: boolean; args: string[] } {
	const { folder, executionArgs, globalAdditionalArgs, runAdditionalArgs, testAdditionalArgs, pubAdditionalArgs = [] } = options;
	const dartNative = isDartNativeProjectFolder(folder);
	if (!dartNative)
		return { isDartNative: false, args: executionArgs };

	// Identify subcommand from the execution args.
	const subcommand = executionArgs[0];
	const subcommandArgs = subcommand === "run"
		? runAdditionalArgs
		: subcommand === "test"
			? testAdditionalArgs
			: [];
	const pubArgs = subcommand === "pub"
		? pubAdditionalArgs
		: [];

	// Order: global DartNative args, then subcommand-specific args, then all original execution args, then pub args.
	const dedupe = (src: string[], existing: string[]): string[] =>
		src.filter((a) => !existing.includes(a));

	const result: string[] = [];
	result.push(...globalAdditionalArgs);
	result.push(...dedupe(subcommandArgs, result));
	result.push(...executionArgs);
	result.push(...dedupe(pubArgs, result));

	return { isDartNative: true, args: result };
}
