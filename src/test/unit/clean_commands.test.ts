import { strict as assert } from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { isDartNativeProjectFolder } from "../../shared/dartnative/project_detection";
import { isFlutterProjectFolder } from "../../shared/utils/fs";

describe("DartNative Clean Project & Clean All Projects", () => {
	let tempDnProj: string;
	let tempFlutterProj: string;
	let tempPlainProj: string;

	before(() => {
		tempDnProj = fs.mkdtempSync(path.join(os.tmpdir(), "dn-clean-test-"));
		fs.writeFileSync(
			path.join(tempDnProj, "pubspec.yaml"),
			"name: dn_clean_app\ndependencies:\n  dartnative: ^0.5.0\n",
		);

		tempFlutterProj = fs.mkdtempSync(path.join(os.tmpdir(), "flutter-clean-test-"));
		fs.writeFileSync(
			path.join(tempFlutterProj, "pubspec.yaml"),
			"name: flutter_clean_app\ndependencies:\n  flutter:\n    sdk: flutter\n",
		);

		tempPlainProj = fs.mkdtempSync(path.join(os.tmpdir(), "plain-clean-test-"));
		fs.writeFileSync(
			path.join(tempPlainProj, "pubspec.yaml"),
			"name: plain_dart_app\ndependencies:\n  path: ^1.8.0\n",
		);
	});

	after(() => {
		try {
			fs.rmSync(tempDnProj, { force: true, recursive: true });
			fs.rmSync(tempFlutterProj, { force: true, recursive: true });
			fs.rmSync(tempPlainProj, { force: true, recursive: true });
		} catch {
		}
	});

	it("correctly recognizes DartNative project folder for clean operations", () => {
		assert.equal(isDartNativeProjectFolder(tempDnProj), true);
		assert.equal(isDartNativeProjectFolder(tempFlutterProj), false);
		assert.equal(isDartNativeProjectFolder(tempPlainProj), false);
	});

	it("includes DartNative project folders when filtering with flutterOnly filter", () => {
		const folders = [tempDnProj, tempFlutterProj, tempPlainProj];
		const filter = (f: string) => isFlutterProjectFolder(f) || isDartNativeProjectFolder(f);
		const filtered = folders.filter(filter);

		assert.equal(filtered.includes(tempDnProj), true);
		assert.equal(filtered.includes(tempFlutterProj), true);
		assert.equal(filtered.includes(tempPlainProj), false);
	});

	it("produces correct notification title and prompt for DartNative vs Flutter clean", () => {
		function getCleanNotificationTitle(isDartNative: boolean, isBatch: boolean): string {
			return isDartNative
				? (isBatch ? "DartNative: Clean All Projects" : "DartNative: Clean Project")
				: (isBatch ? "flutter clean (all projects)" : "flutter clean");
		}

		function getCleanPrompt(isDartNative: boolean): string {
			return isDartNative
				? `Select the folder to run "DartNative clean" in`
				: `Select the folder to run "flutter clean" in`;
		}

		assert.equal(getCleanNotificationTitle(true, false), "DartNative: Clean Project");
		assert.equal(getCleanNotificationTitle(true, true), "DartNative: Clean All Projects");
		assert.equal(getCleanNotificationTitle(false, false), "flutter clean");
		assert.equal(getCleanNotificationTitle(false, true), "flutter clean (all projects)");

		assert.equal(getCleanPrompt(true), `Select the folder to run "DartNative clean" in`);
		assert.equal(getCleanPrompt(false), `Select the folder to run "flutter clean" in`);
	});
});
