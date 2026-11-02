const defaultPubHostedUrl = "https://pub.dev";
const dartPubHostedUrl = "https://dartpub.dev";

/// Returns the URL for a package page on its pub host. DartNative packages are
/// always served by dartpub.dev, which uses /plugins/ instead of /packages/.
export function getPubPackagePageUrl(packageName: string, pubHostedUrl: string = defaultPubHostedUrl): string {
	const isDartNative = isDartNativePackage(packageName);
	const hostedUrl = (isDartNative ? dartPubHostedUrl : pubHostedUrl).replace(/\/$/, "");
	const pathSegment = isDartNative || isDartPubHost(hostedUrl) ? "plugins" : "packages";
	return `${hostedUrl}/${pathSegment}/${packageName}`;
}

/// Rewrites package page URLs provided by the analysis server so that DartNative
/// packages and packages hosted on dartpub.dev link to the correct pages.
export function rewritePubPackageUrl(url: string): string {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return url;
	}

	const match = /^\/(?:packages|plugins)\/([^/]+)/.exec(parsed.pathname);
	if (!match)
		return url;

	const packageName = match[1];
	const isDartNative = isDartNativePackage(packageName);
	if (!isDartNative && !isDartPubHost(parsed.hostname))
		return url;

	if (isDartNative)
		parsed.hostname = "dartpub.dev";
	parsed.pathname = `/${isDartNative || isDartPubHost(parsed.hostname) ? "plugins" : "packages"}/${packageName}`;

	return parsed.toString();
}

function isDartPubHost(value: string): boolean {
	return value.toLowerCase().includes("dartpub.dev");
}

function isDartNativePackage(packageName: string): boolean {
	return packageName === "dartnative" || packageName.startsWith("dartnative_");
}
