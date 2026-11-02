import { strict as assert } from "assert";
import { dartNativeReleaseNotesUrl } from "../../shared/constants";

describe("Release notes link", () => {
	it("opens the latest DartNative GitHub release", () => {
		assert.equal(dartNativeReleaseNotesUrl, "https://github.com/crazidev/DartNative-Code/releases");
	});
});
