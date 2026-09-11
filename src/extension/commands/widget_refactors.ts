import * as vs from "vscode";
import { config } from "../config";
import { DartCodeScanner, generateExtractWidget, generateSingleWidgetWrapSnippet, TextRange } from "../refactors/widget_refactor_core";

export class WidgetRefactorCommands implements vs.Disposable {
	private readonly disposables: vs.Disposable[] = [];

	constructor() {
		this.disposables.push(
			vs.commands.registerCommand("dart.refactor.extractWidget", (document?: vs.TextDocument, targetRange?: TextRange) => this.extractWidget(document, targetRange)),
			vs.commands.registerCommand("dart.refactor.wrapWithWidget", (document?: vs.TextDocument, targetRange?: TextRange) => this.wrapWithWidget(document, targetRange)),
		);
	}

	public async wrapWithWidget(document?: vs.TextDocument, targetRange?: TextRange): Promise<void> {
		if (!config.enableWidgetRefactors) return;

		const editor = vs.window.activeTextEditor;
		if (!editor) return;

		const doc = document ?? editor.document;
		let range = targetRange;

		if (!range) {
			const selection = editor.selection;
			const offset = doc.offsetAt(selection.start);
			const scanner = new DartCodeScanner(doc.getText());
			const widget = scanner.findEnclosingWidget(offset);
			if (!widget) return;
			range = { end: widget.end, start: widget.start };
		}

		const code = doc.getText();
		const snippet = generateSingleWidgetWrapSnippet(code, range, "widget");
		const startPos = doc.positionAt(range.start);
		const endPos = doc.positionAt(range.end);
		const editRange = new vs.Range(startPos, endPos);

		await editor.insertSnippet(new vs.SnippetString(snippet), editRange, { keepWhitespace: true, undoStopAfter: true, undoStopBefore: true });
		if (config.formatAfterRefactoring) {
			void vs.commands.executeCommand("_dart.formatDocument");
		}
	}

	public async extractWidget(document?: vs.TextDocument, targetRange?: TextRange): Promise<void> {
		if (!config.enableWidgetRefactors) return;

		const editor = vs.window.activeTextEditor;
		if (!editor) return;

		const doc = document ?? editor.document;
		let range = targetRange;

		if (!range) {
			const selection = editor.selection;
			const offset = doc.offsetAt(selection.start);
			const scanner = new DartCodeScanner(doc.getText());
			const widget = scanner.findEnclosingWidget(offset);
			if (!widget) return;
			range = { end: widget.end, start: widget.start };
		}

		const widgetName = await vs.window.showInputBox({
			prompt: "Enter a name for the new widget",
			validateInput: (value) => {
				if (!value?.trim()) {
					return "Widget name cannot be empty";
				}
				if (!/^[A-Z][a-zA-Z0-9_]*$/.test(value.trim())) {
					return "Widget name must be a valid PascalCase identifier (e.g. MyWidget)";
				}
				return undefined;
			},
			value: "NewWidget",
			valueSelection: [0, 9],
		});

		if (!widgetName?.trim()) {
			return;
		}

		const code = doc.getText();
		const name = widgetName.trim();
		const extracted = generateExtractWidget(code, range, name);

		const edit = new vs.WorkspaceEdit();
		const startPos = doc.positionAt(range.start);
		const endPos = doc.positionAt(range.end);
		const editRange = new vs.Range(startPos, endPos);

		edit.replace(doc.uri, editRange, extracted.usageText);
		const endOfDoc = doc.positionAt(code.length);
		edit.insert(doc.uri, endOfDoc, extracted.appendText);

		await vs.workspace.applyEdit(edit);
		if (config.formatAfterRefactoring) {
			void vs.commands.executeCommand("_dart.formatDocument");
		}
	}

	public dispose(): void {
		for (const d of this.disposables) {
			d.dispose();
		}
	}
}
