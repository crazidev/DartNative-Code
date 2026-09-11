// NOTE: DartNative debug hooks extracted from src/extension/commands/debug.ts.
// Import and call patchProgressForDartNative() inside the dart.progressStart
// event handler in debug.ts instead of the inline replace calls.

/**
 * If the debug session is a DartNative session, replaces the Flutter branding
 * in progress notification titles and messages with DartNative.
 */
export function patchProgressForDartNative(
	isDartNative: boolean,
	title: string | undefined,
	message: string | undefined,
): { title: string | undefined; message: string | undefined } {
	if (!isDartNative)
		return { title, message };

	return {
		title: title?.replace(/\bFlutter\b/g, "DartNative"),
		message: message?.replace(/\bFlutter\b/g, "DartNative"),
	};
}

const dartNativeSupportedDevToolsPages = new Set(["memory", "network", "logging"]);

/**
 * Returns true if the given DevTools page ID is supported in DartNative projects.
 */
export function isDevToolsPageSupportedForDartNative(pageId: string): boolean {
	return dartNativeSupportedDevToolsPages.has(pageId);
}
