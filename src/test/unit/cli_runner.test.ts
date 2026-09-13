import { strict as assert } from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { buildDartNativeCliArgs } from "../../extension/dartnative/cli_runner";
import { pubspecContentReferencesDartNative } from "../../shared/dartnative/project_detection";

describe("DartNative CLI Runner & Arg Passing", () => {
	let tempDnDir: string;
	let tempNormalDir: string;

	before(() => {
		tempDnDir = fs.mkdtempSync(path.join(os.tmpdir(), "dn-proj-"));
		fs.writeFileSync(
			path.join(tempDnDir, "pubspec.yaml"),
			"name: test_dn\ndependencies:\n  dartnative: ^1.0.0\n",
		);

		tempNormalDir = fs.mkdtempSync(path.join(os.tmpdir(), "normal-proj-"));
		fs.writeFileSync(
			path.join(tempNormalDir, "pubspec.yaml"),
			"name: test_normal\ndependencies:\n  http: ^1.0.0\n",
		);
	});

	after(() => {
		try {
			fs.rmSync(tempDnDir, { recursive: true, force: true });
			fs.rmSync(tempNormalDir, { recursive: true, force: true });
		} catch {
		}
	});

	describe("buildDartNativeCliArgs", () => {
		it("passes pubAdditionalArgs for pub get on DartNative project", () => {
			const result = buildDartNativeCliArgs({
				folder: tempDnDir,
				executionArgs: ["pub", "get", "--no-example"],
				globalAdditionalArgs: ["-v"],
				runAdditionalArgs: ["--enable-asserts"],
				testAdditionalArgs: ["--concurrency=2"],
				pubAdditionalArgs: ["--offline", "--dry-run"],
			});

			assert.equal(result.isDartNative, true);
			// Global args first, then execution args, then pubAdditionalArgs at the end.
			assert.deepEqual(result.args, [
				"-v",
				"pub",
				"get",
				"--no-example",
				"--offline",
				"--dry-run",
			]);
		});

		it("passes runAdditionalArgs for run subcommand on DartNative project", () => {
			const result = buildDartNativeCliArgs({
				folder: tempDnDir,
				executionArgs: ["run", "-d", "macos"],
				globalAdditionalArgs: ["-v"],
				runAdditionalArgs: ["--enable-asserts"],
				testAdditionalArgs: ["--concurrency=2"],
				pubAdditionalArgs: ["--offline"],
			});

			assert.equal(result.isDartNative, true);
			assert.deepEqual(result.args, [
				"-v",
				"--enable-asserts",
				"run",
				"-d",
				"macos",
			]);
		});

		it("passes testAdditionalArgs for test subcommand on DartNative project", () => {
			const result = buildDartNativeCliArgs({
				folder: tempDnDir,
				executionArgs: ["test", "test/app_test.dart"],
				globalAdditionalArgs: ["-v"],
				runAdditionalArgs: ["--enable-asserts"],
				testAdditionalArgs: ["--concurrency=2"],
				pubAdditionalArgs: ["--offline"],
			});

			assert.equal(result.isDartNative, true);
			assert.deepEqual(result.args, [
				"-v",
				"--concurrency=2",
				"test",
				"test/app_test.dart",
			]);
		});

		it("returns unchanged executionArgs for non-DartNative projects", () => {
			const result = buildDartNativeCliArgs({
				folder: tempNormalDir,
				executionArgs: ["pub", "get", "--no-example"],
				globalAdditionalArgs: ["-v"],
				runAdditionalArgs: ["--enable-asserts"],
				testAdditionalArgs: ["--concurrency=2"],
				pubAdditionalArgs: ["--offline"],
			});

			assert.equal(result.isDartNative, false);
			assert.deepEqual(result.args, ["pub", "get", "--no-example"]);
		});

		it("correctly identifies DartNative pubspec content", () => {
			const dnPubspec = `
name: my_app
dependencies:
  dartnative: ^1.0.0
`;
			assert.equal(pubspecContentReferencesDartNative(dnPubspec), true);

			const normalPubspec = `
name: my_app
dependencies:
  flutter:
    sdk: flutter
`;
			assert.equal(pubspecContentReferencesDartNative(normalPubspec), false);
		});

		it("appends --dart-define=DN_LICENSE_KEY=<key> only when subcommand is run", () => {
			const runResult = buildDartNativeCliArgs({
				folder: tempDnDir,
				executionArgs: ["run", "-d", "macos"],
				globalAdditionalArgs: [],
				runAdditionalArgs: [],
				testAdditionalArgs: [],
				licenseKey: "my_secret_key_123",
			});

			assert.equal(runResult.isDartNative, true);
			assert.ok(runResult.args.includes("--dart-define=DN_LICENSE_KEY=my_secret_key_123"));

			// pub commands should NOT include --dart-define=DN_LICENSE_KEY
			const pubResult = buildDartNativeCliArgs({
				folder: tempDnDir,
				executionArgs: ["pub", "get"],
				globalAdditionalArgs: [],
				runAdditionalArgs: [],
				testAdditionalArgs: [],
				licenseKey: "my_secret_key_123",
			});
			assert.equal(pubResult.args.some((a) => a.startsWith("--dart-define=DN_LICENSE_KEY=")), false);

			// test commands should NOT include --dart-define=DN_LICENSE_KEY
			const testResult = buildDartNativeCliArgs({
				folder: tempDnDir,
				executionArgs: ["test"],
				globalAdditionalArgs: [],
				runAdditionalArgs: [],
				testAdditionalArgs: [],
				licenseKey: "my_secret_key_123",
			});
			assert.equal(testResult.args.some((a) => a.startsWith("--dart-define=DN_LICENSE_KEY=")), false);
		});

		it("does not duplicate --dart-define=DN_LICENSE_KEY if already in args", () => {
			const result = buildDartNativeCliArgs({
				folder: tempDnDir,
				executionArgs: ["run", "--dart-define=DN_LICENSE_KEY=existing_key"],
				globalAdditionalArgs: [],
				runAdditionalArgs: [],
				testAdditionalArgs: [],
				licenseKey: "new_key",
			});

			assert.equal(result.isDartNative, true);
			const count = result.args.filter((a) => a.startsWith("--dart-define=DN_LICENSE_KEY=")).length;
			assert.equal(count, 1);
			assert.equal(result.args.includes("--dart-define=DN_LICENSE_KEY=existing_key"), true);
		});
	});
});
