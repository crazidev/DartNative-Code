import * as os from "os";
import * as path from "path";
import { executableNames } from "../constants";
import { existsAndIsDirectorySync, existsAndIsFileSync } from "../utils/fs";

export interface ValidationResult {
	valid: boolean;
	reason?: string;
	sdkPath?: string;
}

/**
 * Validates whether the given folder path points to a valid DartNative SDK
 * containing the `dn` executable in `bin/`.
 */
export function validateDartNativeSdkFolder(folder: string): ValidationResult {
	if (!folder?.trim())
		return { valid: false, reason: "No folder specified." };

	const resolvedFolder = path.resolve(folder.startsWith("~/") ? path.join(os.homedir(), folder.slice(2)) : folder);
	if (!existsAndIsDirectorySync(resolvedFolder))
		return { valid: false, reason: `The directory does not exist: ${resolvedFolder}` };

	// Check for bin/dn executable.
	const binDn = path.join(resolvedFolder, "bin", executableNames.dn);
	const binDnUnix = path.join(resolvedFolder, "bin", "dn");
	const binDnBat = path.join(resolvedFolder, "bin", "dn.bat");
	const binDnExe = path.join(resolvedFolder, "bin", "dn.exe");

	if (!existsAndIsFileSync(binDn) && !existsAndIsFileSync(binDnUnix) && !existsAndIsFileSync(binDnBat) && !existsAndIsFileSync(binDnExe)) {
		return {
			reason: `The selected folder "${resolvedFolder}" does not contain a valid DartNative SDK: could not find "bin/dn".`,
			valid: false,
		};
	}

	return {
		sdkPath: resolvedFolder,
		valid: true,
	};
}
