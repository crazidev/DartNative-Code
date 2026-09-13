// DartNative Extension Module
// ===========================
// This is the single entry point for all DartNative customizations.
// Import from here in extension code rather than from the individual modules
// to keep the dependency surface small and easy to track.

export { isDartNativeProjectFolder, projectReferencesDartNative, pubspecContentReferencesDartNative } from "../../shared/dartnative/project_detection";
export { findDartNativeSdk, resolveDnExecutable, isDartNativeDebugSession, isPathInsideDartNativeProject } from "./sdk";
export { patchProgressForDartNative, isDevToolsPageSupportedForDartNative } from "./debug_hooks";
export { isUriInsideDartNativeProject, resolveBinaryForFolder, getArgsForFolder, toolNameForFolder, buildDartNativeCliArgs } from "./cli_runner";
export { validateDartNativeSdkFolder, pickDartNativeSdkFolder, promptToLocateDartNativeSdk, setDartNativeLicenseKeyCommand } from "./sdk_locator";
