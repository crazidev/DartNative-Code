import { strict as assert } from "assert";
import {
	DartCodeScanner,
	escapeSnippet,
	generateSingleWidgetWrapSnippet,
	getAvailableRefactorActions,
} from "../../extension/refactors/widget_refactor_core";

describe("Widget Refactor Core Engine", () => {
	describe("DartCodeScanner", () => {
		it("correctly matches parentheses and brackets ignoring strings and comments", () => {
			const code = "Container(child: Text('Hello (world) // not comment', key: Key(\"k/*\")));";
			const scanner = new DartCodeScanner(code);
			const openIndex = code.indexOf("(");
			const closeIndex = scanner.findMatchingBracket(openIndex);
			assert.equal(closeIndex, code.length - 2); // before trailing semicolon
		});

		it("finds all widget expressions in code", () => {
			const code = `
				Widget build(BuildContext context) {
					return Container(
						child: Center(
							child: Text('Hello'),
						),
					);
				}
			`;
			const scanner = new DartCodeScanner(code);
			const widgets = scanner.findAllWidgetExpressions();
			const names = widgets.map((w) => w.name);
			assert.ok(names.includes("Container"));
			assert.ok(names.includes("Center"));
			assert.ok(names.includes("Text"));
		});

		it("finds innermost enclosing widget for cursor offset", () => {
			const code = `
				Widget build(BuildContext context) {
					return Container(
						child: Center(
							child: Text('Hello'),
						),
					);
				}
			`;
			const scanner = new DartCodeScanner(code);
			const textOffset = code.indexOf("Text('Hello')") + 2;
			const innermost = scanner.findEnclosingWidget(textOffset);
			assert.equal(innermost?.name, "Text");

			const centerOffset = code.indexOf("Center(") + 2;
			const centerWidget = scanner.findEnclosingWidget(centerOffset);
			assert.equal(centerWidget?.name, "Center");
		});
	});

	describe("Single Widget Refactorings", () => {
		const sampleCode = `
Widget build(BuildContext context) {
  return Text('Hello World');
}
`;

		it("provides single widget refactoring actions", () => {
			const offset = sampleCode.indexOf("Text");
			const actions = getAvailableRefactorActions(sampleCode, offset);
			const titles = actions.map((a) => a.title);

			assert.ok(titles.includes("Wrap with widget..."));
			assert.ok(titles.includes("Wrap with Padding"));
			assert.ok(titles.includes("Wrap with Container"));
			assert.ok(titles.includes("Wrap with Center"));
			assert.ok(titles.includes("Wrap with Column"));
			assert.ok(titles.includes("Wrap with Row"));
			assert.ok(titles.includes("Wrap with SizedBox"));
			assert.ok(titles.includes("Wrap with Expanded"));
			assert.ok(titles.includes("Remove this widget"));
		});

		it("correctly generates Wrap with widget... including placeholder snippetText for naming", () => {
			const offset = sampleCode.indexOf("Text");
			const actions = getAvailableRefactorActions(sampleCode, offset);
			const widgetAction = actions.find((a) => a.title === "Wrap with widget...");
			assert.ok(widgetAction !== undefined);

			assert.ok(widgetAction?.newText.includes("widget("));
			assert.ok(widgetAction?.newText.includes("child: Text('Hello World')"));
			assert.equal(widgetAction?.snippetText, "widget(\n    child: Text('Hello World'),\n  )".replace("widget(", "${1:widget}("));

			const directSnippet = generateSingleWidgetWrapSnippet(sampleCode, { end: offset + 19, start: offset }, "widget");
			assert.ok(directSnippet.startsWith("${1:widget}("));
		});

		it("correctly escapes snippet characters like $ and } in Wrap with widget... snippetText", () => {
			assert.equal(escapeSnippet("Hello $name and ${item.id}"), "Hello \\$name and \\${item.id\\}");

			const codeWithInterpolation = `
Widget build(BuildContext context) {
  return Text('Count: \${item.count}, $label');
}
`;
			const offset = codeWithInterpolation.indexOf("Text");
			const actions = getAvailableRefactorActions(codeWithInterpolation, offset);
			const widgetAction = actions.find((a) => a.title === "Wrap with widget...");
			assert.ok(widgetAction !== undefined);

			assert.ok(widgetAction?.snippetText?.includes("${1:widget}("));
			assert.ok(widgetAction?.snippetText?.includes("Text('Count: \\${item.count\\}, \\$label')"));
		});

		it("correctly generates Wrap with Padding", () => {
			const offset = sampleCode.indexOf("Text");
			const actions = getAvailableRefactorActions(sampleCode, offset);
			const paddingAction = actions.find((a) => a.title === "Wrap with Padding");
			assert.ok(paddingAction !== undefined);

			assert.ok(paddingAction?.newText.includes("Padding("));
			assert.ok(paddingAction?.newText.includes("padding: const EdgeInsets.all(8.0)"));
			assert.ok(paddingAction?.newText.includes("child: Text('Hello World')"));
		});

		it("correctly generates Wrap with Container", () => {
			const offset = sampleCode.indexOf("Text");
			const actions = getAvailableRefactorActions(sampleCode, offset);
			const containerAction = actions.find((a) => a.title === "Wrap with Container");
			assert.ok(containerAction !== undefined);

			assert.ok(containerAction?.newText.includes("Container("));
			assert.ok(containerAction?.newText.includes("child: Text('Hello World')"));
		});

		it("correctly generates Wrap with Center", () => {
			const offset = sampleCode.indexOf("Text");
			const actions = getAvailableRefactorActions(sampleCode, offset);
			const centerAction = actions.find((a) => a.title === "Wrap with Center");
			assert.ok(centerAction !== undefined);

			assert.ok(centerAction?.newText.includes("Center("));
			assert.ok(centerAction?.newText.includes("child: Text('Hello World')"));
		});

		it("correctly generates Wrap with Column for a single widget", () => {
			const offset = sampleCode.indexOf("Text");
			const actions = getAvailableRefactorActions(sampleCode, offset);
			const colAction = actions.find((a) => a.title === "Wrap with Column");
			assert.ok(colAction !== undefined);

			assert.ok(colAction?.newText.includes("Column("));
			assert.ok(colAction?.newText.includes("children: ["));
			assert.ok(colAction?.newText.includes("Text('Hello World')"));
		});

		it("correctly generates Wrap with Row for a single widget", () => {
			const offset = sampleCode.indexOf("Text");
			const actions = getAvailableRefactorActions(sampleCode, offset);
			const rowAction = actions.find((a) => a.title === "Wrap with Row");
			assert.ok(rowAction !== undefined);

			assert.ok(rowAction?.newText.includes("Row("));
			assert.ok(rowAction?.newText.includes("children: ["));
			assert.ok(rowAction?.newText.includes("Text('Hello World')"));
		});

		it("correctly un-nests child when removing widget with child", () => {
			const code = `
Widget build(BuildContext context) {
  return Center(
    child: Text('Inner Content'),
  );
}
`;
			const offset = code.indexOf("Center");
			const actions = getAvailableRefactorActions(code, offset);
			const removeAction = actions.find((a) => a.title === "Remove this widget");
			assert.ok(removeAction !== undefined);
			assert.equal(removeAction?.newText.trim(), "Text('Inner Content')");
		});
	});

	describe("Multi-Widget Selection in children: [...]", () => {
		const listCode = `
Widget build(BuildContext context) {
  return Column(
    children: [
      Text('Item 1'),
      Text('Item 2'),
      Text('Item 3'),
    ],
  );
}
`;

		it("ONLY suggests Wrap with Row, Wrap with Column, and Remove widgets when multiple widgets are selected", () => {
			const start = listCode.indexOf("Text('Item 1')");
			const end = listCode.indexOf("Text('Item 2')") + "Text('Item 2')".length;

			const actions = getAvailableRefactorActions(listCode, start, end);
			const titles = actions.map((a) => a.title);

			// Strict assertion: exactly these 3 actions
			assert.deepEqual(titles, [
				"Wrap with Column",
				"Wrap with Row",
				"Remove widgets",
			]);

			// Single-widget wraps must NOT be present
			assert.ok(!titles.includes("Wrap with Padding"));
			assert.ok(!titles.includes("Wrap with Container"));
			assert.ok(!titles.includes("Wrap with Center"));
			assert.ok(!titles.includes("Wrap with widget..."));
			assert.ok(!titles.includes("Remove this widget"));
		});

		it("correctly generates multi-widget Wrap with Row", () => {
			const start = listCode.indexOf("Text('Item 1')");
			const end = listCode.indexOf("Text('Item 2')") + "Text('Item 2')".length;

			const actions = getAvailableRefactorActions(listCode, start, end);
			const rowAction = actions.find((a) => a.title === "Wrap with Row");
			assert.ok(rowAction !== undefined);

			assert.ok(rowAction?.newText.includes("Row("));
			assert.ok(rowAction?.newText.includes("children: ["));
			assert.ok(rowAction?.newText.includes("Text('Item 1')"));
			assert.ok(rowAction?.newText.includes("Text('Item 2')"));
		});

		it("correctly preserves relative internal indentation of nested expressions in multi-widget Wrap with Row", () => {
			const complexListCode = `
Widget build(BuildContext context) {
  return Column(
    children: [
      Icon(
        isSelected
            ? CupertinoIcons.checkmark_circle_fill
            : CupertinoIcons.circle,
        color: isSelected ? const Color(0xFF5856D6) : Colors.white38,
        size: 20,
      ),
      const SizedBox(width: 12),
    ],
  );
}
`;
			const start = complexListCode.indexOf("Icon(");
			const end = complexListCode.indexOf("const SizedBox(width: 12)") + "const SizedBox(width: 12)".length;

			const actions = getAvailableRefactorActions(complexListCode, start, end);
			const rowAction = actions.find((a) => a.title === "Wrap with Row");
			assert.ok(rowAction !== undefined);

			// Assert that ternary ? and : are indented properly relative to isSelected
			assert.ok(rowAction?.newText.includes("          Icon(\n            isSelected\n                ? CupertinoIcons.checkmark_circle_fill\n                : CupertinoIcons.circle,\n            color: isSelected ? const Color(0xFF5856D6) : Colors.white38,\n            size: 20,\n          ),"));
			assert.ok(rowAction?.newText.includes("          const SizedBox(width: 12),"));
		});
	});

	describe("Extract Widget", () => {
		it("extracts widget and passes constructor variables with inferred types", () => {
			const sample = `
class MyWidget extends StatelessWidget {
  final double size;
  final ThemeData theme;
  final String kind;

  const MyWidget({super.key, required this.size, required this.theme, required this.kind});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: theme.colorScheme.foreground.withOpacity(0.06),
        shape: BoxShape.circle,
        border: Border.all(color: theme.colorScheme.border),
      ),
      child: Center(
        child: Icon(
          kind == 'input'
              ? LucideIcons.user
              : kind == 'media'
                  ? LucideIcons.image
                  : LucideIcons.scanFace,
          size: size * 0.45,
          color: theme.colorScheme.foreground.withOpacity(0.4),
        ),
      ),
    );
  }
}
`;

			const offset = sample.indexOf("Container(");
			const actions = getAvailableRefactorActions(sample, offset);
			const extractAction = actions.find((a) => a.title === "Extract Widget");
			assert.ok(extractAction !== undefined);

			// Check replacement call passes the variables
			assert.ok(extractAction?.newText.includes("NewWidget("));
			assert.ok(extractAction?.newText.includes("size: size"));
			assert.ok(extractAction?.newText.includes("theme: theme"));
			assert.ok(extractAction?.newText.includes("kind: kind"));

			// Check appended class definition has constructor fields and types
			const appended = extractAction?.appendText ?? "";
			assert.ok(appended.includes("class NewWidget extends StatelessWidget {"));
			assert.ok(appended.includes("final double size;"));
			assert.ok(appended.includes("final ThemeData theme;"));
			assert.ok(appended.includes("final String kind;"));
			assert.ok(appended.includes("required this.size,"));
			assert.ok(appended.includes("required this.theme,"));
			assert.ok(appended.includes("required this.kind,"));
			assert.ok(appended.includes("return Container("));
		});

		it("extracts simple widget with const constructor when no free variables exist", () => {
			const simple = `
Widget build(BuildContext context) {
  return Text('Static Text');
}
`;
			const offset = simple.indexOf("Text(");
			const actions = getAvailableRefactorActions(simple, offset);
			const extractAction = actions.find((a) => a.title === "Extract Widget");
			assert.ok(extractAction !== undefined);

			assert.equal(extractAction?.newText, "const NewWidget()");
			assert.ok(extractAction?.appendText?.includes("class NewWidget extends StatelessWidget {"));
			assert.ok(extractAction?.appendText?.includes("const NewWidget({super.key});"));
		});

		it("correctly extracts complex generics, records, and method types ignoring comments", () => {
			const complexScope = `
class TestScreen extends StatelessWidget {
  // Dynamically expands or collapses size on state
  final bool isSelected = true;

  @override
  Widget build(BuildContext context) {
    var state = CustomState<State<T>>(isSelected: true, name: "Unknown");
    var recordState = CustomState<(String name, bool isSelected)>(isSelected: true, name: "Rec");

    return Row(
      children: [
        Icon(
          state.isSelected
              ? CupertinoIcons.checkmark_circle_fill
              : CupertinoIcons.circle,
          color: isSelected ? const Color(0xFF5856D6) : Colors.white38,
          size: 20,
        ),
        const SizedBox(width: 12),
        expanded(),
      ],
    );
  }

  Expanded expanded() {
    return Expanded(child: Container());
  }
}
`;

			const offset = complexScope.indexOf("Row(");
			const actions = getAvailableRefactorActions(complexScope, offset);
			const extractAction = actions.find((a) => a.title === "Extract Widget");
			assert.ok(extractAction !== undefined);
			assert.equal(extractAction?.kind, "refactor.extract");

			const appended = extractAction?.appendText ?? "";
			assert.ok(appended.includes("final CustomState<State<T>> state;"));
			assert.ok(appended.includes("final bool isSelected;"));
			assert.ok(appended.includes("final Expanded Function() expanded;"));
			assert.ok(!appended.includes("Dynamically expands"));
		});

		it("does not extract closure or builder parameters as free variables", () => {
			const listSnippet = `
class ListScreen extends StatelessWidget {
  final String title = "Items";

  @override
  Widget build(BuildContext context) {
    return FastList(
      itemCount: 100,
      itemBuilder: (context, index) {
        return Container(
          child: Text("$title: Row $index"),
        );
      },
    );
  }
}
`;
			const offset = listSnippet.indexOf("FastList(");
			const actions = getAvailableRefactorActions(listSnippet, offset);
			const extractAction = actions.find((a) => a.title === "Extract Widget");
			assert.ok(extractAction !== undefined);

			// Should only extract 'title', NOT 'context' or 'index'
			assert.ok(extractAction?.newText.includes("title: title"));
			assert.ok(!extractAction?.newText.includes("index:"));
			assert.ok(!extractAction?.newText.includes("context:"));

			const appended = extractAction?.appendText ?? "";
			assert.ok(appended.includes("final String title;"));
			assert.ok(!appended.includes("final dynamic index;"));
			assert.ok(!appended.includes("final dynamic context;"));
		});

		it("infers closure-local MapEntry values instead of treating identifiers as types", () => {
			const code = `
class ItemList extends StatefulWidget {}
class _ItemListState extends State<ItemList> {
  final List<({String name, bool active})> _items = [];

  List<({String name, bool active})> get _filteredItems => _items;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        ..._filteredItems.asMap().entries.map((entry) {
          final index = entry.key;
          final item = entry.value;
          final selected = index == 0;
          return Row(
            children: [
              Expanded(
                child: Text(
                  '\${item.name} (\${item.active ? 'active' : 'paused'})',
                  style: TextStyle(
                    fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                  ),
                ),
              ),
            ],
          );
        }),
      ],
    );
  }
}
`;
			const offset = code.indexOf("Expanded(");
			const actions = getAvailableRefactorActions(code, offset);
			const extractAction = actions.find((a) => a.title === "Extract Widget");
			assert.ok(extractAction !== undefined);

			const appended = extractAction.appendText ?? "";
			assert.ok(appended.includes("final ({String name, bool active}) item;"));
			assert.ok(appended.includes("final bool selected;"));
			assert.ok(!appended.includes("final entry item;"));
			assert.ok(!appended.includes("final index selected;"));

			assert.ok(extractAction?.newText.includes("item: item"));
			assert.ok(extractAction?.newText.includes("selected: selected"));
		});
	});

	describe("Extract Widget: private members, strings and complex trees", () => {
		it("renames private members inside string interpolation and spread usages", () => {
			const code = `
class Demo extends StatefulWidget {}
class _DemoState extends State<Demo> {
  String? _online;
  final List<String> _log = [];

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text('state: $_online'),
        Text('nested: \${_online ?? "offline"}'),
        Text("literal _online"),
        ..._log.map((entry) => Text(entry)),
      ],
    );
  }
}
`;
			const offset = code.indexOf("Column(");
			const actions = getAvailableRefactorActions(code, offset);
			const extractAction = actions.find((a) => a.title === "Extract Widget");
			assert.ok(extractAction !== undefined);

			assert.ok(extractAction?.newText.includes("online: _online"));
			assert.ok(extractAction?.newText.includes("log: _log"));
			assert.equal(extractAction?.newText.includes("entry:"), false);

			const appended = extractAction?.appendText ?? "";
			assert.ok(appended.includes("final String? online;"));
			assert.ok(appended.includes("final List<String> log;"));
			assert.ok(appended.includes("'state: $online'"));
			assert.ok(appended.includes("'nested: ${online ?? \"offline\"}'"));
			assert.ok(appended.includes('Text("literal _online")'));
			assert.ok(appended.includes("...log.map("));
		});

		it("finds private widgets as the extraction target", () => {
			const code = `
class Demo extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        const _Section('Title'),
        _Value('label', 'value'),
      ],
    );
  }
}
class _Section extends StatelessWidget {
  const _Section(this.title);
  final String title;
  @override
  Widget build(BuildContext context) => Text(title);
}
class _Value extends StatelessWidget {
  const _Value(this.label, this.value);
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Text(label);
}
`;
			const scanner = new DartCodeScanner(code);
			const target = scanner.findEnclosingWidget(code.indexOf("_Value(") + 2);
			assert.equal(target?.name, "_Value");

			const actions = getAvailableRefactorActions(code, code.indexOf("_Value(") + 2);
			const extractAction = actions.find((a) => a.title === "Extract Widget");
			assert.ok(extractAction !== undefined);
			assert.ok(extractAction?.appendText?.includes("return _Value("));
		});

		it("extracts complex if/else trees with getters, methods and records", () => {
			const code = `
class Complex extends StatefulWidget {}
class _ComplexState extends State<Complex> {
  final List<({String name, bool active})> _items = [];
  final String _query = '';
  bool _showDetails = true;
  int _selectedIndex = 0;

  bool get _hasSelection => _selectedIndex >= 0;
  bool get _hasVisibleItems => _items.isNotEmpty;
  List<({String name, bool active})> get _filteredItems => _items;

  void _select(int index) {
    setState(() => _selectedIndex = index);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: _hasSelection ? Colors.white : Colors.grey,
      child: Column(
        children: [
          Text('Index: $_selectedIndex'),
          if (_hasVisibleItems)
            Text('Filtering: $_query')
          else
            const Text('No matches'),
          if (_showDetails && _hasSelection)
            Button(
              title: 'Select',
              onPressed: () => _select(0),
            )
          else
            const SizedBox.shrink(),
          ..._filteredItems.map((item) {
            final selected = item.active;
            return Text('\${item.name}: $_query', key: Key(selected ? 'a' : 'b'));
          }),
        ],
      ),
    );
  }
}
`;
			const offset = code.indexOf("Container(");
			const actions = getAvailableRefactorActions(code, offset);
			const extractAction = actions.find((a) => a.title === "Extract Widget");
			assert.ok(extractAction !== undefined);

			const appended = extractAction?.appendText ?? "";
			assert.ok(appended.includes("final bool hasSelection;"));
			assert.ok(appended.includes("final bool hasVisibleItems;"));
			assert.ok(appended.includes("final bool showDetails;"));
			assert.ok(appended.includes("final int selectedIndex;"));
			assert.ok(appended.includes("final String query;"));
			assert.ok(appended.includes("final List<({String name, bool active})> filteredItems;"));
			assert.ok(appended.includes("final void Function(int) select;"));
			assert.ok(appended.includes("if (hasVisibleItems)"));
			assert.ok(appended.includes("else"));
			assert.ok(appended.includes("...filteredItems.map("));
			assert.ok(appended.includes("item.active"));
			assert.ok(!appended.includes("final dynamic"));
			assert.ok(!appended.includes("final VoidCallback select;"));
		});

		it("extracts State fields referenced through widget. and complex callbacks", () => {
			const code = `
class CallbackPanel extends StatefulWidget {
  const CallbackPanel({
    super.key,
    required this.title,
    required this.onSelected,
    this.enabled = true,
    this.trailing,
  });

  final String title;
  final void Function(String value) onSelected;
  final bool enabled;
  final Widget? trailing;

  @override
  State<CallbackPanel> createState() => _CallbackPanelState();
}

class _CallbackPanelState extends State<CallbackPanel> {
  bool _expanded = false;

  void _handleSelect(String value, {bool notify = true}) {
    widget.onSelected(value);
    if (notify) setState(() => _expanded = true);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      child: Column(
        children: [
          Text(widget.title),
          if (widget.trailing != null) widget.trailing! else const SizedBox.shrink(),
          if (widget.enabled)
            Button(
              title: _expanded ? 'Collapse' : 'Expand',
              onPressed: () => _handleSelect(widget.title),
            )
          else
            const Text('Disabled'),
        ],
      ),
    );
  }
}
`;
			const offset = code.indexOf("return Container(") + "return ".length;
			const actions = getAvailableRefactorActions(code, offset);
			const extractAction = actions.find((a) => a.title === "Extract Widget");
			assert.ok(extractAction !== undefined);

			assert.ok(extractAction?.newText.includes("title: widget.title"));
			assert.ok(extractAction?.newText.includes("trailing: widget.trailing"));
			assert.ok(extractAction?.newText.includes("enabled: widget.enabled"));
			assert.ok(extractAction?.newText.includes("expanded: _expanded"));
			assert.ok(extractAction?.newText.includes("handleSelect: _handleSelect"));
			assert.ok(!extractAction?.newText.includes("onSelected:"));

			const appended = extractAction?.appendText ?? "";
			assert.ok(appended.includes("final String title;"));
			assert.ok(appended.includes("final Widget? trailing;"));
			assert.ok(appended.includes("final bool enabled;"));
			assert.ok(appended.includes("final bool expanded;"));
			assert.ok(appended.includes("final void Function(String, {bool notify}) handleSelect;"));
			assert.ok(appended.includes("Text(title)"));
			assert.ok(appended.includes("trailing!"));
			assert.ok(appended.includes("handleSelect(title)"));
		});

		it("preserves complex callback signatures on extracted fields", () => {
			const code = `
class Signatures extends StatelessWidget {
  const Signatures({
    super.key,
    required this.onCommit,
    required this.onLog,
    required this.onChanged,
  });

  final void Function({required String value, bool force}) onCommit;
  final void Function(String value, [int repeat]) onLog;
  final void Function(int index)? onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      child: Column(
        children: [
          Button(onPressed: () => onCommit(value: 'ok')),
          Button(onPressed: () => onLog('entry', 2)),
          if (onChanged != null) Button(onPressed: () => onChanged!(1)) else const SizedBox.shrink(),
        ],
      ),
    );
  }
}
`;
			const offset = code.indexOf("Container(");
			const actions = getAvailableRefactorActions(code, offset);
			const extractAction = actions.find((a) => a.title === "Extract Widget");
			assert.ok(extractAction !== undefined);

			const appended = extractAction?.appendText ?? "";
			assert.ok(appended.includes("final void Function({required String value, bool force}) onCommit;"));
			assert.ok(appended.includes("final void Function(String value, [int repeat]) onLog;"));
			assert.ok(appended.includes("final void Function(int index)? onChanged;"));
		});
	});

	describe("Extract Widget: collection if/else cursor targeting", () => {
		const code = `
class CursorDemo extends StatelessWidget {
  const CursorDemo({super.key, this.enabled = true, this.trailing, this.items = const []});

  final bool enabled;
  final Widget? trailing;
  final List<String> items;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            const Text('Header'),
            if (trailing != null)
              trailing!
            else
              const SizedBox.shrink(),
          ],
        ),
        if (enabled)
          Padding(
            padding: const EdgeInsets.all(8),
            child: const Text('Enabled'),
          )
        else
          const Text('Disabled'),
        if (items.isEmpty)
          const Text('Empty')
        else if (items.length == 1)
          const Text('One')
        else
          const Text('Many'),
      ],
    );
  }
}
`.trimStart();

		function offsetOf(lineText: string, occurrence = 0): number {
			let offset = -1;
			for (let i = 0; i <= occurrence; i++)
				offset = code.indexOf(lineText, offset + 1);
			return offset;
		}

		function targetAt(offset: number): string | undefined {
			const scanner = new DartCodeScanner(code);
			const target = scanner.findEnclosingWidget(offset);
			if (!target) return undefined;
			return code.substring(target.start, target.end).split("\n")[0].trim();
		}

		it("targets the branch widget when the cursor is on an if condition", () => {
			assert.equal(targetAt(offsetOf("if (enabled)") + "if (".length), "Padding(");
			assert.equal(targetAt(offsetOf("if (trailing != null)") + "if (".length), "trailing!");
		});

		it("targets the else branch widget when the cursor is on the else keyword", () => {
			assert.equal(targetAt(offsetOf("else")), "const SizedBox.shrink()");
			assert.equal(targetAt(offsetOf("else", 1)), "const Text('Disabled')");
		});

		it("keeps the innermost widget when the cursor is inside a branch widget", () => {
			assert.equal(targetAt(offsetOf("Padding(")), "Padding(");
			assert.equal(targetAt(offsetOf("const Text('Enabled')")), "const Text('Enabled')");
			assert.equal(targetAt(offsetOf("const Text('Empty')")), "const Text('Empty')");
		});

		it("follows else-if chains to the selected branch", () => {
			assert.equal(targetAt(offsetOf("else if (items.length == 1)") + "else if (".length), "const Text('One')");
			assert.equal(targetAt(offsetOf("const Text('Many')")), "const Text('Many')");
			assert.equal(targetAt(offsetOf("else", 3)), "const Text('Many')");
		});

		it("extracts the branch widget rather than the enclosing list", () => {
			const actions = getAvailableRefactorActions(code, offsetOf("if (enabled)") + "if (".length);
			const extractAction = actions.find((action) => action.title === "Extract Widget");
			assert.ok(extractAction !== undefined);
			assert.ok(extractAction?.newText.includes("NewWidget("));
			assert.ok(extractAction?.appendText?.includes("Text('Enabled')"));
			assert.equal(extractAction?.appendText?.includes("Column("), false);
		});
	});

	describe("Convert to StatefulWidget <-> StatelessWidget", () => {
		const statelessCode = `
class ProfileCard extends StatelessWidget {
  final double size;
  final bool isSelected;

  const ProfileCard({super.key, required this.size, required this.isSelected});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      color: isSelected ? Colors.blue : Colors.grey,
    );
  }
}
`;

		it("suggests Convert to StatefulWidget when cursor is on class header", () => {
			const offset = statelessCode.indexOf("ProfileCard");
			const actions = getAvailableRefactorActions(statelessCode, offset);
			const convertAction = actions.find((a) => a.title === "Convert to StatefulWidget");
			assert.ok(convertAction !== undefined);

			const result = convertAction?.newText ?? "";
			assert.ok(result.includes("class ProfileCard extends StatefulWidget {"));
			assert.ok(result.includes("State<ProfileCard> createState() => _ProfileCardState();"));
			assert.ok(result.includes("class _ProfileCardState extends State<ProfileCard> {"));
			assert.ok(result.includes("width: widget.size"));
			assert.ok(result.includes("widget.isSelected ? Colors.blue : Colors.grey"));
		});

		const statefulCode = `
class ProfileCard extends StatefulWidget {
  final double size;
  final bool isSelected;

  const ProfileCard({super.key, required this.size, required this.isSelected});

  @override
  State<ProfileCard> createState() => _ProfileCardState();
}

class _ProfileCardState extends State<ProfileCard> {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: widget.size,
      color: widget.isSelected ? Colors.blue : Colors.grey,
    );
  }
}
`;

		it("suggests Convert to StatelessWidget when cursor is on StatefulWidget header", () => {
			const offset = statefulCode.indexOf("ProfileCard");
			const actions = getAvailableRefactorActions(statefulCode, offset);
			const convertAction = actions.find((a) => a.title === "Convert to StatelessWidget");
			assert.ok(convertAction !== undefined);

			const result = convertAction?.newText ?? "";
			assert.ok(result.includes("class ProfileCard extends StatelessWidget {"));
			assert.ok(!result.includes("_ProfileCardState"));
			assert.ok(!result.includes("createState"));
			assert.ok(result.includes("width: size"));
			assert.ok(result.includes("isSelected ? Colors.blue : Colors.grey"));
		});

		it("suggests Convert to StatelessWidget when cursor is on State class header", () => {
			const offset = statefulCode.indexOf("class _ProfileCardState");
			const actions = getAvailableRefactorActions(statefulCode, offset);
			const convertAction = actions.find((a) => a.title === "Convert to StatelessWidget");
			assert.ok(convertAction !== undefined);

			const result = convertAction?.newText ?? "";
			assert.ok(result.includes("class ProfileCard extends StatelessWidget {"));
			assert.ok(!result.includes("_ProfileCardState"));
			assert.ok(!result.includes("createState"));
			assert.ok(result.includes("width: size"));
			assert.ok(result.includes("isSelected ? Colors.blue : Colors.grey"));
		});

		it("correctly converts widgets with multi-line constructors and complex fields", () => {
			const multiLineStateless = `
class ScrollableSheet extends StatelessWidget {
  const ScrollableSheet({
    super.key,
    required this.controller,
    required this.onSnapRequested,
  });

  final DNSheetController controller;
  final void Function(String label) onSnapRequested;

  @override
  Widget build(BuildContext context) {
    onSnapRequested("opened");
    return Container(
      child: controller.view,
    );
  }
}
`;
			const offset = multiLineStateless.indexOf("ScrollableSheet");
			const actions = getAvailableRefactorActions(multiLineStateless, offset);
			const convertAction = actions.find((a) => a.title === "Convert to StatefulWidget");
			assert.ok(convertAction !== undefined);

			const result = convertAction?.newText ?? "";
			assert.ok(result.includes("class ScrollableSheet extends StatefulWidget {"));
			assert.ok(result.includes("const ScrollableSheet({\n    super.key,\n    required this.controller,\n    required this.onSnapRequested,\n  });"));
			assert.ok(result.includes("final DNSheetController controller;\n  final void Function(String label) onSnapRequested;"));
			assert.ok(result.includes("class _ScrollableSheetState extends State<ScrollableSheet> {"));
			assert.ok(result.includes('widget.onSnapRequested("opened");'));
			assert.ok(result.includes("widget.controller.view"));
		});

		it("moves non-final fields to State class and restores const constructor in StatefulWidget", () => {
			const statelessWithNonConstCtor = `
class ScrollableSheet extends StatelessWidget {
  ScrollableSheet({
    required this.controller,
    required this.onSnapRequested,
  });
  final DNSheetController controller;
  final void Function(String label) onSnapRequested;
  DNSheetDetent _activeDetent = DNSheetDetent.medium;

  @override
  Widget build(BuildContext context) {
    print(_activeDetent);
    onSnapRequested("test");
    return Container();
  }
}
`;
			const offset = statelessWithNonConstCtor.indexOf("ScrollableSheet");
			const actions = getAvailableRefactorActions(statelessWithNonConstCtor, offset);
			const convertAction = actions.find((a) => a.title === "Convert to StatefulWidget");
			assert.ok(convertAction !== undefined);

			const result = convertAction?.newText ?? "";
			assert.ok(result.includes("class ScrollableSheet extends StatefulWidget {"));
			// const was restored because non-final field moved to State!
			assert.ok(result.includes("const ScrollableSheet({\n    required this.controller,\n    required this.onSnapRequested,\n  });\n\n  final DNSheetController controller;\n  final void Function(String label) onSnapRequested;"));
			assert.ok(result.includes("class _ScrollableSheetState extends State<ScrollableSheet> {\n  DNSheetDetent _activeDetent = DNSheetDetent.medium;"));
		});

		it("removes const keyword from constructor when converting stateful to stateless with non-final fields", () => {
			const statefulWithMutable = `
class ScrollableSheet extends StatefulWidget {
  const ScrollableSheet({
    required this.controller,
    required this.onSnapRequested,
  });

  final DNSheetController controller;
  final void Function(String label) onSnapRequested;

  @override
  State<ScrollableSheet> createState() => _ScrollableSheetState();
}

class _ScrollableSheetState extends State<ScrollableSheet> {
  DNSheetDetent _activeDetent = DNSheetDetent.medium;

  @override
  Widget build(BuildContext context) {
    return Container();
  }
}
`;
			const offset = statefulWithMutable.indexOf("ScrollableSheet");
			const actions = getAvailableRefactorActions(statefulWithMutable, offset);
			const convertAction = actions.find((a) => a.title === "Convert to StatelessWidget");
			assert.ok(convertAction !== undefined);

			const result = convertAction?.newText ?? "";
			assert.ok(result.includes("class ScrollableSheet extends StatelessWidget {"));
			// Constructor must NOT have 'const ' because class has non-final field _activeDetent
			assert.ok(result.includes("ScrollableSheet({\n    required this.controller,\n    required this.onSnapRequested,\n  });"));
			assert.ok(!result.includes("const ScrollableSheet("));
			assert.ok(result.includes("DNSheetDetent _activeDetent = DNSheetDetent.medium;"));
		});

		it("does NOT suggest class conversions when cursor is inside build()", () => {
			const offset = statelessCode.indexOf("Container(");
			const actions = getAvailableRefactorActions(statelessCode, offset);
			const titles = actions.map((a) => a.title);
			assert.ok(!titles.includes("Convert to StatefulWidget"));
			assert.ok(!titles.includes("Convert to StatelessWidget"));
		});
	});
});
