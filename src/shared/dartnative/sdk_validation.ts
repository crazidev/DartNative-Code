import * as os from "os";
import * as path from "path";
import { executableNames } from "../constants";
import { existsAndIsDirectorySync, existsAndIsFileSync } from "../utils/fs";

export interface ValidationResult {
	valid: boolean;
	reason?: string;
	sdkPath?: string;
}

function hasDnExecutable(dir: string): boolean {
	const binDn = path.join(dir, executableNames.dn);
	const binDnUnix = path.join(dir, "dn");
	const binDnBat = path.join(dir, "dn.bat");
	const binDnExe = path.join(dir, "dn.exe");
	return existsAndIsFileSync(binDn) || existsAndIsFileSync(binDnUnix) || existsAndIsFileSync(binDnBat) || existsAndIsFileSync(binDnExe);
}

/**
 * Validates whether the given folder path points to a valid DartNative SDK
 * containing the `dn` executable in `bin/` or in the selected folder itself (e.g. when user selects `bin`).
 */
export function validateDartNativeSdkFolder(folder: string): ValidationResult {
	if (!folder?.trim())
		return { valid: false, reason: "No folder specified." };

	const resolvedFolder = path.resolve(folder.startsWith("~/") ? path.join(os.homedir(), folder.slice(2)) : folder);
	if (!existsAndIsDirectorySync(resolvedFolder))
		return { valid: false, reason: `The directory does not exist: ${resolvedFolder}` };

	// 1. Check for bin/dn within the selected folder (standard SDK root selected).
	if (hasDnExecutable(path.join(resolvedFolder, "bin"))) {
		return {
			sdkPath: resolvedFolder,
			valid: true,
		};
	}

	// 2. Check for dn directly within the selected folder (case where user selects the bin folder itself).
	if (hasDnExecutable(resolvedFolder)) {
		const isBinDir = path.basename(resolvedFolder).toLowerCase() === "bin";
		const sdkPath = isBinDir ? path.dirname(resolvedFolder) : resolvedFolder;
		return {
			sdkPath,
			valid: true,
		};
	}

	return {
		reason: `The selected folder "${resolvedFolder}" does not contain a valid DartNative SDK: could not find "bin/dn" or "dn".`,
		valid: false,
	};
}

