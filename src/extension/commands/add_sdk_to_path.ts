import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vs from "vscode";
import { SdkTypeString, addSdkToPathAction, addSdkToPathPrompt, addToPathInstructionsUrl, addedToPathPrompt, copySdkPathToClipboardAction, isChromeOS, isLinux, isMac, isWin, noSdkAvailablePrompt, noThanksAction, openInstructionsAction, sdkAlreadyOnPathPrompt, unableToAddToPathPrompt } from "../../shared/constants";
import { IAmDisposable, Logger } from "../../shared/interfaces";
import { disposeAll } from "../../shared/utils";
import { envUtils } from "../../shared/vscode/utils";
import { WorkspaceContext } from "../../shared/workspace";
import { validateDartNativeSdkFolder } from "../../shared/dartnative/sdk_validation";
import { AddSdkToPathResult, Analytics } from "../analytics";
import { promptToLocateDartNativeSdk } from "../dartnative/sdk_locator";
import { runToolProcess } from "../utils/processes";

export class AddSdkToPath {
	constructor(protected readonly logger: Logger, protected readonly context: vs.ExtensionContext, protected readonly analytics: Analytics, protected readonly wsContext?: WorkspaceContext) { }

	public async addToPath(sdkType: SdkTypeString, sdkPath: string | undefined): Promise<void> {
		const isDartNative = sdkType === "DartNative" || !!this.wsContext?.hasAnyDartNativeProjects;
		if (isDartNative) {
			if (!sdkPath) {
				void promptToLocateDartNativeSdk(this.logger, "DartNative binary ('dn') not found. Please locate your DartNative SDK before adding it to PATH.", "dartnative.addSdkToPath");
				return;
			}
			const validation = validateDartNativeSdkFolder(sdkPath);
			if (!validation.valid || !validation.sdkPath) {
				void promptToLocateDartNativeSdk(this.logger, "DartNative binary ('dn') not found. Please locate your DartNative SDK before adding it to PATH.", "dartnative.addSdkToPath");
				return;
			}
			sdkPath = validation.sdkPath;
			sdkType = "DartNative";
		} else if (!sdkPath) {
			void vs.window.showErrorMessage(noSdkAvailablePrompt);
			return;
		}

		sdkPath = path.join(sdkPath, "bin");

		let result = AddSdkToPathResult.failed;
		try {
			result = this.canAddPathAutomatically()
				? isWin
					? await this.addToPathWindows(sdkPath)
					: await this.addToPathUnix(sdkPath)
				: AddSdkToPathResult.unavailableOnPlatform;
			if (result === AddSdkToPathResult.alreadyExisted || (result === AddSdkToPathResult.failed && process.env.PATH?.includes(sdkPath))) {
				void vs.window.showInformationMessage(sdkAlreadyOnPathPrompt(sdkType));
			} else if (result === AddSdkToPathResult.succeeded) {
				void vs.window.showInformationMessage(addedToPathPrompt(sdkType));
			} else if (this.canShowInstructions()) {
				await this.showManualInstructions(sdkType, sdkPath, result === AddSdkToPathResult.failed);
			}
		} finally {
			this.analytics.logAddSdkToPath(result);
		}
	}

	public async promptToAddToPath(sdkType: SdkTypeString, sdkPath: string): Promise<void> {
		if (!this.canAddPathAutomatically() && !this.canShowInstructions())
			return;

		// Update this check if we support this on other platforms in AddSdkToPath.addToPath.
		if (this.canAddPathAutomatically()) {
			const action = await vs.window.showInformationMessage(addSdkToPathPrompt(sdkType), addSdkToPathAction, noThanksAction);
			if (action === addSdkToPathAction)
				await this.addToPath(sdkType, sdkPath);
		} else {
			await this.showManualInstructions(sdkType, sdkPath);
		}
	}

	private canAddPathAutomatically(): boolean {
		return isWin || !!this.getUnixShellProfileFilename();
	}

	private canShowInstructions(): boolean {
		return !isChromeOS;
	}

	private async showManualInstructions(sdkType: SdkTypeString, sdkPath: string, didFailToAutomaticallyAdd = false): Promise<void> {
		if (!addToPathInstructionsUrl)
			return;

		while (true) {
			const action = didFailToAutomaticallyAdd
				? await vs.window.showWarningMessage(unableToAddToPathPrompt(sdkType), openInstructionsAction, copySdkPathToClipboardAction, noThanksAction)
				: await vs.window.showInformationMessage(addSdkToPathPrompt(sdkType), openInstructionsAction, copySdkPathToClipboardAction, noThanksAction);
			if (action === openInstructionsAction) {
				await envUtils.openInBrowser(addToPathInstructionsUrl);
			} else if (action === copySdkPathToClipboardAction) {
				await vs.env.clipboard.writeText(sdkPath);
			} else {
				break;
			}
		}
	}

	private async addToPathWindows(sdkPath: string): Promise<AddSdkToPathResult> {
		try {
			const scriptPath = this.context.asAbsolutePath("media/add_to_path.ps1");
			const result = await runToolProcess(
				this.logger,
				undefined,
				"powershell",
				[
					"-NoProfile",
					"-NonInteractive",
					"-WindowStyle", "Hidden",
					"-ExecutionPolicy", "Bypass",
					"-File", scriptPath,
					sdkPath,
				],
				undefined,
			);
			return result.exitCode === 12345
				? AddSdkToPathResult.alreadyExisted
				: result.exitCode
					? AddSdkToPathResult.failed
					: AddSdkToPathResult.succeeded;
		} catch (e) {
			this.logger.error(e);
			return AddSdkToPathResult.failed;
		}
	}

	private async addToPathUnix(sdkPath: string): Promise<AddSdkToPathResult> {
		const exportLine = `export PATH="${sdkPath}:$PATH"`;
		try {
			const profileFilename = this.getUnixShellProfileFilename();
			if (!profileFilename)
				return AddSdkToPathResult.unavailableOnPlatform;

			const profilePath = path.join(os.homedir(), profileFilename);
			let existingContents = "";
			try {
				existingContents = await fs.promises.readFile(profilePath, "utf8");
			} catch (e) {
				if ((e as NodeJS.ErrnoException).code !== "ENOENT")
					throw e;
			}

			if (existingContents.includes(exportLine))
				return AddSdkToPathResult.alreadyExisted;

			const needsLeadingNewline = existingContents.length > 0 && !existingContents.endsWith("\n");
			const prefix = needsLeadingNewline ? "\n" : "";
			await fs.promises.appendFile(profilePath, `${prefix}${exportLine}\n`);
			return AddSdkToPathResult.succeeded;
		} catch (e) {
			this.logger.error(e);
			return AddSdkToPathResult.failed;
		}
	}

	/// Gets the name of the profile file that we can add `export PATH=` to on macOS/Linux.
	private getUnixShellProfileFilename(): string | undefined {
		if (!isMac && !isLinux)
			return undefined;

		const shell = process.env.SHELL ? path.basename(process.env.SHELL) : undefined;
		switch (shell) {
			case "bash":
				return isMac ? ".bash_profile" : ".bashrc";
			case "zsh":
				return ".zshenv";
			default:
				return undefined;
		}
	}
}

export class AddSdkToPathCommands extends AddSdkToPath implements IAmDisposable {
	private disposables: IAmDisposable[] = [];

	constructor(logger: Logger, context: vs.ExtensionContext, wsContext: WorkspaceContext, analytics: Analytics) {
		super(logger, context, analytics, wsContext);

		this.disposables.push(vs.commands.registerCommand("dartnative.addSdkToPath", async () => {
			await this.addToPath("DartNative", wsContext.sdks.flutter);
		}));
		this.disposables.push(vs.commands.registerCommand("flutter.addSdkToPath", () => vs.commands.executeCommand("dartnative.addSdkToPath")));
	}

	public dispose(): void {
		disposeAll(this.disposables);
	}
}
