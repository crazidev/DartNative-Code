/**
 * Pure Dart AST/token scanner and widget refactoring engine.
 * Decoupled from VS Code APIs to allow sub-millisecond unit testing.
 */

export interface TextRange {
	start: number;
	end: number;
}

export interface RefactorAction {
	id: string;
	title: string;
	kind: string;
	replaceRange: TextRange;
	newText: string;
	snippetText?: string;
	appendText?: string;
	isMultiWidget?: boolean;
}

/**
 * Tokenizes and scans Dart code, handling strings, raw strings, and comments.
 */
export class DartCodeScanner {
	constructor(public readonly code: string) {}

	/**
	 * Skips comments and strings starting from index, returning next non-comment/string index.
	 */
	public skipTrivia(fromIndex: number): number {
		let i = fromIndex;
		const len = this.code.length;

		while (i < len) {
			const char = this.code[i];
			const next = i + 1 < len ? this.code[i + 1] : "";

			// Whitespace
			if (char === " " || char === "\t" || char === "\n" || char === "\r") {
				i++;
				continue;
			}

			// Single line comment
			if (char === "/" && next === "/") {
				i += 2;
				while (i < len && this.code[i] !== "\n") {
					i++;
				}
				continue;
			}

			// Block comment
			if (char === "/" && next === "*") {
				i += 2;
				while (i < len && !(this.code[i] === "*" && i + 1 < len && this.code[i + 1] === "/")) {
					i++;
				}
				i = Math.min(len, i + 2);
				continue;
			}

			break;
		}

		return i;
	}

	/**
	 * Scans forward from an opening bracket '(', '[', or '{' and returns matching close index.
	 */
	public findMatchingBracket(openIndex: number): number {
		const openChar = this.code[openIndex];
		const closeChar = openChar === "(" ? ")" : openChar === "[" ? "]" : openChar === "{" ? "}" : "";
		if (!closeChar) return -1;

		let depth = 1;
		let i = openIndex + 1;
		const len = this.code.length;

		while (i < len && depth > 0) {
			const char = this.code[i];
			const next = i + 1 < len ? this.code[i + 1] : "";

			// Skip single-line comments
			if (char === "/" && next === "/") {
				i += 2;
				while (i < len && this.code[i] !== "\n") {
					i++;
				}
				continue;
			}

			// Skip block comments
			if (char === "/" && next === "*") {
				i += 2;
				while (i < len && !(this.code[i] === "*" && i + 1 < len && this.code[i + 1] === "/")) {
					i++;
				}
				i = Math.min(len, i + 2);
				continue;
			}

			// Skip raw strings: r'...' or r"..."
			if (char === "r" && (next === "'" || next === "\"")) {
				const quote = next;
				const isTriple = i + 3 < len && this.code.substring(i + 1, i + 4) === quote.repeat(3);
				if (isTriple) {
					const target = quote.repeat(3);
					i += 4;
					while (i <= len - 3 && this.code.substring(i, i + 3) !== target) {
						i++;
					}
					i = Math.min(len, i + 3);
				} else {
					i += 2;
					while (i < len && this.code[i] !== quote) {
						i++;
					}
					i = Math.min(len, i + 1);
				}
				continue;
			}

			// Skip normal strings: '...', "...", '''...''', """..."""
			if (char === "'" || char === "\"") {
				const quote = char;
				const isTriple = i + 2 < len && this.code.substring(i, i + 3) === quote.repeat(3);
				if (isTriple) {
					const target = quote.repeat(3);
					i += 3;
					while (i <= len - 3) {
						if (this.code[i] === "\\") {
							i += 2;
						} else if (this.code.substring(i, i + 3) === target) {
							i += 3;
							break;
						} else {
							i++;
						}
					}
				} else {
					i += 1;
					while (i < len) {
						if (this.code[i] === "\\") {
							i += 2;
						} else if (this.code[i] === quote) {
							i++;
							break;
						} else if (this.code[i] === "\n") {
							// unterminated single-line string
							break;
						} else {
							i++;
						}
					}
				}
				continue;
			}

			// Track depth
			if (char === openChar) {
				depth++;
			} else if (char === closeChar) {
				depth--;
				if (depth === 0) return i;
			}

			i++;
		}

		return -1;
	}

	/**
	 * Finds all widget constructor calls in the code.
	 * Returns array of { start, end, name, argsStart, argsEnd }
	 */
	public findAllWidgetExpressions(): Array<{ start: number; end: number; name: string; argsStart: number; argsEnd: number }> {
		const widgets: Array<{ start: number; end: number; name: string; argsStart: number; argsEnd: number }> = [];
		// Pattern for Identifier or Identifier.namedConstructor preceded optionally by const / new
		const pattern = /\b(?:const\s+|new\s+)?([A-Z][A-Za-z0-9_]*(?:\.[A-Z][A-Za-z0-9_]*|\.[a-z][A-Za-z0-9_]*)?)\s*\(/g;
		let match: RegExpExecArray | null;

		while ((match = pattern.exec(this.code)) !== null) {
			const start = match.index;
			const name = match[1];
			const openParenIndex = this.code.indexOf("(", start + match[0].length - 1);
			if (openParenIndex === -1) continue;

			const closeParenIndex = this.findMatchingBracket(openParenIndex);
			if (closeParenIndex !== -1) {
				widgets.push({
					argsEnd: closeParenIndex,
					argsStart: openParenIndex + 1,
					end: closeParenIndex + 1,
					name,
					start,
				});
			}
		}

		return widgets;
	}

	/**
	 * Finds the smallest enclosing widget call surrounding the given offset.
	 */
	public findEnclosingWidget(offset: number): { start: number; end: number; name: string; argsStart: number; argsEnd: number } | undefined {
		const allWidgets = this.findAllWidgetExpressions();
		let innermost: { start: number; end: number; name: string; argsStart: number; argsEnd: number } | undefined;

		for (const w of allWidgets) {
			if (offset >= w.start && offset <= w.end) {
				if (!innermost || (w.end - w.start < innermost.end - innermost.start)) {
					innermost = w;
				}
			}
		}

		return innermost;
	}

	/**
	 * Finds items inside a `children: [...]` list that are selected.
	 */
	public findSelectedWidgetsInList(selectionStart: number, selectionEnd: number): Array<{ start: number; end: number; text: string }> {
		if (selectionStart >= selectionEnd) return [];

		// Find list literals `children: [...]` or `[...]`
		const listPattern = /\bchildren\s*:\s*\[/g;
		let match: RegExpExecArray | null;

		while ((match = listPattern.exec(this.code)) !== null) {
			const openBracket = this.code.indexOf("[", match.index);
			if (openBracket === -1) continue;
			const closeBracket = this.findMatchingBracket(openBracket);
			if (closeBracket === -1) continue;

			// Check if selection intersects this children list
			if (selectionStart >= openBracket && selectionEnd <= closeBracket) {
				// Parse items inside this list
				const items = this.parseListItems(openBracket + 1, closeBracket);
				const selected = items.filter((item) => !(item.end < selectionStart || item.start > selectionEnd));

				if (selected.length > 1) {
					return selected;
				}
			}
		}

		return [];
	}

	/**
	 * Parses comma-separated top-level expressions inside a list `[ item1, item2, ... ]`.
	 */
	public parseListItems(fromIndex: number, toIndex: number): Array<{ start: number; end: number; text: string }> {
		const items: Array<{ start: number; end: number; text: string }> = [];
		let currentStart = -1;
		let i = fromIndex;

		let parenDepth = 0;
		let bracketDepth = 0;
		let braceDepth = 0;

		while (i < toIndex) {
			const char = this.code[i];
			const next = i + 1 < toIndex ? this.code[i + 1] : "";

			// Skip comments
			if (char === "/" && next === "/") {
				i += 2;
				while (i < toIndex && this.code[i] !== "\n") i++;
				continue;
			}
			if (char === "/" && next === "*") {
				i += 2;
				while (i < toIndex && !(this.code[i] === "*" && i + 1 < toIndex && this.code[i + 1] === "/")) i++;
				i = Math.min(toIndex, i + 2);
				continue;
			}

			// Skip strings
			if (char === "'" || char === "\"") {
				const quote = char;
				i++;
				while (i < toIndex) {
					if (this.code[i] === "\\") {
						i += 2;
					} else if (this.code[i] === quote) {
						i++;
						break;
					} else {
						i++;
					}
				}
				continue;
			}

			if (char === "(") parenDepth++;
			else if (char === ")") parenDepth = Math.max(0, parenDepth - 1);
			else if (char === "[") bracketDepth++;
			else if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
			else if (char === "{") braceDepth++;
			else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);

			// Track item boundaries
			if (parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
				if (char === ",") {
					if (currentStart !== -1) {
						const rawItem = this.code.substring(currentStart, i).trim();
						if (rawItem.length > 0) {
							// Exact trimmed start and end
							const actualStart = this.code.indexOf(rawItem, currentStart);
							items.push({
								end: actualStart + rawItem.length,
								start: actualStart,
								text: rawItem,
							});
						}
						currentStart = -1;
					}
				} else if (char !== " " && char !== "\t" && char !== "\n" && char !== "\r") {
					if (currentStart === -1) {
						currentStart = i;
					}
				}
			}

			i++;
		}

		if (currentStart !== -1) {
			const rawItem = this.code.substring(currentStart, toIndex).trim();
			if (rawItem.length > 0) {
				const actualStart = this.code.indexOf(rawItem, currentStart);
				items.push({
					end: actualStart + rawItem.length,
					start: actualStart,
					text: rawItem,
				});
			}
		}

		return items;
	}

	/**
	 * Finds the `child:` argument expression inside a widget's arguments.
	 */
	public findChildExpression(argsStart: number, argsEnd: number): { start: number; end: number; text: string } | undefined {
		const argsCode = this.code.substring(argsStart, argsEnd);
		const childMatch = /\bchild\s*:\s*/g;
		let match: RegExpExecArray | null;

		while ((match = childMatch.exec(argsCode)) !== null) {
			const childValStart = argsStart + match.index + match[0].length;
			// Find end of this expression (up to next unnested comma or end of args)
			let i = childValStart;
			let parenDepth = 0;
			let bracketDepth = 0;
			let braceDepth = 0;

			while (i < argsEnd) {
				const char = this.code[i];
				const next = i + 1 < argsEnd ? this.code[i + 1] : "";

				if (char === "/" && next === "/") {
					i += 2;
					while (i < argsEnd && this.code[i] !== "\n") i++;
					continue;
				}
				if (char === "'" || char === "\"") {
					const quote = char;
					i++;
					while (i < argsEnd) {
						if (this.code[i] === "\\") {
							i += 2;
						} else if (this.code[i] === quote) {
							i++;
							break;
						} else {
							i++;
						}
					}
					continue;
				}

				if (char === "(") parenDepth++;
				else if (char === ")") {
					if (parenDepth === 0) break;
					parenDepth--;
				} else if (char === "[") bracketDepth++;
				else if (char === "]") bracketDepth--;
				else if (char === "{") braceDepth++;
				else if (char === "}") braceDepth--;

				if (parenDepth === 0 && bracketDepth === 0 && braceDepth === 0 && char === ",") {
					break;
				}
				i++;
			}

			const raw = this.code.substring(childValStart, i).trim();
			if (raw.length > 0) {
				const actualStart = this.code.indexOf(raw, childValStart);
				return {
					end: actualStart + raw.length,
					start: actualStart,
					text: raw,
				};
			}
		}

		return undefined;
	}
}

/**
 * Helper to compute indentation of a given offset in the source code.
 */
export function getLineIndentation(code: string, offset: number): string {
	let lineStart = offset;
	while (lineStart > 0 && code[lineStart - 1] !== "\n") {
		lineStart--;
	}
	let i = lineStart;
	while (i < code.length && (code[i] === " " || code[i] === "\t")) {
		i++;
	}
	return code.substring(lineStart, i);
}

export function escapeSnippet(text: string): string {
	return text.replace(/[$}\\]/g, "\\$&");
}

/**
 * Generates single-widget wrap code.
 */
export function generateSingleWidgetWrap(
	code: string,
	target: { start: number; end: number },
	wrapperKind: "Padding" | "Container" | "Center" | "SizedBox" | "Expanded" | "Column" | "Row" | "widget",
): string {
	const widgetText = code.substring(target.start, target.end);
	const indent = getLineIndentation(code, target.start);
	const childIndent = indent + "  ";

	const indentedChild = widgetText.split("\n").map((line, idx) => {
		if (idx === 0) return line;
		return "  " + line;
	}).join("\n");

	switch (wrapperKind) {
		case "Padding":
			return `Padding(\n${childIndent}padding: const EdgeInsets.all(8.0),\n${childIndent}child: ${indentedChild},\n${indent})`;
		case "Container":
			return `Container(\n${childIndent}child: ${indentedChild},\n${indent})`;
		case "Center":
			return `Center(\n${childIndent}child: ${indentedChild},\n${indent})`;
		case "SizedBox":
			return `SizedBox(\n${childIndent}child: ${indentedChild},\n${indent})`;
		case "Expanded":
			return `Expanded(\n${childIndent}child: ${indentedChild},\n${indent})`;
		case "Column":
			return `Column(\n${childIndent}children: [\n${childIndent}  ${indentedChild},\n${childIndent}],\n${indent})`;
		case "Row":
			return `Row(\n${childIndent}children: [\n${childIndent}  ${indentedChild},\n${childIndent}],\n${indent})`;
		case "widget":
			return `widget(\n${childIndent}child: ${indentedChild},\n${indent})`;
	}
}

/**
 * Generates single-widget wrap snippet code with tabstops/placeholders.
 */
export function generateSingleWidgetWrapSnippet(
	code: string,
	target: { start: number; end: number },
	wrapperKind: "Padding" | "Container" | "Center" | "SizedBox" | "Expanded" | "Column" | "Row" | "widget",
): string {
	const widgetText = code.substring(target.start, target.end);
	const indent = getLineIndentation(code, target.start);
	const childIndent = indent + "  ";

	const indentedChild = widgetText.split("\n").map((line, idx) => {
		if (idx === 0) return line;
		return "  " + line;
	}).join("\n");

	const escapedChild = escapeSnippet(indentedChild);

	switch (wrapperKind) {
		case "widget":
			return `\${1:widget}(\n${childIndent}child: ${escapedChild},\n${indent})`;
		default:
			return generateSingleWidgetWrap(code, target, wrapperKind);
	}
}

/**
 * Generates multi-widget wrap code (Column or Row) for selected sibling widgets.
 */
export function generateMultiWidgetWrap(
	code: string,
	items: Array<{ start: number; end: number; text: string }>,
	wrapperKind: "Column" | "Row",
): { replaceRange: TextRange; newText: string } {
	const firstItem = items[0];
	const lastItem = items[items.length - 1];
	const replaceRange: TextRange = { start: firstItem.start, end: lastItem.end };

	const baseIndent = getLineIndentation(code, firstItem.start);
	const childrenIndent = baseIndent + "  ";
	const extraIndent = "    ";

	const formattedItems = items.map((item) => {
		const itemLines = item.text.split("\n");
		const originalItemIndent = getLineIndentation(code, item.start);
		const formattedLines = itemLines.map((line, idx) => {
			if (idx === 0) {
				return baseIndent + extraIndent + line.trimStart();
			}
			if (line.trim().length === 0) {
				return "";
			}
			if (line.startsWith(originalItemIndent)) {
				return baseIndent + extraIndent + line.substring(originalItemIndent.length);
			}
			return baseIndent + extraIndent + line;
		});
		return formattedLines.join("\n") + ",";
	}).join("\n");

	const newText = `${wrapperKind}(\n${childrenIndent}children: [\n${formattedItems}\n${childrenIndent}],\n${baseIndent})`;
	return { newText, replaceRange };
}

/**
 * Generates code to remove a widget.
 * If the widget has a child, it un-nests the child into the widget's place.
 * If the widget is in a list with no child, removes it.
 */
export function generateRemoveWidget(
	code: string,
	target: { start: number; end: number; argsStart: number; argsEnd: number },
): { replaceRange: TextRange; newText: string } {
	const scanner = new DartCodeScanner(code);
	const childExpr = scanner.findChildExpression(target.argsStart, target.argsEnd);

	if (childExpr) {
		// Replace widget with its child expression
		const childText = code.substring(childExpr.start, childExpr.end);
		return {
			newText: childText,
			replaceRange: { start: target.start, end: target.end },
		};
	}

	// Leaf widget without child: check if it has a trailing comma in a list
	let end = target.end;
	while (end < code.length && (code[end] === " " || code[end] === "\t")) {
		end++;
	}
	if (end < code.length && code[end] === ",") {
		end++;
	}

	let start = target.start;
	// Clean up leading whitespace/newline if entire line
	while (start > 0 && (code[start - 1] === " " || code[start - 1] === "\t")) {
		start--;
	}
	if (start > 0 && code[start - 1] === "\n") {
		start--;
	}

	return {
		newText: "",
		replaceRange: { start, end },
	};
}

/**
 * Generates code to remove multiple widgets from a list.
 */
export function generateRemoveMultiWidgets(
	code: string,
	items: Array<{ start: number; end: number; text: string }>,
): { replaceRange: TextRange; newText: string } {
	const firstItem = items[0];
	const lastItem = items[items.length - 1];

	let start = firstItem.start;
	while (start > 0 && (code[start - 1] === " " || code[start - 1] === "\t")) {
		start--;
	}
	if (start > 0 && code[start - 1] === "\n") {
		start--;
	}

	let end = lastItem.end;
	while (end < code.length && (code[end] === " " || code[end] === "\t")) {
		end++;
	}
	if (end < code.length && code[end] === ",") {
		end++;
	}

	return {
		newText: "",
		replaceRange: { start, end },
	};
}

export interface WidgetRefactorOptions {
	moveNonFinalFieldsToState?: boolean;
}

/**
 * Computes all available refactoring actions for a cursor position or selection range.
 */
export function getAvailableRefactorActions(
	code: string,
	selectionStart: number,
	selectionEnd: number = selectionStart,
	options: WidgetRefactorOptions = {},
): RefactorAction[] {
	const scanner = new DartCodeScanner(code);
	const actions: RefactorAction[] = [];

	// RULE 1: Check for Multi-Widget Selection inside `children: [...]`
	if (selectionStart < selectionEnd) {
		const selectedListItems = scanner.findSelectedWidgetsInList(selectionStart, selectionEnd);
		if (selectedListItems.length > 1) {
			// Multi-widget selection: ONLY return Wrap with Row, Wrap with Column, and Remove widgets
			const wrapCol = generateMultiWidgetWrap(code, selectedListItems, "Column");
			actions.push({
				id: "dart.refactor.wrapWithColumn.multi",
				isMultiWidget: true,
				kind: "refactor.rewrite",
				newText: wrapCol.newText,
				replaceRange: wrapCol.replaceRange,
				title: "Wrap with Column",
			});

			const wrapRow = generateMultiWidgetWrap(code, selectedListItems, "Row");
			actions.push({
				id: "dart.refactor.wrapWithRow.multi",
				isMultiWidget: true,
				kind: "refactor.rewrite",
				newText: wrapRow.newText,
				replaceRange: wrapRow.replaceRange,
				title: "Wrap with Row",
			});

			const removeWidgets = generateRemoveMultiWidgets(code, selectedListItems);
			actions.push({
				id: "dart.refactor.removeWidgets",
				isMultiWidget: true,
				kind: "refactor.rewrite",
				newText: removeWidgets.newText,
				replaceRange: removeWidgets.replaceRange,
				title: "Remove widgets",
			});

			return actions;
		}
	}

	// RULE 2: Check if cursor is on Class Declaration Header
	const classHeader = findClassDeclarationHeader(code, selectionStart);
	if (classHeader) {
		if (classHeader.kind === "StatelessWidget") {
			const converted = convertStatelessToStateful(code, classHeader, options);
			actions.push({
				id: "dart.refactor.convertToStatefulWidget",
				kind: "refactor.rewrite",
				newText: converted.newText,
				replaceRange: converted.replaceRange,
				title: "Convert to StatefulWidget",
			});
			return actions;
		} else if (classHeader.kind === "StatefulWidget" || classHeader.kind === "State") {
			const converted = convertStatefulToStateless(code, classHeader, options);
			actions.push({
				id: "dart.refactor.convertToStatelessWidget",
				kind: "refactor.rewrite",
				newText: converted.newText,
				replaceRange: converted.replaceRange,
				title: "Convert to StatelessWidget",
			});
			return actions;
		}
	}

	// RULE 3: Single Widget Selection / Cursor Placement
	const targetWidget = scanner.findEnclosingWidget(selectionStart);
	if (!targetWidget) return actions;

	const targetRange: TextRange = { start: targetWidget.start, end: targetWidget.end };

	// 1. Wrap with widget...
	actions.push({
		id: "dart.refactor.wrapWithWidget",
		kind: "refactor.rewrite",
		newText: generateSingleWidgetWrap(code, targetRange, "widget"),
		replaceRange: targetRange,
		snippetText: generateSingleWidgetWrapSnippet(code, targetRange, "widget"),
		title: "Wrap with widget...",
	});

	// 2. Wrap with Padding
	actions.push({
		id: "dart.refactor.wrapWithPadding",
		kind: "refactor.rewrite",
		newText: generateSingleWidgetWrap(code, targetRange, "Padding"),
		replaceRange: targetRange,
		title: "Wrap with Padding",
	});

	// 3. Wrap with Center
	actions.push({
		id: "dart.refactor.wrapWithCenter",
		kind: "refactor.rewrite",
		newText: generateSingleWidgetWrap(code, targetRange, "Center"),
		replaceRange: targetRange,
		title: "Wrap with Center",
	});

	// 4. Wrap with Container
	actions.push({
		id: "dart.refactor.wrapWithContainer",
		kind: "refactor.rewrite",
		newText: generateSingleWidgetWrap(code, targetRange, "Container"),
		replaceRange: targetRange,
		title: "Wrap with Container",
	});

	// 5. Wrap with Column
	actions.push({
		id: "dart.refactor.wrapWithColumn",
		kind: "refactor.rewrite",
		newText: generateSingleWidgetWrap(code, targetRange, "Column"),
		replaceRange: targetRange,
		title: "Wrap with Column",
	});

	// 6. Wrap with Row
	actions.push({
		id: "dart.refactor.wrapWithRow",
		kind: "refactor.rewrite",
		newText: generateSingleWidgetWrap(code, targetRange, "Row"),
		replaceRange: targetRange,
		title: "Wrap with Row",
	});

	// 7. Wrap with SizedBox
	actions.push({
		id: "dart.refactor.wrapWithSizedBox",
		kind: "refactor.rewrite",
		newText: generateSingleWidgetWrap(code, targetRange, "SizedBox"),
		replaceRange: targetRange,
		title: "Wrap with SizedBox",
	});

	// 8. Wrap with Expanded
	actions.push({
		id: "dart.refactor.wrapWithExpanded",
		kind: "refactor.rewrite",
		newText: generateSingleWidgetWrap(code, targetRange, "Expanded"),
		replaceRange: targetRange,
		title: "Wrap with Expanded",
	});

	// 9. Remove this widget
	const remove = generateRemoveWidget(code, targetWidget);
	actions.push({
		id: "dart.refactor.removeWidget",
		kind: "refactor.rewrite",
		newText: remove.newText,
		replaceRange: remove.replaceRange,
		title: "Remove this widget",
	});

	// 10. Extract Widget
	const extracted = generateExtractWidget(code, targetRange, "NewWidget");
	actions.push({
		appendText: extracted.appendText,
		id: "dart.refactor.extractWidget",
		kind: "refactor.extract",
		newText: extracted.usageText,
		replaceRange: targetRange,
		title: "Extract Widget",
	});

	return actions;
}

const DART_RESERVED_WORDS = new Set([
	"abstract", "as", "assert", "async", "await", "break", "case", "catch",
	"class", "const", "continue", "covariant", "default", "deferred", "do",
	"dynamic", "else", "enum", "export", "extends", "extension", "external",
	"factory", "false", "final", "finally", "for", "Function", "get", "hide",
	"if", "implements", "import", "in", "interface", "is", "late", "library",
	"mixin", "new", "null", "of", "on", "operator", "part", "required", "rethrow",
	"return", "set", "show", "static", "super", "switch", "sync", "this",
	"throw", "true", "try", "typedef", "var", "void", "while", "with", "yield",
	"context",
]);

export interface ExtractedVariable {
	name: string;
	type: string;
}

/**
 * Scans a widget code snippet for locally declared identifiers (e.g. closure/builder parameters, local vars, for loops).
 */
export function findLocallyDeclaredVariables(widgetCode: string): Set<string> {
	const localVars = new Set<string>();
	const cleanCode = stripComments(widgetCode);

	// 1. Match closure / builder parameter lists: `(context, index) =>` or `(context, index) {` or `(int index) {`
	const closureRegex = /\(([^()]*)\)\s*(?:=>|\{)/g;
	let match: RegExpExecArray | null;
	while ((match = closureRegex.exec(cleanCode)) !== null) {
		const paramListStr = match[1].trim();
		if (!paramListStr) continue;

		// Split parameters by comma
		const params = paramListStr.split(",");
		for (const rawParam of params) {
			const param = rawParam.trim().replace(/^[{}[\]]+|[{}[\]]+$/g, "").trim();
			if (!param) continue;

			// Handle default values: `int count = 0` -> `int count`
			const withoutDefault = param.split("=")[0].trim();
			// Get the last identifier in parameter signature: `BuildContext context` -> `context`, `final index` -> `index`
			const identMatch = /\b([a-z_][a-zA-Z0-9_]*)\b$/.exec(withoutDefault);
			if (identMatch) {
				const varName = identMatch[1];
				if (!DART_RESERVED_WORDS.has(varName)) {
					localVars.add(varName);
				}
			}
		}
	}

	// 2. Match local variable declarations: `var x =`, `final x =`, `final int x =`
	const declRegex = /\b(?:var|final|late|const)\s+(?:[A-Za-z0-9_<>,?\s]+\s+)?([a-z_][a-zA-Z0-9_]*)\s*(?:=|;|\bin\b|,)/g;
	while ((match = declRegex.exec(cleanCode)) !== null) {
		const varName = match[1];
		if (!DART_RESERVED_WORDS.has(varName)) {
			localVars.add(varName);
		}
	}

	// 3. Match `for (final item in items)` or `for (var i = 0; ...)`
	const forRegex = /\bfor\s*\(\s*(?:var|final|[A-Z][a-zA-Z0-9_]*)\s+([a-z_][a-zA-Z0-9_]*)\s*(?:in|=)/g;
	while ((match = forRegex.exec(cleanCode)) !== null) {
		const varName = match[1];
		if (!DART_RESERVED_WORDS.has(varName)) {
			localVars.add(varName);
		}
	}

	return localVars;
}

/**
 * Extracts all free variable identifiers from a widget code snippet.
 */
export function extractFreeVariables(widgetCode: string): string[] {
	const variables = new Set<string>();
	const locallyDeclared = findLocallyDeclaredVariables(widgetCode);
	const identRegex = /\b[a-z_][a-zA-Z0-9_]*\b/g;
	let match: RegExpExecArray | null;

	while ((match = identRegex.exec(widgetCode)) !== null) {
		const name = match[0];
		const index = match.index;

		if (DART_RESERVED_WORDS.has(name)) continue;
		if (locallyDeclared.has(name)) continue;

		// Check if preceded by a dot: `object.property` -> property is not free
		let prevIndex = index - 1;
		while (prevIndex >= 0 && (widgetCode[prevIndex] === " " || widgetCode[prevIndex] === "\t")) {
			prevIndex--;
		}
		if (prevIndex >= 0 && widgetCode[prevIndex] === ".") continue;

		// Check if it's a named parameter label: `label: value`
		let nextIndex = index + name.length;
		while (nextIndex < widgetCode.length && (widgetCode[nextIndex] === " " || widgetCode[nextIndex] === "\t")) {
			nextIndex++;
		}
		if (nextIndex < widgetCode.length && widgetCode[nextIndex] === ":") {
			if (prevIndex >= 0 && (widgetCode[prevIndex] === "(" || widgetCode[prevIndex] === "," || widgetCode[prevIndex] === "\n")) {
				continue;
			}
		}

		variables.add(name);
	}

	return Array.from(variables);
}

/**
 * Replaces comments in Dart code with spaces to preserve character offsets and line counts.
 */
export function stripComments(code: string): string {
	let result = "";
	let i = 0;
	const len = code.length;

	while (i < len) {
		const char = code[i];
		const next = i + 1 < len ? code[i + 1] : "";

		// Single line comment
		if (char === "/" && next === "/") {
			while (i < len && code[i] !== "\n") {
				result += " ";
				i++;
			}
			continue;
		}

		// Block comment
		if (char === "/" && next === "*") {
			result += "  ";
			i += 2;
			while (i < len && !(code[i] === "*" && i + 1 < len && code[i + 1] === "/")) {
				result += code[i] === "\n" ? "\n" : " ";
				i++;
			}
			if (i < len) {
				result += "  ";
				i += 2;
			}
			continue;
		}

		// Normal/raw strings: keep them as is
		if (char === "'" || char === "\"") {
			const quote = char;
			result += char;
			i++;
			while (i < len) {
				if (code[i] === "\\") {
					result += code[i] + (i + 1 < len ? code[i + 1] : "");
					i += 2;
				} else if (code[i] === quote) {
					result += code[i];
					i++;
					break;
				} else {
					result += code[i];
					i++;
				}
			}
			continue;
		}

		result += char;
		i++;
	}

	return result;
}

/**
 * Parses a type signature at a given startIndex in comment-stripped code.
 * Handles generic types with deep nesting, records, and nullable types:
 * e.g. `CustomState<(String name, bool isSelected)>`, `CustomState<State<T>>`, `double`, `ThemeData?`
 */
export function extractTypeAt(code: string, startIndex: number): string | undefined {
	let i = startIndex;
	while (i < code.length && (code[i] === " " || code[i] === "\t" || code[i] === "\n" || code[i] === "\r")) {
		i++;
	}

	if (i >= code.length) return undefined;

	if (code.startsWith("const ", i)) {
		i += 6;
		while (i < code.length && (code[i] === " " || code[i] === "\t" || code[i] === "\n" || code[i] === "\r")) {
			i++;
		}
	} else if (code.startsWith("new ", i)) {
		i += 4;
		while (i < code.length && (code[i] === " " || code[i] === "\t" || code[i] === "\n" || code[i] === "\r")) {
			i++;
		}
	}

	const identMatch = /[A-Za-z0-9_]+/y;
	identMatch.lastIndex = i;
	const match = identMatch.exec(code);
	if (!match) return undefined;

	let typeName = match[0];
	i += typeName.length;

	// Check for generic arguments `<...>`
	if (i < code.length && code[i] === "<") {
		let genericDepth = 0;
		let parenDepth = 0;
		let bracketDepth = 0;
		let braceDepth = 0;
		const genericStart = i;

		while (i < code.length) {
			const c = code[i];
			if (c === "<") {
				genericDepth++;
			} else if (c === ">") {
				genericDepth--;
				if (genericDepth === 0) {
					i++;
					break;
				}
			} else if (c === "(") {
				parenDepth++;
			} else if (c === ")") {
				parenDepth = Math.max(0, parenDepth - 1);
			} else if (c === "[") {
				bracketDepth++;
			} else if (c === "]") {
				bracketDepth = Math.max(0, bracketDepth - 1);
			} else if (c === "{") {
				braceDepth++;
			} else if (c === "}") {
				braceDepth = Math.max(0, braceDepth - 1);
			} else if (c === ";" || (genericDepth === 0 && (c === "=" || c === "," || c === "\n"))) {
				break;
			}
			i++;
		}

		if (genericDepth === 0) {
			typeName += code.substring(genericStart, i);
		}
	}

	// Check for nullable `?`
	if (i < code.length && code[i] === "?") {
		typeName += "?";
	}

	return typeName.trim();
}

/**
 * Infers types of extracted variables by scanning enclosing scope or usage patterns.
 */
export function inferVariableTypes(fullCode: string, widgetStartOffset: number, variableNames: string[], widgetCode: string): ExtractedVariable[] {
	const cleanScopeBefore = stripComments(fullCode.substring(0, widgetStartOffset));
	const cleanFullCode = stripComments(fullCode);

	return variableNames.map((name) => {
		let foundType: string | undefined;

		// 1. Check for `var name = Constructor<...>(...)` or `final name = Constructor<...>(...)`
		const initRegex = new RegExp(`\\b(?:var|final|late)\\s+\\b${name}\\b\\s*=\\s*`, "g");
		let match: RegExpExecArray | null;
		while ((match = initRegex.exec(cleanScopeBefore)) !== null) {
			const rhsStart = match.index + match[0].length;
			const inferred = extractTypeAt(cleanScopeBefore, rhsStart);
			if (inferred && inferred !== "var" && inferred !== "final" && inferred !== "late") {
				foundType = inferred;
			}
		}

		// 2. Check for explicit type declaration: `CustomType<...> name` or `final CustomType<...> name;`
		if (!foundType) {
			const declRegex = new RegExp(`\\b(?:final\\s+|const\\s+|late\\s+)?([A-Z][a-zA-Z0-9_]*)\\s*(?:<[^;=]+>)?\\s*\\??\\s+\\b${name}\\b\\s*(?:[;=,)]|$)`, "g");
			while ((match = declRegex.exec(cleanScopeBefore)) !== null) {
				const matchStr = match[0];
				const typeOffsetInMatch = matchStr.search(/[A-Z]/);
				if (typeOffsetInMatch !== -1) {
					const typeStart = match.index + typeOffsetInMatch;
					const inferred = extractTypeAt(cleanScopeBefore, typeStart);
					if (inferred && inferred !== "final" && inferred !== "const" && inferred !== "late" && inferred !== "var") {
						foundType = inferred;
					}
				}
			}
		}

		// 3. Check for class methods / functions in the file: e.g. `Expanded expanded()` or `Widget expanded()` or `void handleTap()`
		if (!foundType) {
			const methodRegex = new RegExp(`\\b([A-Za-z0-9_]+)\\s*(?:<[^;{]+>)?\\s*\\??\\s+\\b${name}\\s*\\(`, "g");
			while ((match = methodRegex.exec(cleanFullCode)) !== null) {
				const retStart = match.index;
				const retType = extractTypeAt(cleanFullCode, retStart);
				if (retType && retType !== "if" && retType !== "while" && retType !== "switch") {
					if (retType === "void") {
						foundType = "VoidCallback";
					} else {
						foundType = `${retType} Function()`;
					}
				}
			}
		}

		// 4. Check for `Theme.of(context)`
		if (!foundType) {
			const themeRegex = new RegExp(`\\b${name}\\s*=\\s*Theme\\.of\\b`);
			if (themeRegex.test(cleanScopeBefore)) {
				foundType = "ThemeData";
			}
		}

		// 5. Infer from usage in widgetCode
		if (!foundType) {
			const callRegex = new RegExp(`\\b${name}\\s*\\(`);
			if (callRegex.test(widgetCode)) {
				foundType = "Widget Function()";
			}
		}

		if (!foundType) {
			const strCompareRegex = new RegExp(`\\b${name}\\s*(?:==|!=)\\s*['"]|['"]\\s*(?:==|!=)\\s*\\b${name}\\b`);
			if (strCompareRegex.test(widgetCode)) {
				foundType = "String";
			}
		}

		if (!foundType) {
			const numRegex = new RegExp(`\\b${name}\\s*[*+/-]\\s*\\d|\\b(?:width|height|size|radius|fontSize)\\s*:\\s*\\b${name}\\b`);
			if (numRegex.test(widgetCode)) {
				foundType = "double";
			}
		}

		if (!foundType) {
			const boolRegex = new RegExp(`\\b${name}\\s*\\?|\\b${name}\\s*&&|\\b${name}\\s*\\|\\|`);
			if (boolRegex.test(widgetCode)) {
				foundType = "bool";
			}
		}

		if (!foundType) {
			foundType = "dynamic";
		}

		return { name, type: foundType };
	});
}

/**
 * Generates Extract Widget transformation: the usage invocation and the new StatelessWidget class.
 */
export function generateExtractWidget(
	fullCode: string,
	targetRange: TextRange,
	newWidgetName = "NewWidget",
): { usageText: string; classText: string; fullEditedCode: string; replaceRange: TextRange; appendText: string } {
	const widgetCode = fullCode.substring(targetRange.start, targetRange.end);
	const varNames = extractFreeVariables(widgetCode);
	const variables = inferVariableTypes(fullCode, targetRange.start, varNames, widgetCode);

	let usageText: string;
	if (variables.length > 0) {
		const args = variables.map((v) => `${v.name}: ${v.name}`).join(", ");
		usageText = `${newWidgetName}(${args})`;
	} else {
		usageText = `const ${newWidgetName}()`;
	}

	const indentedBody = widgetCode.split("\n").map((line, idx) => {
		if (idx === 0) return line;
		return "    " + line;
	}).join("\n");

	let classText: string;
	if (variables.length > 0) {
		const constructorParams = variables.map((v) => `    required this.${v.name},`).join("\n");
		const fieldDeclarations = variables.map((v) => `  final ${v.type} ${v.name};`).join("\n");

		classText = `\n\nclass ${newWidgetName} extends StatelessWidget {\n  const ${newWidgetName}({\n    super.key,\n${constructorParams}\n  });\n\n${fieldDeclarations}\n\n  @override\n  Widget build(BuildContext context) {\n    return ${indentedBody};\n  }\n}`;
	} else {
		classText = `\n\nclass ${newWidgetName} extends StatelessWidget {\n  const ${newWidgetName}({super.key});\n\n  @override\n  Widget build(BuildContext context) {\n    return ${indentedBody};\n  }\n}`;
	}

	const fullEditedCode = fullCode.substring(0, targetRange.start) + usageText + fullCode.substring(targetRange.end) + classText;

	return {
		appendText: classText,
		classText,
		fullEditedCode,
		replaceRange: targetRange,
		usageText,
	};
}

export interface ClassDeclarationInfo {
	className: string;
	kind: "StatelessWidget" | "StatefulWidget" | "State";
	stateOfClassName?: string;
	classStart: number;
	classEnd: number;
	headerStart: number;
	headerEnd: number;
}

/**
 * Detects if the given offset is on a class declaration header before the opening `{`.
 */
export function findClassDeclarationHeader(code: string, offset: number): ClassDeclarationInfo | undefined {
	const scanner = new DartCodeScanner(code);
	const classRegex = /\bclass\s+([A-Za-z0-9_]+)(?:<[^>]+>)?\s+extends\s+([A-Za-z0-9_]+)(?:<([A-Za-z0-9_]+)>)?/g;
	let match: RegExpExecArray | null;

	while ((match = classRegex.exec(code)) !== null) {
		const classStart = match.index;
		const className = match[1];
		const superclass = match[2];
		const typeArg = match[3];

		const openBrace = code.indexOf("{", classStart);
		if (openBrace === -1) continue;

		if (offset >= classStart && offset <= openBrace) {
			const closeBrace = scanner.findMatchingBracket(openBrace);
			if (closeBrace === -1) continue;

			if (superclass === "StatelessWidget") {
				return {
					className,
					classEnd: closeBrace + 1,
					classStart,
					headerEnd: openBrace,
					headerStart: classStart,
					kind: "StatelessWidget",
				};
			} else if (superclass === "StatefulWidget") {
				return {
					className,
					classEnd: closeBrace + 1,
					classStart,
					headerEnd: openBrace,
					headerStart: classStart,
					kind: "StatefulWidget",
				};
			} else if (superclass === "State" && typeArg) {
				return {
					className,
					classEnd: closeBrace + 1,
					classStart,
					headerEnd: openBrace,
					headerStart: classStart,
					kind: "State",
					stateOfClassName: typeArg,
				};
			}
		}
	}

	return undefined;
}

/**
 * Replaces field references with `widget.field` in method code.
 */
export function replaceFieldReferencesWithWidget(methodCode: string, fieldNames: string[]): string {
	let result = methodCode;
	for (const field of fieldNames) {
		const regex = new RegExp(`(?<![.\\w])\\b${field}\\b(?!\\s*:)`, "g");
		result = result.replace(regex, `widget.${field}`);
	}
	return result;
}

/**
 * Replaces `widget.field` with `field` in method code.
 */
export function replaceWidgetReferencesWithField(methodCode: string): string {
	return methodCode.replace(/\bwidget\.([a-zA-Z0-9_]+)\b/g, "$1");
}

/**
 * Splits a class body into individual top-level members (constructors, fields, methods, getters, setters).
 */
export function parseClassMembers(bodyCode: string): string[] {
	const members: string[] = [];
	let memberStart = 0;
	let inString: string | null = null;
	let inLineComment = false;
	let inBlockComment = false;
	let braceDepth = 0;
	let parenDepth = 0;
	let bracketDepth = 0;

	for (let i = 0; i < bodyCode.length; i++) {
		const ch = bodyCode[i];
		const next = bodyCode[i + 1];

		if (inLineComment) {
			if (ch === "\n") inLineComment = false;
			continue;
		}
		if (inBlockComment) {
			if (ch === "*" && next === "/") {
				inBlockComment = false;
				i++;
			}
			continue;
		}
		if (inString) {
			if (ch === "\\") {
				i++;
			} else if (ch === inString) {
				inString = null;
			}
			continue;
		}

		if (ch === "/" && next === "/") {
			inLineComment = true;
			i++;
			continue;
		}
		if (ch === "/" && next === "*") {
			inBlockComment = true;
			i++;
			continue;
		}
		if (ch === "'" || ch === '"') {
			inString = ch;
			continue;
		}

		if (ch === "(") parenDepth++;
		else if (ch === ")") parenDepth--;
		else if (ch === "{") braceDepth++;
		else if (ch === "}") braceDepth--;
		else if (ch === "[") bracketDepth++;
		else if (ch === "]") bracketDepth--;

		if (parenDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
			if (ch === ";" || ch === "}") {
				const memberText = bodyCode.substring(memberStart, i + 1).trim();
				if (memberText) {
					members.push(memberText);
				}
				memberStart = i + 1;
			}
		}
	}

	const remaining = bodyCode.substring(memberStart).trim();
	if (remaining) {
		members.push(remaining);
	}

	return members;
}

export function isConstructorMember(className: string | undefined, member: string): boolean {
	if (!className) return false;
	return new RegExp(`^\\s*(?:const\\s+|factory\\s+)?${className}\\b`).test(member.trim());
}

export function isFieldMember(member: string, className?: string): boolean {
	const trimmed = member.trim();
	if (className && isConstructorMember(className, trimmed)) return false;
	if (trimmed.startsWith("@override")) return false;
	if (trimmed.endsWith("}")) return false;
	if (trimmed.includes("=>")) return false;
	if (trimmed.includes("build(")) return false;
	if (trimmed.startsWith("final ") || trimmed.startsWith("late ") || trimmed.startsWith("const ") || trimmed.startsWith("var ")) {
		return true;
	}
	return trimmed.endsWith(";");
}

export function isFinalOrConstField(member: string): boolean {
	const trimmed = member.trim();
	return trimmed.startsWith("final ") || trimmed.startsWith("const ");
}

/**
 * Joins class members with appropriate spacing:
 * - Consecutive field declarations are joined with a single newline (`\n  `).
 * - Constructors, methods, getters, and other multiline blocks are separated with a blank line (`\n\n  `).
 */
export function joinClassMembers(members: string[], className?: string): string {
	if (members.length === 0) return "";
	let result = members[0];
	for (let i = 1; i < members.length; i++) {
		const prev = members[i - 1];
		const curr = members[i];
		if (isFieldMember(prev, className) && isFieldMember(curr, className)) {
			result += "\n  " + curr;
		} else {
			result += "\n\n  " + curr;
		}
	}
	return result;
}

/**
 * Converts a StatelessWidget into a StatefulWidget with a matching State class.
 * Replaces constructor field references in build() and methods with `widget.fieldname`.
 */
export function convertStatelessToStateful(
	code: string,
	classInfo: ClassDeclarationInfo,
	options: WidgetRefactorOptions = {},
): { replaceRange: TextRange; newText: string } {
	const moveNonFinalToState = options.moveNonFinalFieldsToState !== false;
	const classCode = code.substring(classInfo.classStart, classInfo.classEnd);
	const openBraceIndex = classCode.indexOf("{");
	if (openBraceIndex === -1) {
		return { newText: classCode, replaceRange: { end: classInfo.classEnd, start: classInfo.classStart } };
	}

	const bodyCode = classCode.substring(openBraceIndex + 1, classCode.length - 1);
	const members = parseClassMembers(bodyCode);

	const className = classInfo.className;
	const stateClassName = `_${className}State`;

	let widgetMembers: string[] = [];
	const stateMembers: string[] = [];
	const finalFieldNames: string[] = [];

	for (const member of members) {
		if (isConstructorMember(className, member)) {
			widgetMembers.push(member);
		} else if (isFieldMember(member, className)) {
			if (!moveNonFinalToState || isFinalOrConstField(member)) {
				widgetMembers.push(member);
				const match = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:=[^;]*)?;$/.exec(member.trim());
				if (match && match[1] !== "key") {
					finalFieldNames.push(match[1]);
				}
			} else {
				// Non-final / mutable field moves to State
				stateMembers.push(member);
			}
		} else {
			stateMembers.push(member);
		}
	}

	const transformedStateMembers = stateMembers.map((m) => {
		if (isFieldMember(m, className)) return m;
		return replaceFieldReferencesWithWidget(m, finalFieldNames);
	});

	// Ensure constructor in StatefulWidget has 'const ' if eligible (ends with ';')
	const allWidgetFieldsFinal = widgetMembers.every(
		(m) => !isFieldMember(m, className) || isFinalOrConstField(m),
	);
	if (allWidgetFieldsFinal) {
		widgetMembers = widgetMembers.map((m) => {
			if (isConstructorMember(className, m) && !m.startsWith("const ") && !m.startsWith("factory ") && m.trim().endsWith(";")) {
				return "const " + m.trimStart();
			}
			return m;
		});
	}

	const widgetBody = joinClassMembers(widgetMembers, className).trim();
	const widgetBodyFormatted = widgetBody
		? `  ${widgetBody}\n\n  @override\n  State<${className}> createState() => ${stateClassName}();`
		: `  @override\n  State<${className}> createState() => ${stateClassName}();`;

	const stateBody = joinClassMembers(transformedStateMembers, stateClassName).trim();
	const stateBodyFormatted = stateBody ? `  ${stateBody}` : "";

	const newWidgetClass = `class ${className} extends StatefulWidget {\n${widgetBodyFormatted}\n}`;
	const newStateClass = `class ${stateClassName} extends State<${className}> {\n${stateBodyFormatted}\n}`;

	const newText = `${newWidgetClass}\n\n${newStateClass}`;
	return { newText, replaceRange: { end: classInfo.classEnd, start: classInfo.classStart } };
}

/**
 * Converts a StatefulWidget + State class pair into a single StatelessWidget.
 * Replaces `widget.fieldname` in build() and methods with `fieldname`.
 */
export function convertStatefulToStateless(
	code: string,
	classInfo: ClassDeclarationInfo,
	options: WidgetRefactorOptions = {},
): { replaceRange: TextRange; newText: string } {
	const scanner = new DartCodeScanner(code);
	const targetClassName = classInfo.kind === "State" && classInfo.stateOfClassName
		? classInfo.stateOfClassName
		: classInfo.className;

	const widgetClassRegex = new RegExp(`\\bclass\\s+${targetClassName}\\s+extends\\s+StatefulWidget\\b`);
	const widgetMatch = widgetClassRegex.exec(code);
	if (!widgetMatch) {
		return { newText: code.substring(classInfo.classStart, classInfo.classEnd), replaceRange: { end: classInfo.classEnd, start: classInfo.classStart } };
	}

	const widgetClassStart = widgetMatch.index;
	const widgetOpenBrace = code.indexOf("{", widgetClassStart);
	if (widgetOpenBrace === -1) return { newText: "", replaceRange: { end: classInfo.classEnd, start: classInfo.classStart } };
	const widgetCloseBrace = scanner.findMatchingBracket(widgetOpenBrace);
	if (widgetCloseBrace === -1) return { newText: "", replaceRange: { end: classInfo.classEnd, start: classInfo.classStart } };

	const stateClassRegex = new RegExp(`\\bclass\\s+[A-Za-z0-9_]+\\s+extends\\s+State<\\s*${targetClassName}\\s*>`);
	const stateMatch = stateClassRegex.exec(code);

	let stateClassStart = -1;
	let stateClassEnd = -1;
	let stateBody = "";

	if (stateMatch) {
		stateClassStart = stateMatch.index;
		const stateOpenBrace = code.indexOf("{", stateClassStart);
		if (stateOpenBrace !== -1) {
			const stateCloseBrace = scanner.findMatchingBracket(stateOpenBrace);
			if (stateCloseBrace !== -1) {
				stateClassEnd = stateCloseBrace + 1;
				stateBody = code.substring(stateOpenBrace + 1, stateCloseBrace);
			}
		}
	}

	const widgetBody = code.substring(widgetOpenBrace + 1, widgetCloseBrace);
	let widgetMembers = parseClassMembers(widgetBody).filter(
		(m) => !m.includes("createState()") && !m.includes("State<" + targetClassName + ">"),
	);

	const stateMembers = parseClassMembers(stateBody).map((m) => replaceWidgetReferencesWithField(m));

	const combinedMembers = [...widgetMembers, ...stateMembers];
	const hasNonFinalField = combinedMembers.some(
		(m) => isFieldMember(m, targetClassName) && !isFinalOrConstField(m),
	);

	if (hasNonFinalField && options.moveNonFinalFieldsToState !== false) {
		// If class has non-final fields, remove 'const ' from constructor to avoid const_constructor_with_non_final_field
		widgetMembers = widgetMembers.map((m) => {
			if (isConstructorMember(targetClassName, m)) {
				return m.replace(/^const\s+/, "");
			}
			return m;
		});
	} else if (!hasNonFinalField) {
		// If all fields are final, ensure constructor has 'const ' if eligible (ends with ';')
		widgetMembers = widgetMembers.map((m) => {
			if (isConstructorMember(targetClassName, m) && !m.startsWith("const ") && !m.startsWith("factory ") && m.trim().endsWith(";")) {
				return "const " + m.trimStart();
			}
			return m;
		});
	}

	const finalCombined = [...widgetMembers, ...stateMembers];
	const combinedBody = joinClassMembers(finalCombined, targetClassName).trim();

	const newClass = `class ${targetClassName} extends StatelessWidget {\n  ${combinedBody}\n}`;

	const replaceStart = Math.min(widgetClassStart, stateClassStart !== -1 ? stateClassStart : widgetClassStart);
	const replaceEnd = Math.max(widgetCloseBrace + 1, stateClassEnd !== -1 ? stateClassEnd : widgetCloseBrace + 1);

	return {
		newText: newClass,
		replaceRange: { end: replaceEnd, start: replaceStart },
	};
}
