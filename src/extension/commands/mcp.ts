import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vs from "vscode";
import { dartVMPath, executableNames, isWin } from "../../shared/constants";
import { isDartNativeProjectFolder } from "../../shared/dartnative/project_detection";
import { fsPath } from "../../shared/utils/fs";
import { Logger } from "../../shared/interfaces";
import { runToolProcess } from "../utils/processes";
import { getFolderToRunCommandIn } from "../utils/vscode/projects";
import { config } from "../config";

const serverName = "dartnative";
const packageName = "dartnative_mcp";
const skillName = "dartnative-mcp";
const skillTargetMap: Array<{ target: string; ideIds: string[] }> = [
	{ target: path.join(".agents", "skills", skillName), ideIds: ["opencode", "antigravity", "codex", "agents"] },
	{ target: path.join(".cursor", "skills", skillName), ideIds: ["cursor"] },
	{ target: path.join(".claude", "skills", skillName), ideIds: ["claude"] },
];

interface IdeTarget {
	id: string;
	label: string;
	detectFolder: string;
	configPath: string;
	format: "vscode" | "mcpServers" | "opencode";
}

// Config locations follow the precedence/order from the Antigravity MCP docs:
//   - VS Code, Cursor keep their own folders.
//   - Claude Code keeps .mcp.json / .claude.
//   - Gemini CLI keeps .gemini/settings.json.
//   - OpenCode keeps opencode.json.
//   - Antigravity, Codex and other agents share .agents/mcp_config.json.
const ideTargets: IdeTarget[] = [
	{ id: "vscode", label: "VS Code", detectFolder: ".vscode", configPath: path.join(".vscode", "mcp.json"), format: "vscode" },
	{ id: "cursor", label: "Cursor", detectFolder: ".cursor", configPath: path.join(".cursor", "mcp.json"), format: "mcpServers" },
	{ id: "claude", label: "Claude Code", detectFolder: ".claude", configPath: ".mcp.json", format: "mcpServers" },
	{ id: "gemini", label: "Gemini CLI", detectFolder: ".gemini", configPath: path.join(".gemini", "settings.json"), format: "mcpServers" },
	{ id: "opencode", label: "OpenCode", detectFolder: ".", configPath: "opencode.json", format: "opencode" },
	{ id: "antigravity", label: "Antigravity", detectFolder: ".agents", configPath: path.join(".agents", "mcp_config.json"), format: "mcpServers" },
	{ id: "codex", label: "Codex", detectFolder: ".agents", configPath: path.join(".agents", "mcp_config.json"), format: "mcpServers" },
	{ id: "agents", label: "Other agents (.agents)", detectFolder: ".agents", configPath: path.join(".agents", "mcp_config.json"), format: "mcpServers" },
];

interface McpLaunch {
	command: string;
	args: string[];
}

/**
 * Installs the DartNative MCP server and its agent skill into a DartNative
 * project.
 *
 * The server is activated globally from GitHub so that re-running this command
 * always picks up the latest version. A project-local `.dartnative/mcp.bin`
 * launcher keeps the MCP client configuration stable and passes the SDK paths
 * without requiring a working directory.
 */
export async function installMcpServerCommand(
	logger: Logger,
	sdks: { dart?: string; flutter?: string } | undefined,
): Promise<void> {
	const folder = await getFolderToRunCommandIn(
		logger,
		"Select the DartNative project to install the MCP server into",
		{ onlyShowWorkspaceRoots: true },
	);
	if (!folder)
		return;

	if (!isDartNativeProjectFolder(folder)) {
		void vs.window.showErrorMessage(
			"The selected folder is not a DartNative project. Add a `dartnative` dependency to `pubspec.yaml` first.",
		);
		return;
	}

	const dnSdkPath = sdks?.flutter;
	if (!dnSdkPath) {
		void vs.window.showErrorMessage(
			"DartNative SDK not found. Run **DartNative: Locate SDK** and try again.",
		);
		return;
	}
	const dnBinary = path.join(dnSdkPath, "bin", executableNames.dn);
	if (!fs.existsSync(dnBinary)) {
		void vs.window.showErrorMessage(
			`The DartNative executable was not found at ${dnBinary}. Run **DartNative: Locate SDK** and try again.`,
		);
		return;
	}

	const dartSdkPath = sdks?.dart;
	if (!dartSdkPath) {
		void vs.window.showErrorMessage(
			"Dart SDK not found. Run **DartNative: Locate SDK** and try again.",
		);
		return;
	}
	const dartBinary = path.join(dartSdkPath, dartVMPath);
	if (!fs.existsSync(dartBinary)) {
		void vs.window.showErrorMessage(
			`The Dart executable was not found at ${dartBinary}. Run **DartNative: Locate SDK** and try again.`,
		);
		return;
	}

	const localPackagePath = resolveLocalPackagePath(logger);
	if (localPackagePath === null)
		return;

	const gitUrl = config.mcpServerGitUrl.trim();
	const gitRef = config.mcpServerGitRef.trim();
	if (!localPackagePath && !gitUrl) {
		void vs.window.showErrorMessage(
			"Set `dartnative.mcpServerGitUrl` to the Git URL of the dartnative_mcp package, or set `dartnative.mcpServerPackagePath` to a local package.",
		);
		return;
	}

	const pubCache = getPubCachePath();

	const output = vs.window.createOutputChannel("DartNative MCP");
	output.show(true);
	const logLine = (line: string) => {
		output.appendLine(line);
		logger.info(line);
	};

	// Detect installed IDEs and let the user choose which ones to configure.
	const detected = ideTargets.filter((ide) => {
		if (ide.detectFolder === ".")
			return fs.existsSync(path.join(folder, ide.configPath));
		return (
			fs.existsSync(path.join(folder, ide.detectFolder)) ||
			fs.existsSync(path.join(folder, ide.configPath))
		);
	});
	const quickPickItems = ideTargets.map((ide) => ({
		label: ide.label,
		description: detected.includes(ide) ? "detected" : "",
		picked: detected.includes(ide),
		ide,
	}));
	const selectedItems = await vs.window.showQuickPick(quickPickItems, {
		canPickMany: true,
		placeHolder: "Select the IDEs to configure with the DartNative MCP server",
		title: "DartNative: Install MCP Server",
	});
	if (!selectedItems || selectedItems.length === 0) {
		output.appendLine("Installation cancelled: no IDE selected.");
		return;
	}
	const selectedIdeIds = new Set(selectedItems.map((item) => item.ide.id));

	logLine(`Installing DartNative MCP server into ${folder}`);
	logLine(`Source: ${localPackagePath ?? gitUrl}${gitRef ? ` (${gitRef})` : ""}`);
	logLine(`Pub cache: ${pubCache}`);
	logLine(`Selected IDEs: ${selectedItems.map((item) => item.label).join(", ")}`);

	await vs.window.withProgress(
		{
			cancellable: false,
			location: vs.ProgressLocation.Notification,
			title: "Installing DartNative MCP server",
		},
		async (progress) => {
			progress.report({
				message: localPackagePath
					? "Activating dartnative_mcp from the local path"
					: "Fetching dartnative_mcp from GitHub",
			});
			const activateArgs = localPackagePath
				? ["pub", "global", "activate", "--source", "path", localPackagePath, "--no-executables"]
				: [
					"pub",
					"global",
					"activate",
					"--source",
					"git",
					gitUrl,
					...(gitRef ? ["--git-ref", gitRef] : []),
					"--no-executables",
				];
			const activateResult = await runToolProcess(
				logger,
				folder,
				dartBinary,
				activateArgs,
				{ PUB_CACHE: pubCache },
			);
			if (activateResult.exitCode !== 0) {
				// Pub can report an error while updating unrelated executable shims
				// (for example a corrupt shim in the pub cache) even though the
				// package was activated. Verify by running the server before failing.
				const details = activateResult.stderr || activateResult.stdout;
				logLine(`dart pub global activate exited with ${activateResult.exitCode}: ${details}`);
			} else {
				logLine("dart pub global activate completed successfully.");
			}

			progress.report({ message: "Verifying dartnative_mcp" });
			const verifyResult = await runToolProcess(
				logger,
				folder,
				dartBinary,
				["pub", "global", "run", packageName, "--version"],
				{ PUB_CACHE: pubCache },
			);
			if (verifyResult.exitCode !== 0) {
				const details = activateResult.stderr || activateResult.stdout || verifyResult.stderr || verifyResult.stdout;
				logger.error(`Failed to install ${packageName}: ${details}`);
				void vs.window.showErrorMessage(
					`Failed to install ${packageName}: ${details}`,
				);
				return;
			}
			const installedVersion = verifyResult.stdout.trim() || "(version unknown)";
			logLine(`Activated ${packageName} ${installedVersion}.`);

			progress.report({ message: "Writing .dartnative/mcp.bin" });
			let launch: McpLaunch;
			try {
				launch = writeLauncher(folder, dartBinary, dnSdkPath, pubCache);
			} catch (e) {
				logger.error(`Failed to write the MCP launcher: ${e}`);
				void vs.window.showErrorMessage(`Failed to write the MCP launcher: ${e}`);
				return;
			}
			logLine(`Wrote launcher: ${isWin ? ".dart_tool/mcp.bin.cmd" : ".dart_tool/mcp.bin"}`);

			progress.report({ message: "Writing MCP client configuration" });
			const written = writeMcpConfigs(folder, launch, selectedIdeIds);
			if (written.length === 0) {
				void vs.window.showErrorMessage(
					"Could not write any MCP configuration. Existing files may contain invalid JSON.",
				);
				return;
			}
			logLine("Configured MCP clients:");
			for (const file of written) logLine(`  - ${file}`);

			progress.report({ message: "Copying the agent skill" });
			const installedPackagePath = localPackagePath ?? findInstalledPackagePath(pubCache, logger);
			if (installedPackagePath) {
				const copiedSkills = copySkill(logger, installedPackagePath, folder, selectedIdeIds);
				if (copiedSkills.length > 0) {
					logLine("Installed skills:");
					for (const target of copiedSkills) logLine(`  - ${target}/SKILL.md`);
				} else {
					logLine("No agent skills copied (none of the selected IDEs use skills).");
				}
			} else {
				logLine("Agent skill was not copied (package path not found).");
			}

			const launcher = isWin ? ".dart_tool/mcp.bin.cmd" : ".dart_tool/mcp.bin";
			logLine("");
			logLine("Summary:");
			logLine(`  Source: ${localPackagePath ?? gitUrl}${gitRef ? ` (${gitRef})` : ""}`);
			logLine(`  Version: ${installedVersion}`);
			logLine(`  Launcher: ${launcher}`);
			logLine(`  IDEs: ${selectedItems.map((item) => item.label).join(", ")}`);
			logLine("  Restart your MCP client to connect.");
			logger.info(
				`Installed the DartNative MCP server in ${folder} (configs: ${written.join(", ")}).`,
			);
			void vs.window
				.showInformationMessage(
					`DartNative MCP server installed (${launcher}). Restart your MCP client to connect.`,
					"Open output",
					"Open .vscode/mcp.json",
				)
				.then((choice) => {
					if (choice === "Open output") {
						output.show(true);
					} else if (choice === "Open .vscode/mcp.json") {
						void vs.window.showTextDocument(
							vs.Uri.file(path.join(folder, ".vscode", "mcp.json")),
						);
					}
				});
		},
	);
}

/**
 * Returns the configured local package path, or undefined when the install
 * should use Git.
 *
 * If the setting is present but invalid, shows an error and returns null so the
 * caller can abort without silently falling back to a different source.
 */
function resolveLocalPackagePath(logger: Logger): string | undefined | null {
	const configured = config.mcpServerPackagePath;
	if (!configured)
		return undefined;

	const resolved = path.resolve(expandHome(configured));
	if (isMcpPackage(resolved))
		return resolved;

	logger.error(`Invalid dartnative.mcpServerPackagePath: ${resolved}`);
	void vs.window.showErrorMessage(
		`${resolved} is not a dartnative_mcp package (expected pubspec.yaml and bin/dartnative_mcp.dart).`,
	);
	return null;
}

function isMcpPackage(folder: string): boolean {
	return (
		fs.existsSync(path.join(folder, "pubspec.yaml")) &&
		fs.existsSync(path.join(folder, "bin", "dartnative_mcp.dart"))
	);
}

/**
 * The pub cache used by both `pub global activate` and the generated launcher.
 *
 * The launcher must not rely on the MCP client's environment, because clients
 * often start the server without the same `PUB_CACHE` that VS Code used.
 */
function getPubCachePath(): string {
	const configured = process.env.PUB_CACHE?.trim();
	if (configured)
		return path.resolve(expandHome(configured));

	if (isWin) {
		const localAppData = process.env.LOCALAPPDATA?.trim();
		if (localAppData)
			return path.join(localAppData, "Pub", "Cache");
	}

	return path.join(os.homedir(), ".pub-cache");
}

function expandHome(value: string): string {
	if (value === "~")
		return os.homedir();
	if (value.startsWith("~/") || value.startsWith("~\\"))
		return path.join(os.homedir(), value.slice(2));
	return value;
}

/**
 * Writes the project-local launcher used by every MCP client.
 *
 * The launcher runs the globally activated package with the DartNative SDK
 * paths already supplied, so the client only needs to know the launcher path.
 */
function writeLauncher(
	projectFolder: string,
	dartBinary: string,
	dnSdkPath: string,
	pubCache: string,
): McpLaunch {
	const launcherDir = path.join(projectFolder, ".dart_tool");
	fs.mkdirSync(launcherDir, { recursive: true });

	if (isWin) {
		const launcherPath = path.join(launcherDir, "mcp.bin.cmd");
		const content = [
			"@echo off",
			"REM Generated by DartNative: Install MCP Server. Do not edit.",
			`set "PUB_CACHE=${pubCache}"`,
			`${cmdQuote(dartBinary)} pub global run ${packageName} --dn-sdk ${cmdQuote(dnSdkPath)} --enable cli %*`,
			"",
		].join("\r\n");
		fs.writeFileSync(launcherPath, content);
		// A .cmd file cannot be spawned directly on Windows, so route it through
		// the command interpreter.
		return {
			command: process.env.ComSpec || "cmd.exe",
			args: ["/c", launcherPath],
		};
	}

	const launcherPath = path.join(launcherDir, "mcp.bin");
	const content = [
		"#!/bin/sh",
		"# Generated by DartNative: Install MCP Server. Do not edit.",
		`PUB_CACHE=${shQuote(pubCache)}`,
		"export PUB_CACHE",
		`exec ${shQuote(dartBinary)} pub global run ${packageName} --dn-sdk ${shQuote(dnSdkPath)} --enable cli "$@"`,
		"",
	].join("\n");
	fs.writeFileSync(launcherPath, content);
	fs.chmodSync(launcherPath, 0o755);
	return { command: launcherPath, args: [] };
}

function shQuote(value: string): string {
	return `'${value.replace(/'/g, "'\\''")}'`;
}

function cmdQuote(value: string): string {
	return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Finds the globally activated `dartnative_mcp` package so its skill can be
 * copied into the project.
 */
function findInstalledPackagePath(
	pubCache: string,
	logger: Logger,
): string | undefined {
	const packageConfigPath = path.join(
		pubCache,
		"global_packages",
		packageName,
		".dart_tool",
		"package_config.json",
	);
	if (!fs.existsSync(packageConfigPath)) {
		logger.warn(
			`Could not find ${packageConfigPath}; the agent skill was not copied.`,
		);
		return undefined;
	}

	try {
		const packageConfig = JSON.parse(fs.readFileSync(packageConfigPath, "utf8")) as {
			packages?: Array<{ name?: string; rootUri?: string }>;
		};
		const packageEntry = packageConfig.packages?.find((p) => p.name === packageName);
		if (!packageEntry?.rootUri) {
			logger.warn(
				`${packageConfigPath} does not contain a ${packageName} entry; the agent skill was not copied.`,
			);
			return undefined;
		}

		const packagePath = fsPath(vs.Uri.parse(packageEntry.rootUri));
		if (!fs.existsSync(packagePath)) {
			logger.warn(
				`The activated ${packageName} package was not found at ${packagePath}; the agent skill was not copied.`,
			);
			return undefined;
		}
		return packagePath;
	} catch (e) {
		logger.warn(`Failed to read ${packageConfigPath}: ${e}`);
		return undefined;
	}
}

function copySkill(
	logger: Logger,
	packagePath: string,
	folder: string,
	selectedIdeIds: Set<string>,
): string[] {
	const skillSource = path.join(packagePath, "skills", skillName, "SKILL.md");
	if (!fs.existsSync(skillSource)) {
		logger.warn(`Skill file not found at ${skillSource}; skipping.`);
		return [];
	}

	const copied: string[] = [];
	for (const { target, ideIds } of skillTargetMap) {
		if (!ideIds.some((id) => selectedIdeIds.has(id)))
			continue;
		const targetDir = path.join(folder, target);
		fs.mkdirSync(targetDir, { recursive: true });
		fs.copyFileSync(skillSource, path.join(targetDir, "SKILL.md"));
		copied.push(target);
	}
	return copied;
}

function writeMcpConfigs(folder: string, launch: McpLaunch, selectedIdeIds: Set<string>): string[] {
	const written: string[] = [];
	const writtenPaths = new Set<string>();

	const write = (
		relativePath: string,
		update: (json: Record<string, any>) => void,
	): void => {
		if (writtenPaths.has(relativePath))
			return;
		writtenPaths.add(relativePath);
		const file = path.join(folder, relativePath);
		let json: Record<string, any> = {};
		if (fs.existsSync(file)) {
			try {
				json = JSON.parse(fs.readFileSync(file, "utf8"));
			} catch {
				void vs.window.showWarningMessage(
					`Skipped ${relativePath} because it is not valid JSON.`,
				);
				return;
			}
		}
		update(json);
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, `${JSON.stringify(json, undefined, 2)}\n`);
		written.push(relativePath);
	};

	for (const ide of ideTargets.filter((item) => selectedIdeIds.has(item.id))) {
		if (ide.format === "vscode") {
			write(ide.configPath, (json) => {
				json.servers ??= {};
				json.servers[serverName] = {
					type: "stdio",
					command: launch.command,
					args: launch.args,
				};
			});
		} else if (ide.format === "opencode") {
			write(ide.configPath, (json) => {
				json.mcp ??= {};
				json.mcp[serverName] = {
					type: "local",
					command: [launch.command, ...launch.args],
					enabled: true,
				};
			});
		} else {
			write(ide.configPath, (json) => {
				json.mcpServers ??= {};
				json.mcpServers[serverName] = {
					command: launch.command,
					args: launch.args,
				};
			});
		}
	}

	return written;
}
