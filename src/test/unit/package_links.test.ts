import { strict as assert } from "assert";
import { getPubPackagePageUrl, rewritePubPackageUrl } from "../../shared/pub/package_links";

describe("Pub package links", () => {
	it("uses pub.dev for standard packages by default", () => {
		assert.equal(getPubPackagePageUrl("collection"), "https://pub.dev/packages/collection");
	});

	it("uses the DartNative plugin page for DartNative packages", () => {
		assert.equal(getPubPackagePageUrl("dartnative_media_picker"), "https://dartpub.dev/plugins/dartnative_media_picker");
	});

	it("uses plugin paths for packages hosted on dartpub.dev", () => {
		assert.equal(getPubPackagePageUrl("some_plugin", "https://dartpub.dev"), "https://dartpub.dev/plugins/some_plugin");
	});

	it("rewrites DartNative document links to dartpub.dev plugin pages", () => {
		assert.equal(rewritePubPackageUrl("https://pub.dev/packages/dartnative_media_picker"), "https://dartpub.dev/plugins/dartnative_media_picker");
	});

	it("leaves standard pub.dev document links unchanged", () => {
		assert.equal(rewritePubPackageUrl("https://pub.dev/packages/collection"), "https://pub.dev/packages/collection");
	});

	it("leaves non-package URLs unchanged", () => {
		assert.equal(rewritePubPackageUrl("https://dart.dev/tools"), "https://dart.dev/tools");
	});
});
