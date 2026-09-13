import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vs from "vscode";
import { isDartCodeTestRun } from "../../shared/constants";
import { Logger, SpawnedProcess } from "../../shared/interfaces";
import { RunProcessResult, runProcess, safeSpawn } from "../../shared/processes";
import { dashIdeEnvironment, dashIdeName, dashIdeVersion, dashPluginName, dashPluginVersion, dashTool } from "../../shared/vscode/constants";

// Environment used when spawning Dart and Flutter processes.
let flutterRoot: string | undefined;
let toolEnv: Record<string, string> = {};
let globalFlutterArgs: string[] = [];
// Extra PATH entries to prepend for Dart/DartNative SDK bins.
let sdkBinPaths: string[] = [];

/**
 * Returns a copy of the tool env object merged with process.env.
 *
 * Mutations to toolEnv should be done via setupToolEnv/etc.
 */
export function getToolEnv(): Record<string, string> {
	const currentPath = process.env.PATH || "";
	const extraPaths = ["/opt/homebrew/bin", "/usr/local/bin", path.join(os.homedir(), ".gem/bin")].filter((p) => fs.existsSync(p));
	const currentPathSegments = currentPath.split(path.delimiter);
	const pathsToAdd = extraPaths.filter((p) => !currentPathSegments.includes(p));
	// Prepend SDK bin paths so spawned processes prefer the configured SDK.
	const sdkPathsToAdd = sdkBinPaths.filter((p) => p && !currentPathSegments.includes(p) && fs.existsSync(p));
	const effectivePath = [...sdkPathsToAdd, ...pathsToAdd, currentPath].filter((p) => p.length > 0).join(path.delimiter);

	const env: Record<string, string> = {};
	for (const key of Object.keys(process.env)) {
		const val = process.env[key];
		if (typeof val === "string")
			env[key] = val;
	}

	env.PATH = effectivePath;
	env.LANG = process.env.LANG || "en_US.UTF-8";
	env.LC_ALL = process.env.LC_ALL || "en_US.UTF-8";

	return Object.assign(env, toolEnv);
}

export function getGlobalFlutterArgs() {
	// Return a copy so we never have to worry about a caller mutating this.
	return globalFlutterArgs.slice();
}

export function setFlutterRoot(root: string) {
	flutterRoot = root;
}

/**
 * Records the DartNative SDK bin paths so they are prepended to PATH
 * for spawned processes (SDK bin + embedded Dart SDK bin).
 */
export function setSdkBinPaths(binPaths: string[]) {
	sdkBinPaths = binPaths;
}

export function setupToolEnv({ suppressAnalytics, envOverrides }: { suppressAnalytics: boolean, envOverrides?: any }) {
	toolEnv = {};
	globalFlutterArgs = [];

	// Add any user overrides first. Our values always override user set values.
	if (envOverrides)
		toolEnv = Object.assign(toolEnv, envOverrides);

	toolEnv.FLUTTER_HOST = "VSCode";
	if (isDartCodeTestRun) {
		globalFlutterArgs.push("--suppress-analytics");
	}

	// Always set FLUTTER_ROOT and DARTNATIVE_ROOT to match the SDK we are using if we have one.
	// We used to only set this if it wasn't already, and there wasn't one on the global process, but
	// this means if the user has an invalid path set (or a different version of the SDK), things could
	// fail oddly.
	if (flutterRoot) {
		toolEnv.FLUTTER_ROOT = flutterRoot;
		toolEnv.DARTNATIVE_ROOT = flutterRoot;
	}

	// Add the names/versions of each part of the tool.
	toolEnv.DASH__IDE_NAME = dashIdeName();
	toolEnv.DASH__IDE_VERSION = dashIdeVersion();
	toolEnv.DASH__PLUGIN_NAME = dashPluginName();
	toolEnv.DASH__PLUGIN_VERSION = dashPluginVersion();
	toolEnv.DASH__IDE_ENVIRONMENT = dashIdeEnvironment();
	// And those for unified analytics.
	toolEnv.DASH__TOOL = dashTool(); // This matches the "label" of the enum constant DashTool defined in unified analytics.
	toolEnv.DASH__SUPPRESS_ANALYTICS = `${suppressAnalytics}`; // This should be a string bool parsed with bool.parse() in Dart.
}

export function safeToolSpawn(workingDirectory: string | undefined, binPath: string, args: string[], envOverrides?: Record<string, string | undefined>): SpawnedProcess {
	const env = Object.assign({}, getToolEnv(), envOverrides) as Record<string, string | undefined> | undefined;
	return safeSpawn(workingDirectory, binPath, args, env);
}

/// Runs a process and returns the exit code, stdout, stderr. Always resolves even for non-zero exit codes.
export function runToolProcess(logger: Logger, workingDirectory: string | undefined, binPath: string, args: string[], envOverrides?: Record<string, string | undefined>, cancellationToken?: vs.CancellationToken): Promise<RunProcessResult> {
	return runProcess(logger, binPath, args, workingDirectory, envOverrides, safeToolSpawn, cancellationToken);
}
