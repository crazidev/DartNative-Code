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
	});
});
