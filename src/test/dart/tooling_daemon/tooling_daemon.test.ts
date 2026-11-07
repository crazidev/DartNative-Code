import { strict as assert } from "assert";
import * as fs from "fs";
import * as path from "path";
import * as vs from "vscode";
import { isWin } from "../../../shared/constants";
import { ActiveLocation, ActiveLocationChangedEvent, EventKind, ServiceMethod, Stream } from "../../../shared/services/tooling_daemon_services";
import { fsPath } from "../../../shared/utils/fs";
import { waitFor } from "../../../shared/utils/promises";
import { activate, delay, flutterHelloWorldMainFile, helloWorldMainFile, openFile, privateApi, setConfigForTest, waitForResult } from "../../helpers";

// These are basic tests for DTD. There are also some tests in `../dart_debug`.
describe("dart tooling daemon", () => {
	beforeEach("activate", () => activate());

	beforeEach("skip if not supported", async function () {
		if (!privateApi.dartCapabilities.supportsToolingDaemon)
			this.skip();
	});

	it("should respond with the correct set of IDE workspace roots", async () => {
		const daemon = privateApi.toolingDaemon;
		assert.ok(daemon);

		// Wait for daemon to be up and allow time for the extension to send roots.
		await daemon.connected;
		await delay(50);

		const result = await daemon.callMethod(ServiceMethod.getIDEWorkspaceRoots);
		assert.ok(result.ideWorkspaceRoots.length);
		const roots = vs.workspace.workspaceFolders?.map((wf) => wf.uri.toString()) ?? [];
		assert.deepStrictEqual(result.ideWorkspaceRoots, roots);
	});

	it("should be able to read files inside the workspace root", async function () {
		// https://github.com/Dart-Code/Dart-Code/issues/5210
		if (privateApi.dartCapabilities.version.startsWith("3.5."))
			this.skip();

		const daemon = privateApi.toolingDaemon;
		assert.ok(daemon);

		// Wait for daemon to be up and allow time for the extension to send roots.
		await daemon.connected;
		await delay(50);

		const result = await daemon.callMethod(ServiceMethod.readFileAsString, { uri: helloWorldMainFile.toString() });
		assert.ok(result.content);

		// If we're on Windows, try with different casings because it's easy to have different drive
		// letter casing from different APIs and we don't know the source of all other callers of this
		// API.
		if (isWin) {
			for (const replacer of [
				// Uppercase drive letter
				(_fullMatch, prefix, driveLetter) => `${prefix}${driveLetter.toUpperCase()}:`,
				// Lowercase drive letter
				(_fullMatch, prefix, driveLetter) => `${prefix}${driveLetter.toLowerCase()}:`,
				// Encoded colon
				(_fullMatch, prefix, driveLetter) => `${prefix}${driveLetter}%3a`,
				// Not-encoded colon
				(_fullMatch, prefix, driveLetter) => `${prefix}${driveLetter}:`,
			] as Array<(_fullMatch: string, prefix: string, driveLetter: string, colon: string) => string>) {
				const uri = helloWorldMainFile.toString().replace(/(file:\/\/\/)(\w)(:|%3a|%3A)/, replacer);
				const result = await daemon.callMethod(ServiceMethod.readFileAsString, { uri });
				assert.ok(result.content);
			}
		}
	});

	it("should not be able to read files outside the workspace root", async () => {
		const daemon = privateApi.toolingDaemon;
		assert.ok(daemon);

		// Wait for daemon to be up and allow time for the extension to send roots.
		await daemon.connected;
		await delay(50);

		try {
			const result = await daemon.callMethod(ServiceMethod.readFileAsString, { uri: flutterHelloWorldMainFile.toString() });
			assert.fail(`DTD returned content outside of workspace: (${flutterHelloWorldMainFile} / ${result.content.length} bytes)`);
		} catch (e: any) {
			assert.equal(e.code, 142);
			assert.equal(e.message, "Permission denied");
		}
	});

	it("should be able to navigate to code", async () => {
		const daemon = privateApi.toolingDaemon;
		assert.ok(daemon);
		await daemon.connected;

		const targetLine = 5;
		const targetColumn = 1;
		await daemon.callMethod(ServiceMethod.editorNavigateToCode, {
			column: targetColumn,
			line: targetLine,
			uri: helloWorldMainFile.toString(),
		});

		const editor = vs.window.activeTextEditor;
		assert.ok(editor);
		assert.equal(fsPath(editor.document.uri), fsPath(helloWorldMainFile));
		assert.equal(editor.selection.active.line, targetLine - 1);
		assert.equal(editor.selection.active.character, targetColumn - 1);
	});

	it("should return an error for unsupported URI schemes", async () => {
		const daemon = privateApi.toolingDaemon;
		assert.ok(daemon);
		await daemon.connected;

		await assert.rejects(
			daemon.callMethod(ServiceMethod.editorNavigateToCode, { uri: "https://dart.dev" }),
			(error: any) => error?.code === 144,
		);
	});

	it("should attach to an MCP-provided VM Service URI", async () => {
		const daemon = privateApi.toolingDaemon;
		assert.ok(daemon);
		await daemon.connected;
		await waitFor(() => daemon.registeredServiceMethods.has(ServiceMethod.editorAttachToVmService));
		const dtdDescriptorPath = path.join(fsPath(vs.workspace.workspaceFolders![0].uri), ".dart_tool", "dartnative_dtd.json");
		await waitFor(() => fs.existsSync(dtdDescriptorPath));
		const dtdDescriptor = JSON.parse(fs.readFileSync(dtdDescriptorPath, "utf8")) as { capability: string; dtdUri: string };
		assert.equal(dtdDescriptor.dtdUri, await daemon.dtdUri);

		const originalStartDebugging = vs.debug.startDebugging;
		let attachedConfig: vs.DebugConfiguration | undefined;
		try {
			(vs.debug as any).startDebugging = async (_folder: vs.WorkspaceFolder | undefined, config: vs.DebugConfiguration) => {
				attachedConfig = config;
				return true;
			};

			const result = await daemon.callMethod(ServiceMethod.editorAttachToVmService, {
				capability: dtdDescriptor.capability,
				name: "DartNative MCP app",
				projectRoot: path.dirname(fsPath(helloWorldMainFile)),
				vmServiceUri: "ws://127.0.0.1:8181/secret/",
			});

			assert.equal(result.type, "Success");
			assert.equal(attachedConfig?.request, "attach");
			assert.equal(attachedConfig?.type, "dart");
			assert.equal(attachedConfig?.vmServiceUri, "ws://127.0.0.1:8181/secret/");
			assert.equal(attachedConfig?.name, "DartNative MCP app");
		} finally {
			(vs.debug as any).startDebugging = originalStartDebugging;
		}
	});

	it("should reject invalid VM Service URIs when attaching through DTD", async () => {
		const daemon = privateApi.toolingDaemon;
		assert.ok(daemon);
		await daemon.connected;
		await waitFor(() => daemon.registeredServiceMethods.has(ServiceMethod.editorAttachToVmService));
		const dtdDescriptorPath = path.join(fsPath(vs.workspace.workspaceFolders![0].uri), ".dart_tool", "dartnative_dtd.json");
		await waitFor(() => fs.existsSync(dtdDescriptorPath));
		const dtdDescriptor = JSON.parse(fs.readFileSync(dtdDescriptorPath, "utf8")) as { capability: string };

		await assert.rejects(
			daemon.callMethod(ServiceMethod.editorAttachToVmService, { capability: dtdDescriptor.capability, vmServiceUri: "file:///etc/passwd" }),
			(error: any) => error?.code === 144,
		);
	});

	it("should require the workspace DTD attach capability", async () => {
		const daemon = privateApi.toolingDaemon;
		assert.ok(daemon);
		await daemon.connected;
		await waitFor(() => daemon.registeredServiceMethods.has(ServiceMethod.editorAttachToVmService));

		await assert.rejects(
			daemon.callMethod(ServiceMethod.editorAttachToVmService, { capability: "", vmServiceUri: "ws://127.0.0.1:8181/secret/" }),
			(error: any) => error?.code === 142,
		);
	});

	it("should expose LSP methods via the analyzer", async function () {
		if (!privateApi.dartCapabilities.supportsLspOverDtd)
			this.skip();

		const daemon = privateApi.toolingDaemon;
		assert.ok(daemon);

		// Wait for daemon to be up.
		await daemon.connected;
		await delay(50);

		// Ensure expected LSP services are registered.
		const knownServices = daemon.registeredServiceMethods;
		assert.ok(knownServices.has("Lsp.experimental/echo"), `Did not find "Lsp.experimental/echo" in ${[...knownServices].join(", ")}`);
	});

	it("should send ActiveLocationChanged events when the selection changes", async () => {
		const dtdDebounceMs = 1;
		await setConfigForTest("dart", "dtdEditorActiveLocationDelay", dtdDebounceMs); // Reduce debounce time for test.

		const daemon = privateApi.toolingDaemon;
		assert.ok(daemon);
		await daemon.connected;
		await daemon.streamListen(Stream.Editor);

		const events: ActiveLocationChangedEvent[] = [];
		const listener = daemon.onNotification(Stream.Editor, EventKind[EventKind.activeLocationChanged], (event: ActiveLocationChangedEvent) => events.push(event));
		try {
			const editor = await openFile(helloWorldMainFile);
			editor.selection = new vs.Selection(new vs.Position(0, 0), new vs.Position(0, 0));
			// Discard any first events for the above.
			await waitForResult(() => events.length >= 1);
			await delay(50); // Allow for unrelated events.
			events.length = 0;

			editor.selection = new vs.Selection(new vs.Position(1, 0), new vs.Position(2, 0));
			await delay(dtdDebounceMs + 10);
			editor.selections = [
				new vs.Selection(new vs.Position(3, 0), new vs.Position(4, 0)),
				new vs.Selection(new vs.Position(5, 0), new vs.Position(6, 0)),
			];

			// Wait for both expected events. Use waitFor and don't throw on failure because the error message
			// from the assert below will be better (we use `waitFor` just to force a delay, but continue when
			// the condition is met).
			await waitFor(() => events.length >= 2);
			assert.deepStrictEqual(
				events.map(simplify),
				[
					{
						filePath: fsPath(helloWorldMainFile),
						selections: [
							{
								active: { line: 2, character: 0 },
								anchor: { line: 1, character: 0 }
							}
						]
					},
					{
						filePath: fsPath(helloWorldMainFile),
						selections: [
							{
								active: { line: 4, character: 0 },
								anchor: { line: 3, character: 0 }
							},
							{
								active: { line: 6, character: 0 },
								anchor: { line: 5, character: 0 }
							}
						]
					},
				],
			);
		} finally {
			listener.dispose();
			await daemon.streamCancel(Stream.Editor);
		}
	});

	it("should return the current active location", async () => {
		const dtdDebounceMs = 1;
		await setConfigForTest("dart", "dtdEditorActiveLocationDelay", dtdDebounceMs); // Reduce debounce time for test.

		const daemon = privateApi.toolingDaemon;
		assert.ok(daemon);
		await daemon.connected;

		const editor = await openFile(helloWorldMainFile);
		await delay(dtdDebounceMs + 50);

		// Ensure there's an initial location for this file after opening.
		let location = await daemon.callMethod(ServiceMethod.editorGetActiveLocation);
		assert.equal(fsPath(vs.Uri.parse(location.textDocument!.uri)), fsPath(helloWorldMainFile));


		// Test a single-position update. Set twice to ensure there's always a change regardless of the
		// original position restored when the file was opened.
		editor.selection = new vs.Selection(new vs.Position(0, 0), new vs.Position(0, 0));
		editor.selection = new vs.Selection(new vs.Position(1, 0), new vs.Position(2, 0));
		await delay(dtdDebounceMs + 50);

		location = await daemon.callMethod(ServiceMethod.editorGetActiveLocation);
		assert.deepStrictEqual(
			simplify(location),
			{
				filePath: fsPath(helloWorldMainFile),
				selections: [
					{
						active: { line: 2, character: 0 },
						anchor: { line: 1, character: 0 }
					}
				]
			},
		);


		// Test a multi-selection.
		editor.selections = [
			new vs.Selection(new vs.Position(3, 0), new vs.Position(4, 0)),
			new vs.Selection(new vs.Position(5, 0), new vs.Position(6, 0)),
		];
		await delay(dtdDebounceMs + 50);
		location = await daemon.callMethod(ServiceMethod.editorGetActiveLocation);
		assert.deepStrictEqual(
			simplify(location),
			{
				filePath: fsPath(helloWorldMainFile),
				selections: [
					{
						active: { line: 4, character: 0 },
						anchor: { line: 3, character: 0 }
					},
					{
						active: { line: 6, character: 0 },
						anchor: { line: 5, character: 0 }
					}
				]
			},
		);
	});
});

function simplify(e: ActiveLocation) {
	return {
		filePath: fsPath(vs.Uri.parse(e.textDocument!.uri)),
		selections: e.selections
	};
}
