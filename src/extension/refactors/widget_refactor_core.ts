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
		const pattern = /\b(?:const\s+|new\s+)?(_?[A-Z][A-Za-z0-9_]*(?:\.[A-Z][A-Za-z0-9_]*|\.[a-z][A-Za-z0-9_]*)?)\s*\(/g;
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

		// When the cursor is on a collection `if`/`else` element (the condition,
		// the `if`/`else` keywords or the whitespace between them) there is no
		// widget under the cursor and the innermost match is an ancestor widget
		// such as the enclosing `Column`. Target the first widget of the active
		// branch instead, so extracting does not pull out the whole list.
		const branchTarget = this.findCollectionIfTarget(offset, allWidgets);
		if (branchTarget && (!innermost || innermost.start < branchTarget.itemStart))
			return branchTarget.widget;

		return innermost;
	}

	/**
	 * Finds the widget of the active branch of a collection `if`/`else` element
	 * that contains the given offset.
	 */
	private findCollectionIfTarget(
		offset: number,
		widgets: Array<{ start: number; end: number; name: string; argsStart: number; argsEnd: number }>,
	): { itemStart: number; widget: { start: number; end: number; name: string; argsStart: number; argsEnd: number } } | undefined {
		const items = this.findCollectionIfItems();
		let best: { start: number; end: number } | undefined;

		for (const item of items) {
			const lineStart = this.code.lastIndexOf("\n", item.start) + 1;
			const containsOffset = (offset >= item.start && offset <= item.end) || (offset >= lineStart && offset < item.start);
			if (!containsOffset) continue;
			if (!best || item.start > best.start) best = item;
		}

		if (!best)
			return undefined;

		const branch = this.resolveCollectionIfBranch(best.start, best.end, offset);
		if (!branch)
			return undefined;

		const branchStart = this.skipWhitespace(branch.start, branch.end);
		let firstWidget: { start: number; end: number; name: string; argsStart: number; argsEnd: number } | undefined;
		for (const widget of widgets) {
			if (widget.start < branch.start || widget.start >= branch.end) continue;
			if (!firstWidget || widget.start < firstWidget.start)
				firstWidget = widget;
		}

		// Only use a widget constructor when it is the whole branch expression.
		// Branches like `foo(Text('a'))` or `widget.trailing!` are not widget
		// constructors themselves, so the branch expression is the target.
		if (firstWidget?.start === branchStart)
			return { itemStart: best.start, widget: firstWidget };

		let branchEnd = branch.end;
		while (branchEnd > branchStart && /\s/.test(this.code[branchEnd - 1])) branchEnd--;
		if (branchEnd <= branchStart)
			return undefined;

		return {
			itemStart: best.start,
			widget: { argsEnd: branchStart, argsStart: branchStart, end: branchEnd, name: "widget", start: branchStart },
		};
	}

	/**
	 * Finds top-level `if` elements inside collection literals.
	 */
	private findCollectionIfItems(): Array<{ start: number; end: number }> {
		const brackets: Array<{ open: number; close: number }> = [];
		const stack: number[] = [];
		let i = 0;

		while (i < this.code.length) {
			const char = this.code[i];
			const next = this.code[i + 1] ?? "";

			if (char === "/" && next === "/") {
				i += 2;
				while (i < this.code.length && this.code[i] !== "\n") i++;
				continue;
			}
			if (char === "/" && next === "*") {
				i += 2;
				while (i < this.code.length && !(this.code[i] === "*" && this.code[i + 1] === "/")) i++;
				i = Math.min(this.code.length, i + 2);
				continue;
			}
			if (char === "'" || char === "\"") {
				i = this.skipStringLiteral(i);
				continue;
			}

			if (char === "[")
				stack.push(i);
			else if (char === "]") {
				const open = stack.pop();
				if (open !== undefined)
					brackets.push({ close: i, open });
			}
			i++;
		}

		const items: Array<{ start: number; end: number }> = [];
		for (const bracket of brackets) {
			for (const item of this.parseListItems(bracket.open + 1, bracket.close)) {
				if (/^if\b/.test(item.text))
					items.push({ end: item.end, start: item.start });
			}
		}
		return items;
	}

	/**
	 * Resolves the source range of the branch selected by the cursor inside a
	 * collection `if`/`else` element, following `else if` chains.
	 */
	private resolveCollectionIfBranch(itemStart: number, itemEnd: number, offset: number): { start: number; end: number } | undefined {
		let start = itemStart;
		const end = itemEnd;

		while (start < end) {
			const ifStart = this.skipWhitespace(start, end);
			if (!this.code.startsWith("if", ifStart) || !/[\s(]/.test(this.code[ifStart + 2] ?? ""))
				return undefined;

			const openParen = this.code.indexOf("(", ifStart + 2);
			if (openParen === -1 || openParen >= end)
				return undefined;
			const closeParen = this.findMatchingBracket(openParen);
			if (closeParen === -1 || closeParen >= end)
				return undefined;

			const elseIndex = this.findTopLevelElse(closeParen + 1, end);

			// The cursor is in the condition (or on the `if` keyword): use the
			// then branch.
			if (offset <= closeParen)
				return { end: elseIndex === -1 ? end : elseIndex, start: closeParen + 1 };

			// No `else` at all: the offset is in the then branch.
			if (elseIndex === -1)
				return { end, start: closeParen + 1 };

			// The cursor is in the then branch. Whitespace on the same line as
			// `else` (before the keyword) belongs to the else branch.
			const elseLineStart = this.code.lastIndexOf("\n", elseIndex) + 1;
			if (offset < elseIndex && offset < elseLineStart)
				return { end: elseIndex, start: closeParen + 1 };

			// The cursor is in the else branch, which may be another `if`.
			const elseBranchStart = elseIndex + "else".length;
			const nestedIf = this.skipWhitespace(elseBranchStart, end);
			if (this.code.startsWith("if", nestedIf) && /[\s(]/.test(this.code[nestedIf + 2] ?? "")) {
				start = nestedIf;
				continue;
			}
			return { end, start: elseBranchStart };
		}

		return undefined;
	}

	/**
	 * Finds a top-level `else` keyword, ignoring nested collections, arguments,
	 * strings and comments.
	 */
	private findTopLevelElse(from: number, to: number): number {
		let parenDepth = 0;
		let bracketDepth = 0;
		let braceDepth = 0;
		let i = from;

		while (i < to) {
			const char = this.code[i];
			const next = this.code[i + 1] ?? "";

			if (char === "/" && next === "/") {
				i += 2;
				while (i < to && this.code[i] !== "\n") i++;
				continue;
			}
			if (char === "/" && next === "*") {
				i += 2;
				while (i < to && !(this.code[i] === "*" && this.code[i + 1] === "/")) i++;
				i = Math.min(to, i + 2);
				continue;
			}
			if (char === "'" || char === "\"") {
				i = this.skipStringLiteral(i);
				continue;
			}

			if (char === "(") parenDepth++;
			else if (char === ")") parenDepth = Math.max(0, parenDepth - 1);
			else if (char === "[") bracketDepth++;
			else if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
			else if (char === "{") braceDepth++;
			else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
			else if (
				parenDepth === 0 && bracketDepth === 0 && braceDepth === 0
				&& this.code.startsWith("else", i)
				&& !isIdentifierPart(this.code[i - 1] ?? "")
				&& !isIdentifierPart(this.code[i + "else".length] ?? "")
			)
				return i;

			i++;
		}

		return -1;
	}

	/**
	 * Skips a string literal and returns the index after its closing quote.
	 */
	private skipStringLiteral(start: number): number {
		const quote = this.code[start];
		const tripleQuoted = this.code[start + 1] === quote && this.code[start + 2] === quote;
		const terminator = tripleQuoted ? quote.repeat(3) : quote;
		let i = start + terminator.length;

		while (i < this.code.length) {
			if (this.code[i] === "\\") {
				i += 2;
				continue;
			}
			if (this.code.startsWith(terminator, i))
				return i + terminator.length;
			if (!tripleQuoted && this.code[i] === "\n")
				return i;
			i++;
		}

		return Math.min(i, this.code.length);
	}

	/**
	 * Skips whitespace and returns the next index.
	 */
	private skipWhitespace(start: number, end: number): number {
		let i = start;
		while (i < end && /\s/.test(this.code[i])) i++;
		return i;
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

/**
 * Members that are available implicitly inside a State's build method and
 * therefore must not be passed to an extracted StatelessWidget.
 */
const DART_IMPLICIT_MEMBERS = new Set([
	"context",
	"mounted",
	"setState",
	"widget",
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
	// Strip comments and string literals so we don't pick up words from comments/strings
	const sanitized = stripCommentsAndStrings(widgetCode);
	const locallyDeclared = findLocallyDeclaredVariables(sanitized);
	const identRegex = /\b[a-z_][a-zA-Z0-9_]*\b/g;
	let match: RegExpExecArray | null;

	while ((match = identRegex.exec(sanitized)) !== null) {
		const name = match[0];
		const index = match.index;

		if (DART_RESERVED_WORDS.has(name)) continue;
		if (DART_IMPLICIT_MEMBERS.has(name)) continue;
		if (locallyDeclared.has(name)) continue;

		// Check if preceded by a dot: `object.property` -> property is not free.
		// Spread usages (`...items`) are still free variables.
		let prevIndex = index - 1;
		while (prevIndex >= 0 && (sanitized[prevIndex] === " " || sanitized[prevIndex] === "\t")) {
			prevIndex--;
		}
		const isSpread = prevIndex >= 2 && sanitized[prevIndex] === "." && sanitized[prevIndex - 1] === "." && sanitized[prevIndex - 2] === ".";
		if (prevIndex >= 0 && sanitized[prevIndex] === "." && !isSpread) continue;

		// Check if it's a named parameter label: `label: value`
		let nextIndex = index + name.length;
		while (nextIndex < sanitized.length && (sanitized[nextIndex] === " " || sanitized[nextIndex] === "\t")) {
			nextIndex++;
		}
		if (nextIndex < sanitized.length && sanitized[nextIndex] === ":") {
			if (prevIndex >= 0 && (sanitized[prevIndex] === "(" || sanitized[prevIndex] === "," || sanitized[prevIndex] === "\n")) {
				continue;
			}
		}

		// Skip type/class/enum/constructor names (including private like _Section)
		if (/^_?[A-Z]/.test(name)) continue;

		variables.add(name);
	}

	// Properties read through `widget.` belong to the enclosing StatefulWidget and
	// are passed through to the extracted widget under their own name.
	const widgetMemberRegex = /\bwidget\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)/g;
	let memberMatch: RegExpExecArray | null;
	while ((memberMatch = widgetMemberRegex.exec(sanitized)) !== null) {
		const member = memberMatch[1];
		if (!DART_RESERVED_WORDS.has(member) && !DART_IMPLICIT_MEMBERS.has(member) && !locallyDeclared.has(member))
			variables.add(member);
	}

	return Array.from(variables);
}

/**
 * Replaces comments and literal string content with spaces to avoid extracting
 * identifiers from them, while preserving identifiers used in string
 * interpolations (e.g. `'$_online'` or `'${_online}'`).
 */
function stripCommentsAndStrings(code: string): string {
	return maskCommentsAndLiteralStrings(code, false).text;
}

interface MaskResult {
	text: string;
	next: number;
}

function maskCommentsAndLiteralStrings(code: string, stopAtBrace: boolean): MaskResult {
	let result = "";
	let braceDepth = 0;
	let i = 0;

	while (i < code.length) {
		const char = code[i];
		const next = i + 1 < code.length ? code[i + 1] : "";

		// Single line comment.
		if (char === "/" && next === "/") {
			const end = code.indexOf("\n", i);
			const stop = end === -1 ? code.length : end;
			for (; i < stop; i++)
				result += " ";
			continue;
		}

		// Block comment.
		if (char === "/" && next === "*") {
			const end = code.indexOf("*/", i + 2);
			const stop = end === -1 ? code.length : end + 2;
			for (; i < stop; i++)
				result += code[i] === "\n" ? "\n" : " ";
			continue;
		}

		// Raw strings do not interpolate.
		if (char === "r" && (next === "'" || next === "\"") && !isIdentifierPart(code[i - 1] ?? "")) {
			result += " ";
			i++;
			const literal = maskString(code, i, true);
			result += literal.text;
			i = literal.next;
			continue;
		}

		// Strings (including interpolations).
		if (char === "'" || char === "\"") {
			const literal = maskString(code, i, false);
			result += literal.text;
			i = literal.next;
			continue;
		}

		if (stopAtBrace && char === "}" && braceDepth === 0)
			return { next: i, text: result };

		if (char === "{")
			braceDepth++;
		else if (char === "}")
			braceDepth = Math.max(0, braceDepth - 1);

		result += char;
		i++;
	}

	return { next: i, text: result };
}

/**
 * Masks a Dart string literal, keeping only interpolated expressions.
 */
function maskString(code: string, start: number, raw: boolean): MaskResult {
	const quote = code[start];
	const tripleQuoted = code[start + 1] === quote && code[start + 2] === quote;
	const quoteLength = tripleQuoted ? 3 : 1;
	const terminator = quote.repeat(quoteLength);

	let text = " ".repeat(quoteLength);
	let i = start + quoteLength;

	while (i < code.length) {
		const char = code[i];

		if (!raw && char === "\\" && i + 1 < code.length) {
			text += "  ";
			i += 2;
			continue;
		}

		if (code.startsWith(terminator, i)) {
			text += " ".repeat(quoteLength);
			i += quoteLength;
			break;
		}

		if (!raw && char === "$") {
			const next = code[i + 1] ?? "";

			// Braced interpolation: `${expression}`.
			if (next === "{") {
				const inner = maskCommentsAndLiteralStrings(code.substring(i + 2), true);
				const closeBrace = i + 2 + inner.next;
				text += "${" + inner.text + "}";
				i = closeBrace + 1;
				continue;
			}

			// Simple interpolation: `$identifier`.
			if (isIdentifierStart(next)) {
				let end = i + 2;
				while (end < code.length && isIdentifierPart(code[end]))
					end++;
				text += "$" + code.substring(i + 1, end);
				i = end;
				continue;
			}
		}

		text += char === "\n" ? "\n" : " ";
		i++;
	}

	return { next: i, text };
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
	const scanner = new DartCodeScanner(cleanFullCode);

	return variableNames.map((name) => {
		let foundType: string | undefined;

		// 1. Check for `var name = Constructor<...>(...)` or `final name = Constructor<...>(...)`.
		// Only treat the initialiser as a type when it actually looks like an
		// instantiation; otherwise `final item = entry.value` would wrongly
		// infer `entry` as the type.
		const initRegex = new RegExp(`\\b(?:var|final|late)\\s+\\b${escapeRegExp(name)}\\b\\s*=\\s*`, "g");
		let match: RegExpExecArray | null;
		while ((match = initRegex.exec(cleanScopeBefore)) !== null) {
			const rhsStart = match.index + match[0].length;
			const inferred = extractTypeAt(cleanScopeBefore, rhsStart);
			if (inferred && inferred !== "var" && inferred !== "final" && inferred !== "late" && looksLikeConstructorInitializer(cleanScopeBefore, rhsStart, inferred))
				foundType = inferred;
		}

		// 1b. Closure-local variables derived from a collection value/key:
		// `final item = entry.value;` where `entry` is a `MapEntry`.
		if (!foundType)
			foundType = inferDerivedLocalType(cleanScopeBefore, name);

		// 2. Getters: `bool get hasSelection => ...`.
		if (!foundType)
			foundType = findGetterType(cleanFullCode, name);

		// 3. Explicit field declarations, including primitives, generics and
		// function types: `final bool visible;`, `final void Function(String) onTap;`.
		if (!foundType)
			foundType = findDeclaredType(cleanFullCode, name);

		// 4. Methods and callbacks: `void select(int index) { ... }`.
		if (!foundType)
			foundType = findMethodType(cleanFullCode, name, scanner);

		// 5. Explicit type declaration with an uppercase type name.
		if (!foundType) {
			const declRegex = new RegExp(`\\b(?:final\\s+|const\\s+|late\\s+)?([A-Z][a-zA-Z0-9_]*)\\s*(?:<[^;=]+>)?\\s*\\??\\s+\\b${escapeRegExp(name)}\\b\\s*(?:[;=,)]|$)`, "g");
			while ((match = declRegex.exec(cleanScopeBefore)) !== null) {
				const matchStr = match[0];
				const typeOffsetInMatch = matchStr.search(/[A-Z]/);
				if (typeOffsetInMatch !== -1) {
					const typeStart = match.index + typeOffsetInMatch;
					const inferred = extractTypeAt(cleanScopeBefore, typeStart);
					if (inferred && inferred !== "final" && inferred !== "const" && inferred !== "late" && inferred !== "var")
						foundType = inferred;
				}
			}
		}

		// 6. Check for `Theme.of(context)`.
		if (!foundType) {
			const themeRegex = new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*Theme\\.of\\b`);
			if (themeRegex.test(cleanScopeBefore))
				foundType = "ThemeData";
		}

		// 7. Infer from usage in the extracted widget code.
		if (!foundType) {
			const boolRegex = new RegExp(`\\b${escapeRegExp(name)}\\s*\\?|\\b${escapeRegExp(name)}\\s*&&|\\b${escapeRegExp(name)}\\s*\\|\\||\\bif\\s*\\(\\s*!?\\s*${escapeRegExp(name)}\\b`);
			if (boolRegex.test(widgetCode))
				foundType = "bool";
		}

		if (!foundType) {
			const strCompareRegex = new RegExp(`\\b${escapeRegExp(name)}\\s*(?:==|!=)\\s*['"]|['"]\\s*(?:==|!=)\\s*\\b${escapeRegExp(name)}\\b`);
			if (strCompareRegex.test(widgetCode))
				foundType = "String";
		}

		if (!foundType) {
			const numRegex = new RegExp(`\\b${escapeRegExp(name)}\\s*[*+/-]\\s*\\d|\\b(?:width|height|size|radius|fontSize)\\s*:\\s*\\b${escapeRegExp(name)}\\b`);
			if (numRegex.test(widgetCode))
				foundType = "double";
		}

		if (!foundType) {
			const callRegex = new RegExp(`\\b${escapeRegExp(name)}\\s*\\(`);
			if (callRegex.test(widgetCode))
				foundType = "Widget Function()";
		}

		if (!foundType)
			foundType = "dynamic";

		return { name, type: foundType };
	});
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Finds an explicitly declared type for a field or variable, including
 * primitives and function types.
 */
function findDeclaredType(code: string, name: string): string | undefined {
	const escaped = escapeRegExp(name);

	// `final bool visible`, `final List<Record> items`, `final void Function(String) onTap`.
	const modifierRegex = new RegExp(`\\b(?:final|const|late|static)\\s+([A-Za-z_][A-Za-z0-9_<>,?()\\[\\]{}.\\s]*?)\\s+${escaped}\\b`, "g");
	let match: RegExpExecArray | null;
	while ((match = modifierRegex.exec(code)) !== null) {
		const type = normalizeTypeName(match[1]);
		if (type && !isTypeModifier(type))
			return type;
	}

	// Primitive instance fields without a modifier: `int selectedIndex = 0;`.
	const primitiveRegex = new RegExp(`(?:^|[;{}])\\s*((?:int|double|num|bool|String|Object|dynamic)\\??)\\s+${escaped}\\b`, "gm");
	while ((match = primitiveRegex.exec(code)) !== null)
		return match[1];

	// Non-final fields with a camel-cased type: `List<String> tags = [];`.
	const fieldRegex = new RegExp(`(?:^|[;{}])\\s*([A-Z][A-Za-z0-9_<>,?()\\[\\]{} .]*?)\\s+${escaped}\\s*(?:=|;)`, "gm");
	while ((match = fieldRegex.exec(code)) !== null) {
		const type = normalizeTypeName(match[1]);
		if (type && !isTypeModifier(type) && !/\b(?:get|set)$/.test(type))
			return type;
	}

	return undefined;
}

/**
 * Returns whether the initialiser at `start` really is an instantiation of
 * `type` (for example `Foo(...)`, `const Foo(...)` or `Foo.named(...)`).
 *
 * A plain reference such as `entry.value` or a comparison such as
 * `index == selectedIndex` must not be mistaken for a constructor call.
 */
function looksLikeConstructorInitializer(code: string, start: number, type: string): boolean {
	if (!/^[A-Z]/.test(type))
		return false;

	const typeIndex = code.indexOf(type, start);
	if (typeIndex === -1)
		return false;

	let i = typeIndex + type.length;
	while (i < code.length && /\s/.test(code[i]))
		i++;

	if (code[i] === "(")
		return true;

	// Named constructor or static member: `Foo.named(...)`.
	if (code[i] === ".") {
		i++;
		while (i < code.length && /\s/.test(code[i]))
			i++;
		if (!isIdentifierStart(code[i] ?? ""))
			return false;
		while (i < code.length && isIdentifierPart(code[i]))
			i++;
		while (i < code.length && /\s/.test(code[i]))
			i++;
		return code[i] === "(";
	}

	return false;
}

/**
 * Infers the type of a closure-local variable initialised from a collection
 * entry, for example `final item = entry.value;` where `entry` is a
 * `MapEntry<...>`. Also handles `.key` and explicit parameter types.
 */
function inferDerivedLocalType(code: string, name: string): string | undefined {
	const declRegex = new RegExp(`\\b(?:final|var|late)\\s+${escapeRegExp(name)}\\s*=\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*\\.\\s*(key|value)\\b`, "g");
	let match: RegExpExecArray | null;
	while ((match = declRegex.exec(code)) !== null) {
		const baseType = inferClosureParameterType(code, match[1]);
		if (!baseType)
			continue;

		const args = genericTypeArguments(baseType);
		if (args?.length !== 2 || !/^MapEntry\b/.test(baseType))
			continue;

		return match[2] === "key" ? args[0] : args[1];
	}
	return undefined;
}

/**
 * Infers the type of a closure parameter from its declaration or from the
 * collection it is iterating (`list.map((item) => ...)`,
 * `list.asMap().entries.map((entry) => ...)`).
 */
function inferClosureParameterType(code: string, paramName: string): string | undefined {
	const explicitType = findClosureParameterType(code, paramName);
	if (explicitType)
		return explicitType;

	const escaped = escapeRegExp(paramName);
	const receiver = "([A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)*)";

	// `list.asMap().entries.map((param) => ...)` iterates `MapEntry<int, T>`.
	let match = new RegExp(`\\b${receiver}\\s*\\.\\s*asMap\\s*\\(\\s*\\)\\s*\\.\\s*entries\\s*\\.\\s*map\\s*\\(\\s*\\(?\\s*${escaped}\\b`).exec(code);
	if (match) {
		const elementType = listElementType(resolveExpressionType(code, match[1]));
		if (elementType)
			return `MapEntry<int, ${elementType}>`;
	}

	// `map.entries.map((param) => ...)` iterates `MapEntry<K, V>`.
	match = new RegExp(`\\b${receiver}\\s*\\.\\s*entries\\s*\\.\\s*map\\s*\\(\\s*\\(?\\s*${escaped}\\b`).exec(code);
	if (match) {
		const mapType = resolveExpressionType(code, match[1]);
		const args = mapType ? genericTypeArguments(mapType) : undefined;
		if (mapType && args?.length === 2 && /^Map\b/.test(mapType))
			return `MapEntry<${args[0]}, ${args[1]}>`;
	}

	// `list.map((param) => ...)` iterates the list element type.
	match = new RegExp(`\\b${receiver}\\s*\\.\\s*map\\s*\\(\\s*\\(?\\s*${escaped}\\b`).exec(code);
	if (match) {
		const elementType = listElementType(resolveExpressionType(code, match[1]));
		if (elementType)
			return elementType;
	}

	return undefined;
}

/**
 * Finds an explicitly typed closure parameter such as
 * `(MapEntry<int, String> entry) { ... }`.
 */
function findClosureParameterType(code: string, paramName: string): string | undefined {
	const scanner = new DartCodeScanner(code);
	const paramRegex = new RegExp(`\\b${escapeRegExp(paramName)}\\b`, "g");
	let paramMatch: RegExpExecArray | null;
	while ((paramMatch = paramRegex.exec(code)) !== null) {
		let openParen = code.lastIndexOf("(", paramMatch.index);
		while (openParen !== -1) {
			const closeParen = scanner.findMatchingBracket(openParen);
			if (closeParen > paramMatch.index) {
				let after = closeParen + 1;
				while (after < code.length && /\s/.test(code[after]))
					after++;
				if (code[after] === "{" || code.startsWith("=>", after)) {
					const type = parameterTypeFromList(code.substring(openParen + 1, closeParen), paramName);
					if (type)
						return type;
					break;
				}
			}
			openParen = openParen > 0 ? code.lastIndexOf("(", openParen - 1) : -1;
		}
	}
	return undefined;
}

/**
 * Extracts the declared type of a single named parameter from a parameter list.
 */
function parameterTypeFromList(parameterList: string, paramName: string): string | undefined {
	for (const rawParameter of splitTopLevel(parameterList, ",")) {
		let parameter = rawParameter.trim();
		if (!parameter)
			continue;

		parameter = parameter.replace(/^[{[]\s*/, "").replace(/\s*[}\]]$/, "").trim();
		parameter = parameter.replace(/@[A-Za-z_][A-Za-z0-9_]*(?:\([^)]*\))?\s*/g, "");
		parameter = parameter.replace(/^(?:required|covariant|final|const)\s+/, "");
		parameter = parameter.split("=")[0].trim();
		if (!parameter)
			continue;

		const parts = /^(.*\S)\s+([A-Za-z_][A-Za-z0-9_]*)$/.exec(parameter);
		if (parts?.[2] !== paramName)
			continue;

		const type = normalizeTypeName(parts[1]);
		if (type && !isTypeModifier(type))
			return type;
	}
	return undefined;
}

/**
 * Resolves the declared type of an identifier or simple property chain.
 */
function resolveExpressionType(code: string, expression: string): string | undefined {
	const parts = expression.split(".");
	const name = parts[parts.length - 1];
	return findGetterType(code, name) ?? findDeclaredType(code, name);
}

/**
 * Returns the element type of a list-like type such as `List<T>` or `Set<T>`.
 */
function listElementType(type: string | undefined): string | undefined {
	if (!type)
		return undefined;
	const args = genericTypeArguments(type);
	if (args?.length !== 1)
		return undefined;
	return /^(?:List|Iterable|Set|Queue|LinkedList|UnmodifiableListView)\b/.test(type) ? args[0] : undefined;
}

/**
 * Splits the outer type arguments of a generic type, preserving nested types.
 */
function genericTypeArguments(type: string): string[] | undefined {
	const start = type.indexOf("<");
	if (start === -1 || !type.endsWith(">"))
		return undefined;

	const args = splitTopLevel(type.substring(start + 1, type.length - 1), ",")
		.map((arg) => arg.trim())
		.filter((arg) => arg.length > 0);
	return args.length > 0 ? args : undefined;
}

/**
 * Finds the declared return type of a getter.
 */
function findGetterType(code: string, name: string): string | undefined {
	const getterRegex = new RegExp(`\\bget\\s+${escapeRegExp(name)}\\b`, "g");
	let match: RegExpExecArray | null;
	while ((match = getterRegex.exec(code)) !== null) {
		let prefix = code.substring(code.lastIndexOf("\n", match.index) + 1, match.index).trim();
		prefix = prefix.replace(/@[A-Za-z_][A-Za-z0-9_]*(?:\([^)]*\))?\s*/g, "");
		prefix = stripTypeModifiers(prefix);
		const type = extractTypeAt(prefix, 0);
		if (type && !isTypeModifier(type))
			return normalizeTypeName(type);
	}
	return undefined;
}

/**
 * Finds a method declaration and turns it into a function type.
 *
 * `void select(int index) { ... }` becomes `void Function(int)`.
 */
function findMethodType(code: string, name: string, scanner: DartCodeScanner): string | undefined {
	const methodRegex = new RegExp(`\\b${escapeRegExp(name)}\\s*\\(`, "g");
	let match: RegExpExecArray | null;
	while ((match = methodRegex.exec(code)) !== null) {
		const openParen = code.indexOf("(", match.index);
		if (openParen === -1)
			continue;
		const closeParen = scanner.findMatchingBracket(openParen);
		if (closeParen === -1)
			continue;

		// Methods are followed by a body or expression body, calls are not.
		let afterParams = closeParen + 1;
		while (afterParams < code.length && /\s/.test(code[afterParams]))
			afterParams++;
		if (code.startsWith("async", afterParams)) {
			afterParams += "async".length;
			while (afterParams < code.length && /\s/.test(code[afterParams]))
				afterParams++;
		}
		if (code[afterParams] !== "{" && !code.startsWith("=>", afterParams))
			continue;

		let prefix = code.substring(code.lastIndexOf("\n", match.index) + 1, match.index).trim();
		prefix = prefix.replace(/@[A-Za-z_][A-Za-z0-9_]*(?:\([^)]*\))?\s*/g, "");
		prefix = stripTypeModifiers(prefix);
		const returnType = extractTypeAt(prefix, 0);
		if (!returnType || isTypeModifier(returnType) || returnType === "return" || returnType === "await")
			continue;

		const parameters = formatParameterList(code.substring(openParen + 1, closeParen));
		if (parameters)
			return `${returnType} Function(${parameters})`;
		return returnType === "void" ? "VoidCallback" : `${returnType} Function()`;
	}
	return undefined;
}

/**
 * Formats a Dart parameter list as a function type parameter list, keeping the
 * distinction between positional, optional positional and named parameters.
 */
function formatParameterList(parameters: string): string {
	const positional: string[] = [];
	const named: string[] = [];
	const optionalPositional: string[] = [];
	let group: "positional" | "named" | "optional" = "positional";

	for (const rawParameter of splitTopLevel(parameters.trim(), ",")) {
		let parameter = rawParameter.trim();
		if (!parameter)
			continue;

		if (parameter.startsWith("{"))
			group = "named";
		else if (parameter.startsWith("["))
			group = "optional";
		parameter = parameter.replace(/^[{[]\s*/, "").replace(/\s*[}\]]$/, "").trim();
		if (!parameter)
			continue;

		parameter = parameter.replace(/@[A-Za-z_][A-Za-z0-9_]*(?:\([^)]*\))?\s*/g, "");
		parameter = parameter.replace(/^(?:covariant|final|const)\s+/, "");

		let required = false;
		if (parameter.startsWith("required ")) {
			required = true;
			parameter = parameter.substring("required ".length).trim();
		}

		parameter = parameter.split("=")[0].trim();
		if (!parameter)
			continue;

		let type = "dynamic";
		let parameterName = "";
		if (parameter.startsWith("this.")) {
			parameterName = parameter.substring("this.".length).trim();
		} else {
			const parts = /^(.*\S)\s+([A-Za-z_][A-Za-z0-9_]*)$/.exec(parameter);
			if (parts?.[1].trim()) {
				type = normalizeTypeName(parts[1]);
				parameterName = parts[2];
			} else {
				type = normalizeTypeName(parameter);
			}
		}

		const signature = type === "dynamic" ? parameterName || "dynamic" : type;
		if (group === "named")
			named.push(`${required ? "required " : ""}${signature}${parameterName && type !== "dynamic" ? ` ${parameterName}` : ""}`);
		else if (group === "optional")
			optionalPositional.push(`${signature}${parameterName && type !== "dynamic" ? ` ${parameterName}` : ""}`);
		else
			positional.push(signature);
	}

	const sections = [...positional];
	if (named.length > 0)
		sections.push(`{${named.join(", ")}}`);
	if (optionalPositional.length > 0)
		sections.push(`[${optionalPositional.join(", ")}]`);
	return sections.join(", ");
}

function splitTopLevel(value: string, separator: string): string[] {
	const parts: string[] = [];
	let current = "";
	let depth = 0;
	for (const char of value) {
		if (char === "<" || char === "(" || char === "[" || char === "{")
			depth++;
		else if (char === ">" || char === ")" || char === "]" || char === "}")
			depth = Math.max(0, depth - 1);
		if (char === separator && depth === 0) {
			parts.push(current);
			current = "";
		} else {
			current += char;
		}
	}
	parts.push(current);
	return parts;
}

function stripTypeModifiers(prefix: string): string {
	let result = prefix.trim();
	while (/^(?:static|external|late|final|const|abstract|factory)\b\s*/.test(result))
		result = result.replace(/^(?:static|external|late|final|const|abstract|factory)\b\s*/, "");
	return result;
}

function isTypeModifier(type: string): boolean {
	return /^(?:static|external|late|final|const|abstract|factory|var|required|covariant|this|return|await)$/.test(type);
}

function normalizeTypeName(type: string): string {
	return type.replace(/\s+/g, " ").trim();
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
	const widgetMembers = extractWidgetMemberNames(widgetCode);

	// Normalize private names (leading underscores) to public names for extracted widget params/fields
	const normalizeName = (name: string): string => {
		if (name.startsWith("_")) {
			const stripped = name.replace(/^_+/, "");
			if (!stripped) return name;
			return stripped[0].toLowerCase() + stripped.slice(1);
		}
		return name;
	};

	// Replace usages of private variables in the widget body with their normalized names,
	// including usages inside string interpolations (e.g. `'$_online'`).
	// References to `widget.<member>` are replaced with the extracted field.
	let bodyCode = widgetCode;
	for (const v of variables) {
		const normalized = normalizeName(v.name);
		const widgetMember = widgetMembers.has(v.name) ? v.name : undefined;
		if (normalized !== v.name || widgetMember)
			bodyCode = renameVariableUsages(bodyCode, v.name, normalized, widgetMember);
	}

	let usageText: string;
	if (variables.length > 0) {
		const args = variables
			.map((v) => {
				const value = widgetMembers.has(v.name) ? `widget.${v.name}` : v.name;
				return `${normalizeName(v.name)}: ${value}`;
			})
			.join(", ");
		usageText = `${newWidgetName}(${args})`;
	} else {
		usageText = `const ${newWidgetName}()`;
	}

	const indentedBody = bodyCode.split("\n").map((line, idx) => {
		if (idx === 0) return line;
		return "    " + line;
	}).join("\n");

	let classText: string;
	if (variables.length > 0) {
		const constructorParams = variables.map((v) => `    required this.${normalizeName(v.name)},`).join("\n");
		const fieldDeclarations = variables.map((v) => `  final ${v.type} ${normalizeName(v.name)};`).join("\n");

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

/**
 * Returns the names of properties accessed through `widget.` in the snippet.
 */
function extractWidgetMemberNames(code: string): Set<string> {
	const members = new Set<string>();
	const cleanCode = stripCommentsAndStrings(code);
	const regex = /\bwidget\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)/g;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(cleanCode)) !== null)
		members.add(match[1]);
	return members;
}

/**
 * Renames whole-word usages of an identifier in Dart code.
 *
 * Unlike a plain regular expression this skips comments and string literals,
 * but still renames identifiers used in string interpolations such as
 * `'$_online'` and `'${_online!.name}'`. When `widgetMember` is supplied,
 * `widget.<member>` is replaced with `newName` as well.
 */
function renameVariableUsages(code: string, oldName: string, newName: string, widgetMember?: string): string {
	return renameInCode(code, oldName, newName, false, widgetMember).text;
}

interface RenameResult {
	text: string;
	next: number;
}

function renameInCode(code: string, oldName: string, newName: string, stopAtBrace: boolean, widgetMember?: string): RenameResult {
	let result = "";
	let braceDepth = 0;
	let i = 0;

	while (i < code.length) {
		const char = code[i];
		const next = i + 1 < code.length ? code[i + 1] : "";

		// Single line comment.
		if (char === "/" && next === "/") {
			const end = code.indexOf("\n", i);
			const stop = end === -1 ? code.length : end;
			result += code.substring(i, stop);
			i = stop;
			continue;
		}

		// Block comment.
		if (char === "/" && next === "*") {
			const end = code.indexOf("*/", i + 2);
			const stop = end === -1 ? code.length : end + 2;
			result += code.substring(i, stop);
			i = stop;
			continue;
		}

		// Raw strings do not interpolate.
		if (char === "r" && (next === "'" || next === "\"") && !isIdentifierPart(code[i - 1] ?? "")) {
			const literal = readString(code, i + 1, true, oldName, newName, widgetMember);
			result += "r" + literal.text;
			i = literal.next;
			continue;
		}

		// Strings (including interpolations).
		if (char === "'" || char === "\"") {
			const literal = readString(code, i, false, oldName, newName, widgetMember);
			result += literal.text;
			i = literal.next;
			continue;
		}

		// End of a `${...}` interpolation expression.
		if (stopAtBrace && char === "}" && braceDepth === 0)
			return { next: i, text: result };

		if (char === "{")
			braceDepth++;
		else if (char === "}")
			braceDepth = Math.max(0, braceDepth - 1);

		// Identifiers.
		if (isIdentifierStart(char)) {
			let end = i + 1;
			while (end < code.length && isIdentifierPart(code[end]))
				end++;
			const identifier = code.substring(i, end);

			// `widget.<member>` is replaced with the extracted widget field.
			if (widgetMember && identifier === "widget" && end < code.length && code[end] === ".") {
				const memberStart = end + 1;
				let memberEnd = memberStart;
				while (memberEnd < code.length && isIdentifierPart(code[memberEnd]))
					memberEnd++;
				if (code.substring(memberStart, memberEnd) === widgetMember) {
					result += newName;
					i = memberEnd;
					continue;
				}
			}

			// Skip property accesses (`object._online`) but keep spread usages (`..._online`).
			let prev = i - 1;
			while (prev >= 0 && (code[prev] === " " || code[prev] === "\t"))
				prev--;
			const isPropertyAccess = prev >= 0 && code[prev] === ".";
			const isSpread = prev >= 2 && code[prev] === "." && code[prev - 1] === "." && code[prev - 2] === ".";

			result += identifier === oldName && (!isPropertyAccess || isSpread) ? newName : identifier;
			i = end;
			continue;
		}

		result += char;
		i++;
	}

	return { next: i, text: result };
}

/**
 * Reads a Dart string literal starting at `start` (the opening quote).
 * Interpolated expressions are recursively renamed when `oldName` is supplied.
 */
function readString(
	code: string,
	start: number,
	raw: boolean,
	oldName: string,
	newName: string,
	widgetMember?: string,
): RenameResult {
	const quote = code[start];
	const tripleQuoted = code[start + 1] === quote && code[start + 2] === quote;
	const quoteLength = tripleQuoted ? 3 : 1;
	const terminator = quote.repeat(quoteLength);

	let result = terminator;
	let i = start + quoteLength;

	while (i < code.length) {
		const char = code[i];

		if (!raw && char === "\\" && i + 1 < code.length) {
			result += code.substring(i, i + 2);
			i += 2;
			continue;
		}

		if (code.startsWith(terminator, i)) {
			result += terminator;
			i += quoteLength;
			break;
		}

		if (!raw && char === "$") {
			const next = code[i + 1] ?? "";

			// Braced interpolation: `${expression}`.
			if (next === "{") {
				const inner = renameInCode(code.substring(i + 2), oldName, newName, true, widgetMember);
				const closeBrace = i + 2 + inner.next;
				result += "${" + inner.text + "}";
				i = closeBrace + 1;
				continue;
			}

			// Simple interpolation: `$identifier`.
			if (isIdentifierStart(next)) {
				let end = i + 2;
				while (end < code.length && isIdentifierPart(code[end]))
					end++;
				const identifier = code.substring(i + 1, end);
				result += "$" + (identifier === oldName ? newName : identifier);
				i = end;
				continue;
			}
		}

		result += char;
		i++;
	}

	return { next: i, text: result };
}

function isIdentifierStart(char: string): boolean {
	return /[A-Za-z_]/.test(char);
}

function isIdentifierPart(char: string): boolean {
	return /[A-Za-z0-9_]/.test(char);
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
