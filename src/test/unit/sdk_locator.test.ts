import { strict as assert } from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { resolveBinaryForFolder } from "../../extension/dartnative/cli_runner";
import { resolveDnExecutable } from "../../extension/dartnative/sdk";
import { validateDartNativeSdkFolder } from "../../shared/dartnative/sdk_validation";

describe("DartNative SDK Locator & Validation", () => {
	let validSdkDir: string;
	let invalidSdkDir: string;
	let tempDnProjDir: string;

	before(() => {
		// Valid SDK directory with bin/dn
		validSdkDir = fs.mkdtempSync(path.join(os.tmpdir(), "valid-dn-sdk-"));
		fs.mkdirSync(path.join(validSdkDir, "bin"), { recursive: true });
		fs.writeFileSync(path.join(validSdkDir, "bin", "dn"), "#!/bin/sh\necho dn\n");

		// Invalid SDK directory missing bin/dn
		invalidSdkDir = fs.mkdtempSync(path.join(os.tmpdir(), "invalid-dn-sdk-"));
		fs.mkdirSync(path.join(invalidSdkDir, "bin"), { recursive: true });
		fs.writeFileSync(path.join(invalidSdkDir, "bin", "other"), "echo other\n");

		// DartNative project directory
		tempDnProjDir = fs.mkdtempSync(path.join(os.tmpdir(), "dn-proj-test-"));
		fs.writeFileSync(
			path.join(tempDnProjDir, "pubspec.yaml"),
			"name: test_dn\ndependencies:\n  dartnative: ^1.0.0\n",
		);
	});

	after(() => {
		try {
			fs.rmSync(validSdkDir, { force: true, recursive: true });
			fs.rmSync(invalidSdkDir, { force: true, recursive: true });
			fs.rmSync(tempDnProjDir, { force: true, recursive: true });
		} catch {
		}
	});

	describe("validateDartNativeSdkFolder", () => {
		it("validates valid SDK folder containing bin/dn", () => {
			const result = validateDartNativeSdkFolder(validSdkDir);
			assert.equal(result.valid, true);
			assert.equal(result.sdkPath, path.resolve(validSdkDir));
			assert.equal(result.reason, undefined);
		});

		it("validates when user selects the bin folder itself and resolves parent as sdkPath", () => {
			const binFolder = path.join(validSdkDir, "bin");
			const result = validateDartNativeSdkFolder(binFolder);
			assert.equal(result.valid, true);
			assert.equal(result.sdkPath, path.resolve(validSdkDir));
			assert.equal(result.reason, undefined);
		});

		it("fails validation for folder missing bin/dn and reports meaningful reason", () => {
			const result = validateDartNativeSdkFolder(invalidSdkDir);
			assert.equal(result.valid, false);
			assert.ok(result.reason?.includes("could not find \"bin/dn\""));
		});

		it("fails validation for non-existent folder", () => {
			const result = validateDartNativeSdkFolder("/nonexistent/sdk/path/zero");
			assert.equal(result.valid, false);
			assert.ok(result.reason?.includes("does not exist"));
		});

		it("fails validation for empty string", () => {
			const result = validateDartNativeSdkFolder("");
			assert.equal(result.valid, false);
			assert.ok(result.reason?.includes("No folder specified"));
		});
		it("fails validation for a folder containing bin/flutter but missing bin/dn", () => {
			const flutterOnlyDir = fs.mkdtempSync(path.join(os.tmpdir(), "flutter-only-sdk-"));
			try {
				fs.mkdirSync(path.join(flutterOnlyDir, "bin"), { recursive: true });
				fs.writeFileSync(path.join(flutterOnlyDir, "bin", "flutter"), "#!/bin/sh\necho flutter\n");
				const result = validateDartNativeSdkFolder(flutterOnlyDir);
				assert.equal(result.valid, false);
				assert.ok(result.reason?.includes("could not find \"bin/dn\""));
			} finally {
				fs.rmSync(flutterOnlyDir, { force: true, recursive: true });
			}
		});
	});

	describe("resolveBinaryForFolder (strict dn)", () => {
		it("resolves to bin/dn for DartNative project when dn exists", () => {
			const bin = resolveBinaryForFolder(validSdkDir, tempDnProjDir);
			assert.equal(bin, path.join(validSdkDir, "bin", "dn"));
		});

		it("throws an error and strictly refuses fallback to flutter for DartNative project", () => {
			assert.throws(
				() => resolveBinaryForFolder(invalidSdkDir, tempDnProjDir),
				/DartNative binary \('dn'\) not found in SDK/,
			);
		});
	});

	describe("resolveDnExecutable (strict dn)", () => {
		it("returns dn path when present", () => {
			const bin = resolveDnExecutable(validSdkDir);
			assert.equal(bin, path.join(validSdkDir, "bin", "dn"));
		});

		it("throws when dn is missing and no fallback executable provided", () => {
			assert.throws(
				() => resolveDnExecutable(invalidSdkDir),
				/DartNative binary \('dn'\) not found in SDK/,
			);
		});
	});
});
