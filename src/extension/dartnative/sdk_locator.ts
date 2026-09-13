import * as fs from "fs";
import * as path from "path";
import * as vs from "vscode";
import { ExtensionRestartReason, executableNames } from "../../shared/constants";
import { Logger } from "../../shared/interfaces";
import { fsPath, homeRelativePath } from "../../shared/utils/fs";
import { config } from "../config";
import { promptToReloadExtension } from "../utils";
import { runToolProcess } from "../utils/processes";

import { ValidationResult, validateDartNativeSdkFolder } from "../../shared/dartnative/sdk_validation";

export { ValidationResult, validateDartNativeSdkFolder };

/**
 * Opens a folder picker dialog to select the DartNative SDK.
 * Automatically validates the chosen folder and throws/displays an error
 * containing a "Locate SDK" button if validation fails.
 */
export async function pickDartNativeSdkFolder(
	logger: Logger,
	prompt?: string,
	commandToReRun?: string,
): Promise<string | undefined> {
	const locateAction = "Locate SDK";

	const selectedUris = await vs.window.showOpenDialog({
		canSelectFiles: false,
		canSelectFolders: true,
		canSelectMany: false,
		openLabel: "Select DartNative SDK",
		title: prompt ?? "Select DartNative SDK Folder",
	});

	if (!selectedUris || selectedUris.length === 0)
		return undefined;

	const selectedFolder = fsPath(selectedUris[0]);
	const validation = validateDartNativeSdkFolder(selectedFolder);

	if (!validation.valid || !validation.sdkPath) {
		const errorMessage = validation.reason ?? `The selected folder "${selectedFolder}" does not appear to be a valid DartNative SDK.`;
		logger.error(errorMessage);
		const userAction = await vs.window.showErrorMessage(errorMessage, locateAction);
		if (userAction === locateAction)
			return pickDartNativeSdkFolder(logger, prompt, commandToReRun);
		return undefined;
	}

	const sdkPath = validation.sdkPath;
	const configPath = homeRelativePath(sdkPath);
	const target = vs.workspace.workspaceFolders?.length
		? vs.ConfigurationTarget.Workspace
		: vs.ConfigurationTarget.Global;

	await config.setDartNativeSdkPath(configPath, target);
	logger.info(`DartNative SDK set to "${configPath}" in configuration target ${target}`);

	await promptToReloadExtension(logger, {
		buttonText: "Reload",
		prompt: `DartNative SDK set to "${configPath}". Please reload the window to apply changes.`,
		restartReason: ExtensionRestartReason.LocatedSdk,
	});

	if (commandToReRun)
		void vs.commands.executeCommand(commandToReRun);

	return sdkPath;
}

/**
 * Displays a prompt notification asking the user to locate the DartNative SDK.
 * The notification contains a "Locate SDK" action button that immediately triggers
 * the folder picker.
 */
export async function promptToLocateDartNativeSdk(
	logger: Logger,
	message?: string,
	commandToReRun?: string,
): Promise<void> {
	const locateAction = "Locate SDK";
	const displayMessage = message ?? "DartNative binary ('dn') not found.";

	const userAction = await vs.window.showErrorMessage(displayMessage, locateAction);
	if (userAction === locateAction)
		await pickDartNativeSdkFolder(logger, undefined, commandToReRun);
}

/**
 * Interactive command to prompt the user for a DartNative license key,
 * persist it to configuration, and execute `dn config --license-key <key>`.
 */
export async function setDartNativeLicenseKeyCommand(logger: Logger, sdks?: { flutter?: string }): Promise<void> {
	const currentKey = config.dartNativeLicenseKey ?? "";
	const key = await vs.window.showInputBox({
		ignoreFocusOut: true,
		placeHolder: "dnk_*******************",
		prompt: "Paste your DartNative License Key",
		value: currentKey,
	});

	if (key === undefined)
		return;

	const trimmedKey = key.trim();
	await config.setDartNativeLicenseKey(trimmedKey || undefined, vs.ConfigurationTarget.Global);
	logger.info("DartNative License Key updated in global configuration.");

	// Run `dn config --license-key <key>` if dn is available.
	const sdkFolder = sdks?.flutter ?? config.dartNativeSdkPath;
	const dnBinary = sdkFolder ? path.join(sdkFolder, "bin", executableNames.dn) : undefined;
	const executableToRun = dnBinary && fs.existsSync(dnBinary) ? dnBinary : executableNames.dn;

	if (trimmedKey) {
		process.env.DN_LICENSE_KEY = trimmedKey;
		try {
			logger.info(`Running: ${executableToRun} config --license-key ***`);
			const result = await runToolProcess(logger, undefined, executableToRun, ["config", "--license-key", trimmedKey], { DN_LICENSE_KEY: trimmedKey });
			if (result.exitCode === 0) {
				void vs.window.showInformationMessage("DartNative License Key configured successfully.");
			} else {
				logger.warn(`dn config exited with code ${result.exitCode}: ${result.stderr || result.stdout}`);
				void vs.window.showInformationMessage(`DartNative License Key saved to settings. (CLI output: ${result.stdout || result.stderr})`);
			}
		} catch (err: any) {
			logger.error(`Failed to run dn config: ${err?.message}`);
			void vs.window.showInformationMessage("DartNative License Key saved to settings.");
		}
	} else {
		void vs.window.showInformationMessage("DartNative License Key cleared.");
	}
}
