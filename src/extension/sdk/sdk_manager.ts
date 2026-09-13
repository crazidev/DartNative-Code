import * as fs from "fs";
import * as path from "path";
import * as vs from "vscode";
import { dartVMPath, executableNames, flutterPath } from "../../shared/constants";
import { Logger, Sdks } from "../../shared/interfaces";
import { versionIsAtLeast } from "../../shared/utils";
import { existsAndIsFileSync, getChildFolders, getSdkVersion, homeRelativePath, safeRealpathSync } from "../../shared/utils/fs";
import { config } from "../config";

abstract class SdkManager {
	constructor(private readonly logger: Logger, protected readonly sdks: Sdks) { }

	protected abstract get sdkPaths(): string[];
	protected abstract get currentSdk(): string | undefined;
	protected abstract get configuredSdk(): string | undefined;
	protected abstract get configName(): string;
	protected abstract get executablePath(): string;
	protected abstract getLabel(version: string): string;
	protected abstract clearWorkspaceSdk(): void;
	protected abstract setSdk(folder: string | undefined, target: vs.ConfigurationTarget): void;
	/** Returns true if the given folder looks like a valid SDK for this manager. Override for multi-binary support. */
	protected isSdkFolder(folder: string): boolean {
		return existsAndIsFileSync(path.join(folder, this.executablePath));
	}

	public changeSdk() {
		void this.promptForSdk(this.sdkPaths || []).catch((e) => this.logger.error(e));
	}

	public async promptForSdk(sdkPaths: string[]): Promise<void> {
		let allPaths: string[] = [];
		for (const sdkPath of sdkPaths.filter(fs.existsSync)) {
			allPaths.push(sdkPath);
			// Add immediate children to support folders-of-SDKs.
			allPaths = allPaths.concat(await getChildFolders(this.logger, sdkPath));
		}

		// Add in the current path if it's not there.
		if (this.currentSdk && !allPaths.includes(this.currentSdk))
			allPaths.push(this.currentSdk);

		const sdkFolders = allPaths
			.filter((f) => this.isSdkFolder(f)); // Only those that look like SDKs.

		const sdkItems: SdkPickItem[] = sdkFolders.map((f) => {
			// Resolve symlinks so we look in correct folder for version file.
			const actualBinary = safeRealpathSync(path.join(f, this.executablePath));
			// Then we need to take the executable name and /bin back off
			const actualFolder = path.dirname(path.dirname(actualBinary));

			const version = getSdkVersion(this.logger, { sdkRoot: actualFolder });
			return {
				description: f === this.currentSdk && this.configuredSdk ? "Current setting" : "",
				detail: homeRelativePath(f),
				folder: f,
				label: version ? this.getLabel(version) : "Unknown version",
				version,
			};
		})
			.sort((a, b) => versionIsAtLeast(a.version || "0.0.0", b.version || "0.0.0") ? 1 : -1);

		const browseItem: SdkPickItem = {
			description: "",
			detail: "Browse the file system using folder picker",
			folder: "__locate__",
			label: "$(folder) Locate SDK (Browse...)",
			version: undefined,
		};

		const items = ([{
			description: !this.configuredSdk ? "Current setting" : "",
			detail: !this.configuredSdk ? `Found at ${this.currentSdk}` : undefined,
			folder: undefined,
			label: "Auto-detect SDK location",
			version: undefined,
		} as SdkPickItem, browseItem]).concat(sdkItems);

		await vs.window.showQuickPick(items, { placeHolder: "Select an SDK to use" })
			.then((sdk) => {
				if (!sdk)
					return;

				if (sdk.folder === "__locate__") {
					void vs.commands.executeCommand("dart.locateDartNativeSdk");
					return;
				}

				const folder = homeRelativePath(sdk.folder);
				if (config.sdkSwitchingTarget === "global") {
					// Clear any existing workspace setting first.
					this.clearWorkspaceSdk();
					this.setSdk(folder, vs.ConfigurationTarget.Global);
				} else {
					this.setSdk(folder, vs.ConfigurationTarget.Workspace);
				}
			});
	}
}

export class DartSdkManager extends SdkManager {
	protected get sdkPaths(): string[] { return config.sdkPaths; }
	protected get currentSdk(): string | undefined { return this.sdks.dart; }
	protected get configuredSdk(): string | undefined { return config.sdkPath; }
	protected get configName(): string { return "dart.sdkPaths"; }
	protected get executablePath() { return dartVMPath; }
	protected getLabel(version: string) {
		return `Dart SDK ${version}`;
	}
	protected clearWorkspaceSdk() {
		if (config.workspaceSdkPath)
			void config.setSdkPath(undefined, vs.ConfigurationTarget.Workspace);
	}
	protected setSdk(folder: string | undefined, target: vs.ConfigurationTarget) {
		void config.setSdkPath(folder, target);
	}
}

export class FlutterSdkManager extends SdkManager {
	// Uses dartNativeSdkPaths so the quick-pick works for DartNative SDK switching.
	protected get sdkPaths(): string[] { return config.dartNativeSdkPaths; }
	protected get currentSdk(): string | undefined { return this.sdks.flutter; }
	protected get configuredSdk(): string | undefined { return config.dartNativeSdkPath; }
	protected get configName(): string { return "dartx.dartNativeSdkPaths"; }
	// Used as a fallback executable to determine SDK folders; dn is preferred.
	protected get executablePath() { return flutterPath; }
	protected isSdkFolder(folder: string): boolean {
		// Accept either bin/dn or bin/flutter as evidence of a DartNative SDK.
		return existsAndIsFileSync(path.join(folder, "bin", executableNames.dn))
			|| existsAndIsFileSync(path.join(folder, flutterPath));
	}
	protected getLabel(version: string) {
		return `DartNative SDK ${version}`;
	}
	protected clearWorkspaceSdk() {
		if (config.workspaceFlutterSdkPath)
			void config.setDartNativeSdkPath(undefined, vs.ConfigurationTarget.Workspace);
	}
	protected setSdk(folder: string | undefined, target: vs.ConfigurationTarget) {
		void config.setDartNativeSdkPath(folder, target);
	}
}

interface SdkPickItem {
	description: string;
	detail: string | undefined;
	folder: string | undefined;
	label: string;
	version: string | undefined;
}
