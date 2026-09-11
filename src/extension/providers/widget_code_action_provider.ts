import * as vs from "vscode";
import { config } from "../config";
import { getAvailableRefactorActions } from "../refactors/widget_refactor_core";
import { isInsideDartNativeProject, isInsideFlutterProject } from "../utils";

export class WidgetCodeActionProvider implements vs.CodeActionProvider {
	public static readonly providedCodeActionKinds = [
		vs.CodeActionKind.Refactor,
		vs.CodeActionKind.RefactorExtract,
		vs.CodeActionKind.RefactorRewrite,
	];

	public provideCodeActions(
		document: vs.TextDocument,
		range: vs.Range | vs.Selection,
		_context: vs.CodeActionContext,
		_token: vs.CancellationToken,
	): vs.CodeAction[] | undefined {
		if (!config.enableWidgetRefactors) {
			return undefined;
		}

		// Only run for Dart documents in Flutter or DartNative projects
		if (!isInsideDartNativeProject(document.uri) && !isInsideFlutterProject(document.uri)) {
			return undefined;
		}

		const code = document.getText();
		const selectionStart = document.offsetAt(range.start);
		const selectionEnd = document.offsetAt(range.end);

		const actions = getAvailableRefactorActions(code, selectionStart, selectionEnd, {
			moveNonFinalFieldsToState: config.moveNonFinalFieldsToState,
		});
		if (!actions || actions.length === 0) {
			return undefined;
		}

		return actions.map((action) => {
			if (action.id === "dart.refactor.extractWidget" || action.kind === "refactor.extract") {
				const ca = new vs.CodeAction(action.title, vs.CodeActionKind.RefactorExtract);
				ca.command = {
					arguments: [document, action.replaceRange],
					command: "dart.refactor.extractWidget",
					title: action.title,
				};
				return ca;
			}

			const kind = action.kind === "refactor.rewrite"
				? vs.CodeActionKind.RefactorRewrite
				: vs.CodeActionKind.Refactor;
			const ca = new vs.CodeAction(action.title, kind);
			const edit = new vs.WorkspaceEdit();
			const startPos = document.positionAt(action.replaceRange.start);
			const endPos = document.positionAt(action.replaceRange.end);
			const editRange = new vs.Range(startPos, endPos);

			if (action.snippetText) {
				const snippetEdit = new vs.SnippetTextEdit(editRange, new vs.SnippetString(action.snippetText));
				snippetEdit.keepWhitespace = true;
				edit.set(document.uri, [snippetEdit]);
			} else {
				edit.replace(document.uri, editRange, action.newText);
			}

			if (action.appendText) {
				const endOfDoc = document.positionAt(code.length);
				edit.insert(document.uri, endOfDoc, action.appendText);
			}

			ca.edit = edit;
			if (config.formatAfterRefactoring) {
				ca.command = {
					command: "_dart.formatDocument",
					title: "Format Document",
				};
			}
			return ca;
		});
	}
}
