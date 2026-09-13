import * as path from "path";
import { CancellationToken, CompletionContext, CompletionItem, CompletionItemKind, CompletionItemProvider, CompletionList, Position, SnippetString, TextDocument, Uri } from "vscode";
import { DartCapabilities } from "../../shared/capabilities/dart";
import { createMarkdownString, extensionPath, readJson } from "../../shared/vscode/extension_utils";
import { config } from "../config";
import { isInsideFlutterProject } from "../utils";

interface RawSnippet {
	prefix?: string;
	description?: string;
	body?: string | string[];
}

export class SnippetCompletionItemProvider implements CompletionItemProvider {
	private completions = new CompletionList();
	private shouldRender: (uri: Uri) => boolean;

	constructor(private readonly dartCapabilities: DartCapabilities, filename: string, shouldRender: (uri: Uri) => boolean) {
		this.shouldRender = shouldRender;
		const snippets = readJson(path.join(extensionPath, filename)) as Record<string, RawSnippet | Record<string, RawSnippet>>;
		const processSnippet = (snippetName: string, snippet: RawSnippet | undefined) => {
			if (!snippet?.prefix || !snippet?.body) return;
			const completionItem = new CompletionItem(snippet.prefix, CompletionItemKind.Snippet);
			completionItem.filterText = snippet.prefix;
			completionItem.insertText = new SnippetString(
				Array.isArray(snippet.body)
					? snippet.body.join("\n")
					: snippet.body,
			);
			completionItem.detail = snippet.description ?? snippetName;
			completionItem.documentation = createMarkdownString("").appendCodeblock(completionItem.insertText.value);
			completionItem.sortText = "0000000000000000000000";
			if (config.formatAfterSnippet && (snippet.prefix === "stless" || snippet.prefix === "stful" || snippet.prefix === "stanim" || snippetName.toLowerCase().includes("widget"))) {
				completionItem.command = {
					command: "_dart.formatDocument",
					title: "Format Document",
				};
			}
			this.completions.items.push(completionItem);
		};

		for (const key of Object.keys(snippets)) {
			const item = snippets[key];
			if (item?.prefix && item?.body) {
				processSnippet(key, item);
			} else if (item && typeof item === "object") {
				const nested = item as Record<string, RawSnippet>;
				for (const subKey of Object.keys(nested)) {
					processSnippet(subKey, nested[subKey]);
				}
			}
		}
	}

	public provideCompletionItems(
		document: TextDocument, position: Position, _token: CancellationToken, _context: CompletionContext,
	): CompletionList | undefined {
		if (!config.enableSnippets)
			return;

		if (config.enableServerSnippets && isInsideFlutterProject(document.uri))
			return;

		const line = document.lineAt(position.line).text.slice(0, position.character);

		if (!this.shouldAllowCompletion(line))
			return;

		if (!this.shouldRender(document.uri))
			return;

		return this.completions;
	}

	private shouldAllowCompletion(line: string): boolean {
		line = line.trim();

		// Don't provide completions after comment markers. This isn't perfect since it'll
		// suppress them for ex if // appears inside strings, but it's a reasonable
		// approximation given we don't have a reliable way to tell that.
		if (line.includes("//"))
			return false;

		// Otherwise, allow through.
		return true;
	}
}
