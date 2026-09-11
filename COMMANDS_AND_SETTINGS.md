# Dart-Code Commands & Settings Reference

This document catalogs all **VS Code Commands** and **Configuration Settings** contributed by and used within the Dart-Code extension. It serves as a reference for enabling, disabling, and renaming commands and settings.

---

## Table of Contents

1. [Guide: How to Modify Commands and Settings](#guide-how-to-modify-commands-and-settings)
   - [Renaming a Command](#renaming-a-command)
   - [Disabling / Enabling a Command in the Command Palette](#disabling--enabling-a-command-in-the-command-palette)
   - [Renaming / Modifying a Setting](#renaming--modifying-a-setting)
2. [Commands Reference](#commands-reference)
   - [Dart Commands (57)](#dart-commands)
   - [Flutter Commands (42)](#flutter-commands)
   - [Pub Commands (5)](#pub-commands)
   - [Debug Commands (5)](#debug-commands)
   - [Internal / Code-Only Commands (21)](#internal--code-only-commands)
3. [Settings Reference](#settings-reference)
   - [Analyzer Settings (11)](#analyzer-settings)
   - [DevTools Settings (10)](#devtools-settings)
   - [Editor Settings (25)](#editor-settings)
   - [Flutter Settings (25)](#flutter-settings)
   - [Logging Settings (11)](#logging-settings)
   - [Pub Settings (6)](#pub-settings)
   - [Run and Debug Settings (19)](#run-and-debug-settings)
   - [SDK Settings (11)](#sdk-settings)
   - [Testing Settings (5)](#testing-settings)
   - [Experimental Settings (10)](#experimental-settings)
   - [Other Settings (3)](#other-settings)
   - [Legacy Settings (3)](#legacy-settings)

---

## Guide: How to Modify Commands and Settings

### Renaming a Command
- **Title / Display Label**: Modify the `"title"` or `"category"` in `package.json` under `contributes.commands`.
- **Command Identifier**: If modifying the command ID string (e.g. `dart.xxx` $\to$ `dartx.xxx`), you must update:
  1. `package.json` (`contributes.commands`, `contributes.menus`, `contributes.keybindings`)
  2. The TypeScript registration file under `src/extension/commands/` (e.g. `vs.commands.registerCommand("dart.xxx", ...)`)
  3. Any internal calls referencing `vs.commands.executeCommand("dart.xxx", ...)`

### Disabling / Enabling a Command in the Command Palette
- **To Disable / Hide from Palette**: In `package.json` under `contributes.menus.commandPalette`, add or set:
  ```json
  {
    "command": "dart.commandName",
    "when": "false"
  }
  ```
- **To Enable in Palette**: Remove `"when": "false"` or change `"when"` to an activation condition like `"dart-code:anyProjectLoaded"` or `"dart-code:anyFlutterProjectLoaded"`.

### Renaming / Modifying a Setting
- **Manifest Definition**: In `package.json` under `contributes.configuration`, update the key name, default value, description, or enum options.
- **Code Access**: In `src/extension/config.ts`, update the corresponding getter property and any code references.

---

## Commands Reference

### Dart Commands

| Command ID | Title | Palette Status / When Condition | Registered In |
| :--- | :--- | :--- | :--- |
| `dart.toggleShowTodos` | Toggle Show TODOs | Visible (Default) | `src/extension/commands/analyzer.ts` |
| `dart.createProject` | Create New Project | Conditional (`undefined`) | `src/extension/commands/dart.ts`, `src/extension/sdk/utils.ts` |
| `dart.addSdkToPath` | Add Dart SDK to PATH | Conditional (`dart-code:anyProjectLoaded`) | `src/extension/commands/add_sdk_to_path.ts` |
| `dart.writeRecommendedSettings` | Use Recommended Settings | Conditional (`dart-code:anyProjectLoaded`) | `src/extension/commands/edit.ts` |
| `dart.addDependency` | Add Dependency | Conditional (`dart-code:anyProjectLoaded && config.dart.enablePub`) | `src/extension/commands/add_dependency.ts` |
| `dart.addDevDependency` | Add Dev Dependency | Conditional (`dart-code:anyProjectLoaded && config.dart.enablePub`) | `src/extension/commands/add_dependency.ts` |
| `_dart.removeDependency` | Remove Dependency | **Hidden** (`when: false`) | `src/extension/commands/add_dependency.ts` |
| `_dart.removeDependencyFromTreeNode` | Remove Dependency | **Hidden** (`when: false`) | `src/extension/views/packages_view.ts` |
| `_dart.openDependencyPageFromTreeNode` | Open on pub.dev | Visible (Default) | `src/extension/views/packages_view.ts` |
| `dart.toggleLineComment` | Toggle Line Comment Kind | Conditional (`dart-code:anyProjectLoaded`) | `src/extension/commands/edit.ts` |
| `dart.toggleDartdocComment` | Toggle Dartdoc Comment | Conditional (`dart-code:anyProjectLoaded`) | `src/extension/commands/edit.ts` |
| `dart.task.dartdoc` | Generate Documentation | Conditional (`dart-code:anyProjectLoaded`) | `src/extension/dart/dart_task_provider.ts` |
| `dart.goToSuper` | Go to Super Class/Member | Conditional (`dart-code:anyProjectLoaded && editorLangId == dart`) | `src/extension/lsp/go_to.ts` |
| `dart.goToImports` | Go to Imports | Conditional (`dart-code:anyProjectLoaded && editorLangId == dart && dart-code:goToImportsSupported`) | `src/extension/lsp/go_to.ts` |
| `dart.goToAugmented` | Go to Augmented Class/Member/Function | Conditional (`dart-code:anyProjectLoaded && editorLangId == dart && dart-code:lsp.request.dart.textDocument.augmented`) | `src/extension/lsp/go_to.ts` |
| `dart.goToAugmentation` | Go to Class/Member/Function Augmentation | Conditional (`dart-code:anyProjectLoaded && editorLangId == dart && dart-code:lsp.request.dart.textDocument.augmentation`) | `src/extension/lsp/go_to.ts` |
| `dart.rerunLastDebugSession` | Rerun Last Debug Session | Conditional (`dart-code:anyProjectLoaded && dart-code:hasLastDebugConfig`) | `src/extension/commands/debug.ts` |
| `dart.rerunLastTestDebugSession` | Rerun Last Test Session | Conditional (`dart-code:anyProjectLoaded && dart-code:hasLastTestDebugConfig`) | `src/extension/commands/debug.ts` |
| `dart.restartAnalysisServer` | Restart Analysis Server | Conditional (`dart-code:anyProjectLoaded`) | `src/extension/commands/analyzer.ts` |
| `dart.forceReanalyze` | Reanalyze Project | Conditional (`dart-code:anyProjectLoaded`) | `src/extension/commands/analyzer.ts` |
| `dart.printSelectionToTerminal` | Linkify Selected Editor Text into Terminal | Conditional (`dart-code:anyProjectLoaded && editorHasSelection`) | `src/extension/commands/edit.ts` |
| `dart.goToTestOrImplementationFile` | Go to Test/Implementation File | Conditional (`dart-code:anyProjectLoaded && dart-code:canGoToTestOrImplementationFile`) | `src/extension/commands/test.ts` |
| `dart.findTestOrImplementationFile` | Find Test/Implementation File | Conditional (`dart-code:anyProjectLoaded`) | `src/extension/commands/test.ts` |
| `dart.goToTests` | Go to Tests | **Hidden** (`when: false`) | `src/extension/commands/test.ts` |
| `dart.startDebugging` | Start Debugging | **Hidden** (`when: false`) | `src/extension/commands/debug.ts` |
| `dart.startWithoutDebugging` | Run Without Debugging | **Hidden** (`when: false`) | `src/extension/commands/debug.ts` |
| `dart.createLaunchConfiguration` | Create Launch Configuration | **Hidden** (`when: false`) | `src/extension/commands/debug.ts` |
| `dart.sortMembers` | Sort Members | Conditional (`dart-code:anyProjectLoaded && editorLangId == dart`) | `src/extension/commands/edit.ts` |
| `dart.edit.fixAllInWorkspace` | Apply Fix All in Workspace | Conditional (`dart-code:anyProjectLoaded && dart-code:lsp.command.dart.edit.fixAllInWorkspace`) | _Not explicitly registered in src/ (or via LSP/VSCode)_ |
| `dart.edit.fixAllInWorkspace.preview` | Preview Fix All in Workspace | Conditional (`dart-code:anyProjectLoaded && dart-code:lsp.command.dart.edit.fixAllInWorkspace.preview`) | _Not explicitly registered in src/ (or via LSP/VSCode)_ |
| `dart.generateDiagnosticReport` | Collect Diagnostic Information | Conditional (`undefined`) | `src/extension/diagnostic_report.ts` |
| `dart.startLogging` | Capture Logs | Conditional (`dart-code:anyProjectLoaded`) | `src/extension/commands/logging.ts` |
| `dart.startLoggingAnalysisServer` | Capture Analysis Server Logs | Conditional (`dart-code:anyProjectLoaded`) | `src/extension/commands/logging.ts` |
| `dart.startLoggingAnalysisServerTimings` | Capture Analysis Server Timings | Conditional (`dart-code:anyProjectLoaded`) | `src/extension/commands/logging.ts` |
| `dart.startLoggingDebugging` | Capture Debugging Logs | Conditional (`dart-code:anyProjectLoaded`) | `src/extension/commands/logging.ts` |
| `dart.startLoggingExtensionOnly` | Capture Extension Logs | Conditional (`dart-code:anyProjectLoaded`) | `src/extension/commands/logging.ts` |
| `dart.openExtensionLog` | Open Extension Log | Conditional (`dart-code:anyProjectLoaded`) | `src/extension/commands/logging.ts` |
| `dart.stopLogging` | Stop Capturing Logs | Conditional (`dart-code:anyProjectLoaded && dart-code:isCapturingLogs`) | `src/extension/commands/logging.ts` |
| `dart.openObservatory` | Open Observatory (Deprecated, use DevTools) | Conditional (`dart-code:anyProjectLoaded && inDebugMode && debugType == dart && dart-code:observatorySupported`) | `src/extension/commands/debug.ts` |
| `dart.openAnalyzerDiagnostics` | Open Analyzer Diagnostics / Insights | Conditional (`dart-code:anyProjectLoaded`) | `src/extension/commands/analyzer.ts` |
| `dart.changeSdk` | Change SDK | Conditional (`dart-code:anyProjectLoaded && !dart-code:anyFlutterProjectLoaded`) | `src/extension/commands/sdk.ts` |
| `_dart.hotReload.touchBar` | Hot Reload | **Hidden** (`when: false`) | `src/extension/commands/debug.ts` |
| `_dart.hotReload.withSave` | Save and Hot Reload | **Hidden** (`when: false`) | `src/extension/commands/debug.ts` |
| `dart.hotReload` | Hot Reload | Conditional (`inDebugMode && debugType == dart && dart-code:service.reloadSources \|\| inDebugMode && debugType == dart && dart-code:isInDartDebugSession`) | `src/extension/commands/debug.ts` |
| `dart.openDevTools` | Open DevTools | Conditional (`dart-code:anyProjectLoaded`) | `src/extension/commands/debug.ts` |
| `dart.openDevTools.external` | Open DevTools in Browser | Conditional (`dart-code:anyProjectLoaded`) | `src/extension/commands/debug.ts` |
| `dart.copyVmServiceUri` | Copy VM Service URI to Clipboard | Conditional (`dart-code:anyProjectLoaded && inDebugMode && debugType == dart`) | `src/extension/commands/debug.ts` |
| `dart.copyDtdUri` | Copy DTD URI to Clipboard | Conditional (`dart-code:dtdAvailable`) | `src/extension/dart/tooling_daemon.ts` |
| `dart.openDevToolsMemory` | Open DevTools Memory Page | Conditional (`dart-code:anyProjectLoaded && inDebugMode && debugType == dart && dart-code:devToolsSupportsMemory`) | _Not explicitly registered in src/ (or via LSP/VSCode)_ |
| `dart.openDevToolsCpuProfiler` | Open DevTools CPU Profiler Page | Conditional (`dart-code:anyProjectLoaded && inDebugMode && debugType == dart && dart-code:devToolsSupportsCpuProfiler`) | _Not explicitly registered in src/ (or via LSP/VSCode)_ |
| `dart.openDevToolsNetwork` | Open DevTools Network Page | Conditional (`dart-code:anyProjectLoaded && inDebugMode && debugType == dart && dart-code:devToolsSupportsNetwork`) | _Not explicitly registered in src/ (or via LSP/VSCode)_ |
| `dart.openDevToolsLogging` | Open DevTools Logging Page | Conditional (`dart-code:anyProjectLoaded && inDebugMode && debugType == dart && dart-code:devToolsSupportsLogging`) | _Not explicitly registered in src/ (or via LSP/VSCode)_ |
| `_dart.openDevTools.touchBar` | DevTools | **Hidden** (`when: false`) | `src/extension/commands/debug.ts` |
| `_dart.showDebuggerNumbersAsHex` | Format integers as Hex | **Hidden** (`when: false`) | `src/extension/providers/debug_adapter_hex_view_factory.ts` |
| `_dart.showDebuggerNumbersAsDecimal` | Format integers as Decimal | **Hidden** (`when: false`) | `src/extension/providers/debug_adapter_hex_view_factory.ts` |
| `_dart.settings.openDevToolsLocationSetting` | Change where DevTools appears | **Hidden** (`when: false`) | `src/extension/commands/settings.ts` |
| `_dart.settings.openDartTestAdditionalArgs` | Edit additional 'dart test' arguments | **Hidden** (`when: false`) | `src/extension/commands/settings.ts` |

### Flutter Commands

| Command ID | Title | Palette Status / When Condition | Registered In |
| :--- | :--- | :--- | :--- |
| `flutter.createProject` | Create New Project | Conditional (`undefined`) | `src/extension/commands/flutter.ts`, `src/extension/sdk/utils.ts` |
| `flutter.createProject.sidebar` | Create New Flutter Project | **Hidden** (`when: false`) | `src/extension/commands/flutter.ts` |
| `flutter.addSdkToPath` | Add Flutter SDK to PATH | Conditional (`dart-code:anyFlutterProjectLoaded`) | `src/extension/commands/add_sdk_to_path.ts` |
| `flutter.task.genl10n` | Generate Localizations | Conditional (`dart-code:anyFlutterProjectLoaded`) | `src/extension/flutter/flutter_task_provider.ts` |
| `dart.changeFlutterSdk` | Change SDK | Conditional (`dart-code:anyFlutterProjectLoaded`) | `src/extension/commands/sdk.ts` |
| `flutter.packages.get` | Get Packages | Conditional (`dart-code:anyFlutterProjectLoaded && config.dart.enablePub`) | `src/extension/commands/packages.ts` |
| `flutter.packages.get.all` | Get Packages for All Projects | Conditional (`dart-code:anyFlutterProjectLoaded && config.dart.enablePub`) | `src/extension/commands/packages.ts` |
| `flutter.packages.upgrade` | Upgrade Packages | Conditional (`dart-code:anyFlutterProjectLoaded && config.dart.enablePub`) | `src/extension/commands/packages.ts` |
| `flutter.packages.upgrade.majorVersions` | Upgrade Packages (--major-versions) | Conditional (`dart-code:anyFlutterProjectLoaded && config.dart.enablePub`) | `src/extension/commands/packages.ts` |
| `flutter.packages.outdated` | List Outdated Packages | Conditional (`dart-code:anyFlutterProjectLoaded && config.dart.enablePub`) | `src/extension/commands/packages.ts` |
| `flutter.clean` | Clean Project | Conditional (`dart-code:anyFlutterProjectLoaded`) | `src/extension/commands/flutter.ts` |
| `flutter.clean.all` | Clean All Projects | Conditional (`dart-code:anyFlutterProjectLoaded`) | `src/extension/commands/flutter.ts` |
| `flutter.doctor` | Run Flutter Doctor | Conditional (`undefined`) | `src/extension/commands/flutter.ts`, `src/extension/sdk/utils.ts` |
| `flutter.doctor.sidebar` | Run Flutter Doctor | **Hidden** (`when: false`) | `src/extension/commands/flutter.ts` |
| `flutter.upgrade` | Run Flutter Upgrade | Conditional (`undefined`) | `src/extension/commands/flutter.ts`, `src/extension/sdk/utils.ts` |
| `flutter.toggleDebugPainting` | Toggle Debug Painting | Conditional (`inDebugMode && debugType == dart && dart-code:serviceExtension.ext.flutter.debugPaint`) | `src/extension/commands/debug.ts` |
| `flutter.togglePerformanceOverlay` | Toggle Performance Overlay | Conditional (`inDebugMode && debugType == dart && dart-code:serviceExtension.ext.flutter.showPerformanceOverlay`) | `src/extension/commands/debug.ts` |
| `flutter.overridePlatform` | Override Platform | Conditional (`inDebugMode && debugType == dart && dart-code:serviceExtension.ext.flutter.platformOverride`) | `src/extension/commands/debug.ts` |
| `flutter.toggleBrightness` | Toggle Brightness | Conditional (`inDebugMode && debugType == dart && dart-code:serviceExtension.ext.flutter.brightnessOverride`) | `src/extension/commands/debug.ts` |
| `flutter.toggleRepaintRainbow` | Toggle Repaint Rainbow | Conditional (`inDebugMode && debugType == dart && dart-code:serviceExtension.ext.flutter.repaintRainbow`) | `src/extension/commands/debug.ts` |
| `flutter.toggleSlowAnimations` | Toggle Slow Animations | Conditional (`inDebugMode && debugType == dart && dart-code:serviceExtension.ext.flutter.timeDilation`) | `src/extension/commands/debug.ts` |
| `flutter.toggleDebugModeBanner` | Toggle Debug-Mode Banner | Conditional (`inDebugMode && debugType == dart && dart-code:serviceExtension.ext.flutter.debugAllowBanner`) | `src/extension/commands/debug.ts` |
| `flutter.togglePaintBaselines` | Toggle Baseline Painting | Conditional (`inDebugMode && debugType == dart && dart-code:serviceExtension.ext.flutter.debugPaintBaselinesEnabled`) | `src/extension/commands/debug.ts` |
| `flutter.inspectWidget` | Inspect Widget | Conditional (`inDebugMode && debugType == dart && !dart-code:flutter.isInspectingWidget`) | `src/extension/commands/debug.ts` |
| `flutter.inspectWidget.autoCancel` | Inspect Widget (Auto-Cancel after Selection) | Conditional (`inDebugMode && debugType == dart && !dart-code:flutter.isInspectingWidget`) | `src/extension/commands/debug.ts` |
| `flutter.cancelInspectWidget` | Cancel Widget Inspection | Conditional (`inDebugMode && debugType == dart && dart-code:flutter.isInspectingWidget`) | `src/extension/commands/debug.ts` |
| `flutter.screenshot` | Save Screenshot | Conditional (`dart-code:anyFlutterProjectLoaded && inDebugMode && debugType == dart`) | `src/extension/commands/flutter.ts` |
| `_flutter.screenshot.touchBar` | Screenshot | **Hidden** (`when: false`) | `src/extension/commands/flutter.ts` |
| `flutter.showWidgetPreview` | Show Widget Preview | Conditional (`dart-code:anyFlutterProjectLoaded && dart-code:flutterWidgetPreviewSupported`) | `src/extension/flutter/widget_preview/widget_preview_manager.ts` |
| `flutter.hotRestart` | Hot Restart | Conditional (`dart-code:anyFlutterProjectLoaded && inDebugMode && debugType == dart`) | `src/extension/commands/debug.ts` |
| `flutter.hotReload` | Hot Reload | Conditional (`dart-code:anyFlutterProjectLoaded && inDebugMode && debugType == dart && dart-code:service.reloadSources`) | `src/extension/commands/debug.ts` |
| `flutter.getSelectedDeviceId` | Get Selected Device ID | **Hidden** (`when: false`) | `src/extension/extension.ts` |
| `flutter.openDevTools` | Open DevTools | Conditional (`dart-code:anyProjectLoaded && dart-code:anyFlutterProjectLoaded`) | `src/extension/commands/debug.ts` |
| `flutter.openDevTools.sidebar` | Open DevTools | **Hidden** (`when: false`) | `src/extension/commands/debug.ts` |
| `dart.openDevToolsInspector` | Open DevTools Widget Inspector Page | Conditional (`dart-code:anyProjectLoaded && inDebugMode && debugType == dart && dart-code:devToolsSupportsInspector`) | _Not explicitly registered in src/ (or via LSP/VSCode)_ |
| `dart.openDevToolsPerformance` | Open DevTools Performance Page | Conditional (`dart-code:anyProjectLoaded && inDebugMode && debugType == dart && dart-code:devToolsSupportsPerformance`) | _Not explicitly registered in src/ (or via LSP/VSCode)_ |
| `dart.openDevToolsDeepLinks` | Open DevTools Deep Links Page | Conditional (`dart-code:anyProjectLoaded && dart-code:devToolsSupportsDeepLinks`) | _Not explicitly registered in src/ (or via LSP/VSCode)_ |
| `flutter.selectDevice` | Select Device | Conditional (`dart-code:anyFlutterProjectLoaded`) | `src/extension/extension.ts` |
| `flutter.launchEmulator` | Launch Emulator | Conditional (`dart-code:anyFlutterProjectLoaded && dart-code:isRunningLocally && config.dart.flutterShowEmulators == local \|\| dart-code:anyFlutterProjectLoaded && config.dart.flutterShowEmulators == always`) | `src/extension/extension.ts` |
| `flutter.openInAndroidStudio` | Open in Android Studio | **Hidden** (`when: false`) | `src/extension/commands/open_in_other_editors.ts` |
| `flutter.openInXcode` | Open in Xcode | **Hidden** (`when: false`) | `src/extension/commands/open_in_other_editors.ts` |
| `_dart.settings.openFlutterTestAdditionalArgs` | Edit additional 'flutter test' arguments | **Hidden** (`when: false`) | `src/extension/commands/settings.ts` |

### Pub Commands

| Command ID | Title | Palette Status / When Condition | Registered In |
| :--- | :--- | :--- | :--- |
| `pub.get` | Get Packages | Conditional (`dart-code:anyProjectLoaded && config.dart.enablePub`) | `src/extension/commands/packages.ts` |
| `pub.get.all` | Get Packages for All Projects | Conditional (`dart-code:anyProjectLoaded && config.dart.enablePub`) | `src/extension/commands/packages.ts` |
| `pub.upgrade` | Upgrade Packages | Conditional (`dart-code:anyProjectLoaded && config.dart.enablePub`) | `src/extension/commands/packages.ts` |
| `pub.upgrade.majorVersions` | Upgrade Packages (--major-versions) | Conditional (`dart-code:anyProjectLoaded && config.dart.enablePub`) | `src/extension/commands/packages.ts` |
| `pub.outdated` | List Outdated Packages | Conditional (`dart-code:anyProjectLoaded && config.dart.enablePub`) | `src/extension/commands/packages.ts` |

### Debug Commands

| Command ID | Title | Palette Status / When Condition | Registered In |
| :--- | :--- | :--- | :--- |
| `dart.attach` | Attach to Dart Process | Conditional (`dart-code:anyProjectLoaded && !inDebugMode`) | `src/extension/commands/debug.ts` |
| `flutter.runProfileMode` | Run App in Profile Mode | Conditional (`dart-code:anyFlutterProjectLoaded && !inDebugMode`) | `src/extension/commands/debug.ts` |
| `flutter.runReleaseMode` | Run App in Release Mode | Conditional (`dart-code:anyFlutterProjectLoaded && !inDebugMode`) | `src/extension/commands/debug.ts` |
| `flutter.attach` | Attach to Flutter on Device | Conditional (`dart-code:anyFlutterProjectLoaded && !inDebugMode && dart-code:flutterSupportsAttach`) | `src/extension/commands/debug.ts` |
| `flutter.attachProcess` | Attach to Flutter Process | Conditional (`dart-code:anyFlutterProjectLoaded && !inDebugMode && dart-code:flutterSupportsAttach`) | `src/extension/commands/debug.ts` |

### Internal / Code-Only Commands

These commands are registered directly in TypeScript code but are not declared in `package.json` commands list (often used for internal callbacks, code lenses, tree views, or refactorings):

| Command ID | Code Location |
| :--- | :--- |
| `_dart.applySnippetTextEdit` | `src/extension/analysis/analyzer_snippet_text_edits.ts` |
| `_dart.openDartPadSample` | `src/extension/code_lens/flutter_dartpad_samples.ts` |
| `_dart.addDependency` | `src/extension/commands/add_dependency.ts` |
| `_dart.create` | `src/extension/commands/dart.ts` |
| `dart.promptForVmService` | `src/extension/commands/debug.ts` |
| `_dart.toggleDebugOptions` | `src/extension/commands/debug.ts` |
| `_dart.jumpToLineColInUri` | `src/extension/commands/edit.ts` |
| `_dart.showCode` | `src/extension/commands/edit.ts` |
| `_dart.flutter.createSampleProject` | `src/extension/commands/flutter.ts`, `src/extension/sdk/utils.ts` |
| `_flutter.create` | `src/extension/commands/flutter.ts` |
| `_flutter.clean` | `src/extension/commands/flutter.ts` |
| `dart.getPackages` | `src/extension/commands/packages.ts` |
| `dart.getPackages.all` | `src/extension/commands/packages.ts` |
| `dart.listOutdatedPackages` | `src/extension/commands/packages.ts` |
| `dart.upgradePackages` | `src/extension/commands/packages.ts` |
| `dart.upgradePackages.majorVersions` | `src/extension/commands/packages.ts` |
| `_dart.startDebuggingTestFromOutline` | `src/extension/commands/test.ts` |
| `_dart.startWithoutDebuggingTestFromOutline` | `src/extension/commands/test.ts` |
| `_dart.startDebuggingTestsFromVsTestController` | `src/extension/commands/test.ts` |
| `_dart.startWithoutDebuggingTestsFromVsTestController` | `src/extension/commands/test.ts` |
| `_dart.runAllTestsWithoutDebugging` | `src/extension/commands/test.ts` |
| `dart.refactor.extractWidget` | `src/extension/commands/widget_refactors.ts` |
| `dart.refactor.wrapWithWidget` | `src/extension/commands/widget_refactors.ts` |
| `_dart.reloadExtension` | `src/extension/extension.ts` |
| `dart.package.openFile` | `src/extension/extension.ts` |
| `dart.goToLocation` | `src/extension/lsp/go_to.ts` |

---

## Settings Reference

### Analyzer Settings (11)

| Setting Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `dart.analysisExcludedFolders` | `array` | `[]` | An array of paths to be excluded from Dart analysis. This option should usually be set at the Workspace level. Excluded folders will also be ignored when detecting project types. |
| `dart.analyzerAdditionalArgs` | `array` | `[]` | Additional arguments to pass to the Dart Analysis Server. This setting is can be useful for troubleshooting issues with the Dart Analysis Server. |
| `dart.analyzerVmAdditionalArgs` | `array` | `[]` | Additional arguments to pass to the VM running the Dart Analysis Server. This setting is can be useful for troubleshooting issues with the Dart Analysis Server. |
| `dart.analyzerDiagnosticsPort` | `null \| number` | `null` | The port number to be used for the Dart analyzer diagnostic server. This setting is can be useful for troubleshooting issues with the Dart Analysis Server. |
| `dart.analyzerPath` | `null \| string` | `null` | The path to a custom Dart Analysis Server. This setting is intended for use by Dart Analysis Server developers. Use `~` to insert the user's home directory (the path should then use `/` separators even on Windows). |
| `dart.analyzerSshHost` | `null \| string` | `null` | An SSH host to run the Analysis Server. This can be useful when modifying code on a remote machine using SSHFS. |
| `dart.analyzerVmServicePort` | `null \| number` | `null` | The port number to be used for the Dart Analysis Server VM service. This setting is intended for use by Dart Analysis Server developers. |
| `dart.includeDependenciesInWorkspaceSymbols` | `boolean` | `true` | Whether to include symbols from the SDK and package dependencies in the "Go to Symbol in Workspace" (`cmd/ctrl`+`T`) list. This can only be disabled when using Dart 3.0 / Flutter 3.10 or later. |
| `dart.notifyAnalyzerErrors` | `boolean` | `true` | Whether to show a notification the first few times an Analysis Server exception occurs. |
| `dart.showTodos` | `boolean \| array` | `true` | Whether to show TODOs in the Problems list. Can be a boolean to enable all TODO comments (TODO, FIXME, HACK, UNDONE) or an array of which types to enable. Older Dart SDKs may not support some TODO kinds. |
| `dart.showExtensionRecommendations` | `boolean` | `true` | Whether to show recommendations for other VS Code extensions based on the packages you're using. |

### DevTools Settings (10)

| Setting Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `dart.devToolsBrowser` | `enum` | `"chrome"` | Whether to launch external DevTools windows using Chrome or the system default browser. This setting is ignored for remote workspaces (including Docker, SSH, WSL). |
| `dart.devToolsPort` | `null \| number` | `null` | The port number to be used for the Dart DevTools (requires restart). |
| `dart.devToolsReuseWindows` | `boolean` | `true` | Whether to try to reuse existing DevTools windows instead of launching new ones. Only works for instances of DevTools launched by the DevTools server on the local machine. |
| `dart.devToolsTheme` | `enum` | `"dark"` | The theme to use for Dart DevTools. |
| `dart.devToolsLocation` | `object` | `{"default":"beside","inspec...` | Where to open [Dart DevTools](https://dart.dev/tools/dart-devtools) pages. |
| `dart.openDevTools` | `enum` | `"never"` | Whether to automatically open DevTools at the start of a debug session. If embedded DevTools is enabled, this will launch the Widget Inspector embedded for Flutter projects, or launch DevTools externally in a browser for Dart projects. |
| `dart.closeDevTools` | `enum` | `"never"` | Whether to automatically close embedded DevTools tabs when a debug session ends. |
| `dart.shareDevToolsWithFlutter` | `boolean` | `true` | Whether to eagerly run DevTools for Flutter workspaces and share the spawned server with `flutter run`. |
| `dart.showInspectorNotificationsForWidgetErrors` | `boolean` | `true` | Whether to show notifications for widget errors that offer Inspect Widget links. This requires that the `#dart.shareDevToolsWithFlutter#` setting is also enabled. |
| `dart.customDevTools` | `object` | `—` | Custom settings for launching DevTools. This setting is intended for use by Dart DevTools developers. |

### Editor Settings (25)

| Setting Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `dart.autoImportCompletions` | `boolean` | `true` | Whether to include symbols that have not been imported in the code completion list and automatically insert the required import when selecting them (requires restart). |
| `dart.automaticCommentSlashes` | `enum` | `"tripleSlash"` | Determines when to insert comment slashes when pressing `<enter>` in the editor (requires restart).  When using `tripleSlash`, double-slashes will still be included when breaking existing double-slash comments across additional lines. |
| `dart.closingLabels` | `boolean` | `true` | Whether to show annotations against constructor, method invocations and lists that span multiple lines. |
| `dart.closingLabelsPrefix` | `string` | `" // "` | The prefix to use in closing labels. |
| `dart.closingLabelsTextStyle` | `string` | `"normal"` | The text style to use in closing labels. Using _Italic_ requires a font that supports italic text. |
| `dart.completeFunctionCalls` | `boolean` | `true` | Whether to insert parentheses and placeholders for positional and required arguments during code completions when using LSP. This feature is automatically disabled if commit characters are enabled. |
| `dart.documentation` | `null \| string` | `—` | What level of documentation to show in Hovers and Code Completion details. When `null`, defaults to 'full' when running locally and 'none' in remote workspaces. This setting is only supported for Dart SDKs after v2.18. |
| `dart.dtdEditorActiveLocationDelay` | `integer` | `200` | How long (in ms) to delay sending editor location change events over the Dart Tooling Daemon. Increasing this results in less events which may improve performance, at the expensive of tools that use these events not updating as quickly after your location/editor changes (requires restart). |
| `dart.enableServerSnippets` | `boolean` | `true` | Whether to use code snippets from the Dart Analysis Server instead of those included in the extension. Server snippets are context and language-version aware and should be preferred. |
| `dart.hotReloadPatterns` | `array` | `[]` | An array of glob patterns that should trigger Hot Reload when saved. The pattern is matched against the absolute path of the file. Use `**/assets/**` to trigger reloading for everything in the assets directory. Must always start with "**/" and use forward slashes (even on Windows) as backslashes are used for escaping. |
| `dart.enableCompletionCommitCharacters` | `boolean` | `false` | Whether to automatically commit the selected completion item when pressing certain keys such as . , ( and \[. This setting does not currently apply to LSP, see `#dart.previewCommitCharacters#`. |
| `dart.enableSdkFormatter` | `boolean` | `true` | Whether to enable the [dart_style](https://pub.dev/packages/dart_style) formatter for Dart code. |
| `dart.enableSnippets` | `boolean` | `true` | Whether to include Dart and Flutter snippets in code completion. |
| `dart.enableWidgetRefactors` | `boolean` | `true` | Whether to enable built-in DartX widget refactorings (Wrap with Padding, Container, Row, Column, Center, Expanded, Extract Widget, etc.). Set to false if you are using a Dart analysis server plugin. |
| `dart.moveNonFinalFieldsToState` | `boolean` | `true` | When converting between StatefulWidget and StatelessWidget, whether to automatically move non-final/mutable fields to the State class and adjust constructor 'const' modifiers. |
| `dart.inlayHints` | `boolean \| object` | `true` | Whether to show Inlay Hints. When set to `true`, enables all inlay hints with default settings. When set to `false`, disables all inlay hints. Can also be an object to configure individual hint types. Requires Dart 3.10. |
| `dart.insertArgumentPlaceholders` | `boolean` | `true` | Whether to insert argument placeholders during code completions. This feature is automatically disabled when `enableCompletionCommitCharacters` is enabled. |
| `dart.lspSnippetTextEdits` | `boolean` | `true` | Whether to enable [Snippet support in LSP TextEdits](https://github.com/rust-analyzer/rust-analyzer/blob/979e788957ced1957ee9ac1da70fb97abf9fe2b1/docs/dev/lsp-extensions.md#snippet-textedit). |
| `dart.renameFilesWithClasses` | `enum` | `"never"` | Whether to rename files when renaming classes with matching names (for example renaming 'class Person' inside 'person.dart'). If set to 'prompt', will ask each time before renaming. If set to 'always', the file will automatically be renamed. This setting requires using LSP and a Dart SDK of at least v2.15. |
| `dart.showDartPadSampleCodeLens` | `boolean` | `true` | Whether to show CodeLens actions in the editor for opening online DartPad samples. |
| `dart.showMainCodeLens` | `boolean` | `true` | Whether to show CodeLens actions in the editor for quick running / debugging scripts with main functions. |
| `dart.showTestCodeLens` | `boolean` | `true` | Whether to show CodeLens actions in the editor for quick running / debugging tests. |
| `dart.updateImportsOnRename` | `boolean` | `true` | Whether to automatically update imports when moving or renaming files. Currently only supports single file moves / renames. |
| `dart.warnWhenEditingFilesOutsideWorkspace` | `boolean` | `true` | Whether to show a warning when modifying files outside of the workspace. |
| `dart.warnWhenEditingFilesInPubCache` | `boolean` | `true` | Whether to show a warning when modifying files in the [system package cache](https://dart.dev/tools/pub/glossary#system-cache) directory. |

### Flutter Settings (25)

| Setting Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `dart.flutterAdbConnectOnChromeOs` | `boolean` | `false` | Whether to automatically run `adb connect 100.115.92.2:5555` when spawning the Flutter daemon when running on Chrome OS. |
| `dart.flutterAdditionalArgs` | `array` | `[]` | Additional args to pass to all `flutter` commands including `flutter daemon`. Do not use this to pass arguments to your Flutter app, use the `args` field in a `launch.json` or the `#dart.flutterRunAdditionalArgs#` setting. |
| `dart.flutterAttachAdditionalArgs` | `array` | `[]` | Additional args to pass to the `flutter attach` command. Using the `args`/`toolArgs` fields in `launch.json` is usually better than this setting as this setting will apply to _all_ projects. |
| `dart.flutterCreateAndroidLanguage` | `enum` | `"kotlin"` | The programming language to use for Android apps when creating new projects using the 'Flutter: Create New Project' command. |
| `dart.flutterCreateIOSLanguage` | `enum` | `"swift"` | The programming language to use for iOS apps when creating new projects using the 'Flutter: Create New Project' command. This is only supported up until Flutter 3.22 after which it will be ignored. |
| `dart.flutterCreatePlatforms` | `array` | `null` | The platforms to enable for new projects created using the 'Flutter: Create New Project' command. If unset, all platforms will be enabled. |
| `dart.flutterCreatePromptForPlatforms` | `boolean` | `true` | Whether to prompt for platforms when running 'Flutter: Create New Project'. |
| `dart.offline` | `boolean` | `false` | Whether to use the --offline switch for commands like 'pub get' and 'Flutter: Create New Project'. |
| `dart.flutterCreateOrganization` | `null \| string` | `null` | The organization responsible for your new Flutter project, in reverse domain name notation (e.g. `com.google`). This string is used in Java package names and as prefix in the iOS bundle identifier when creating new projects using the 'Flutter: Create New Project' command. |
| `dart.flutterCustomEmulators` | `array` | `[]` | Custom emulators to show in the emulator list for easier launching. If IDs match existing emulators returned by Flutter, the custom emulators will override them. |
| `dart.flutterGutterIcons` | `boolean` | `true` | Whether to show Flutter icons and colors in the editor gutter. |
| `dart.flutterHotReloadOnSave` | `enum` | `"manual"` | Whether to automatically send a Hot Reload request to Flutter apps during a debug session when saving files. Dart apps are controlled by the hotReloadOnSave setting. |
| `dart.hotReloadOnSave` | `enum` | `"never"` | Whether to automatically send a Hot Reload request to Dart apps during a debug session when saving files. Flutter apps are controlled by the flutterHotReloadOnSave setting. |
| `dart.flutterGenerateLocalizationsOnSave` | `enum` | `"never"` | Whether to automatically run the Generate Localizations command for Flutter apps when saving .arb files. |
| `dart.flutterRunAdditionalArgs` | `array` | `[]` | Additional args to pass to the `flutter run` command. Using the `args`/`toolArgs` fields in `launch.json` is usually better than this setting as this setting will apply to _all_ projects. |
| `dart.flutterScreenshotPath` | `null \| string` | `null` | The path to a directory to save Flutter screenshots. Use `~` to insert the user's home directory (the path should then use `/` separators even on Windows). |
| `dart.flutterRememberSelectedDevice` | `boolean` | `true` | Whether to remember which device was last (explicitly) selected for each project. When the remembered device is selected, it will prevent newly-connected mobile devices from being automatically selected (regardless of the `#dart.flutterSelectDeviceWhenConnected#` setting). |
| `dart.flutterSelectDeviceWhenConnected` | `boolean` | `true` | Whether to set newly connected devices as the current device in Flutter projects. |
| `dart.flutterShowEmulators` | `enum` | `"local"` | When to show the Flutter emulators. These are usually hidden for remote workspaces because it is usually not possible to see or interact with emulators in a remote session. If you are using remoting/containers in a way that you can interact with launched emulator processes, you may wish to set this to 'always'. |
| `dart.flutterShowWebServerDevice` | `enum` | `"remote"` | When to show the Flutter headless web-server device. This requires using the Dart Debug extension for Chrome and is usually only used for remote environments where Chrome is not available such as browser/cloud-based IDEs (requires restart). |
| `dart.flutterTestAdditionalArgs` | `array` | `[]` | Additional args to pass to the `flutter test` command. Using the `args`/`toolArgs` fields in `launch.json` is usually better than this setting as this setting will apply to _all_ projects. |
| `dart.flutterWebRenderer` | `enum` | `"flutter-default"` | Sets the [Web renderer](https://flutter.dev/to/web-renderers) used for Flutter web apps. |
| `dart.flutterWidgetPreview` | `string` | `"startLazily"` | Controls whether the Widget Preview is enabled, and if so whether it is started eagerly or lazily. Starting lazily will avoid consuming any resources until you first use the Widget Preview, but will cause the first load to be slower. Requires restart. |
| `dart.flutterWidgetPreviewLocation` | `string` | `"sidebar"` | Where to display the Flutter Widget Preview. Requires restart. |
| `dart.useFlutterDev` | `boolean` | `false` | Whether to use `flutter-dev` instead of `flutter`. This is a script for developers of the `flutter` tool to run from source and will run more slowly than the compiled tool. |

### Logging Settings (11)

| Setting Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `dart.analyzerInstrumentationLogFile` | `null \| string` | `null` | The path to a log file for very detailed logging in the Dart Analysis Server that may be useful when trying to diagnose Analysis Server issues. Use `${workspaceName}` to insert the name of the current workspace in the file path. Use `~` to insert the user's home directory (the path should then use `/` separators even on Windows). Only the noted substitutions are supported, others will stay as-is. |
| `dart.analyzerLogFile` | `null \| string` | `null` | The path to a log file for communication between Dart Code and the Analysis Server. Use `${workspaceName}` to insert the name of the current workspace in the file path. Use `~` to insert the user's home directory (the path should then use `/` separators even on Windows). Only the noted substitutions are supported, others will stay as-is. |
| `dart.toolingDaemonLogFile` | `null \| string` | `null` | The path to a log file for the `dart tooling-daemon` service, which coordinates between various Dart and Flutter tools and extensions. Use `${workspaceName}` to insert the name of the current workspace in the file path. Use `~` to insert the user's home directory (the path should then use `/` separators even on Windows). Only the noted substitutions are supported, others will stay as-is. |
| `dart.dapLogFile` | `null \| string` | `null` | The path to a log file for communication with the DAP debug adapters. This is useful when trying to diagnose issues with debugging such as missed breakpoints. Use `${name}` in the log file name to insert the Debug Session name to prevent concurrent debug sessions overwriting each others logs. Use `${workspaceName}` to insert the name of the current workspace in the file path. Use `${kind}` to insert a description of the kind of debug session ('dart', 'dart_test', 'flutter' etc.). Use `~` to insert the user's home directory (the path should then use `/` separators even on Windows). Only the noted substitutions are supported, others will stay as-is. |
| `dart.devToolsLogFile` | `null \| string` | `null` | The path to a low-traffic log file for the Dart DevTools service. Use `${workspaceName}` to insert the name of the current workspace in the file path. Use `~` to insert the user's home directory (the path should then use `/` separators even on Windows). Only the noted substitutions are supported, others will stay as-is. |
| `dart.extensionLogFile` | `null \| string` | `null` | The path to a low-traffic log file for basic extension and editor issues. Use `${workspaceName}` to insert the name of the current workspace in the file path. Use `~` to insert the user's home directory (the path should then use `/` separators even on Windows). Only the noted substitutions are supported, others will stay as-is. |
| `dart.flutterDaemonLogFile` | `null \| string` | `null` | The path to a log file for the `flutter daemon` service, which provides information about connected devices accessible from the status bar. Use `${workspaceName}` to insert the name of the current workspace in the file path. Use `~` to insert the user's home directory (the path should then use `/` separators even on Windows). Only the noted substitutions are supported, others will stay as-is. |
| `dart.flutterWidgetPreviewLogFile` | `null \| string` | `null` | The path to a log file for the `flutter widget-preview` service. Use `${workspaceName}` to insert the name of the current workspace in the file path. Use `~` to insert the user's home directory (the path should then use `/` separators even on Windows). Only the noted substitutions are supported, others will stay as-is. |
| `dart.mcpServerLogFile` | `null \| string` | `null` | The path to a log file for the Dart SDK's MCP server. Use `${workspaceName}` to insert the name of the current workspace in the file path. Use `~` to insert the user's home directory (the path should then use `/` separators even on Windows). Only the noted substitutions are supported, others will stay as-is. |
| `dart.maxLogLineLength` | `number` | `2000` | The maximum length of a line in the log file. Lines longer than this will be truncated and suffixed with an ellipsis. |
| `dart.maxCompletionItems` | `null \| number` | `—` | The maximum number of completion items to return from a code completion request. Updated results will be fetched as additional characters are typed. Lower numbers may improved performance. Defaults to a lower value in remote workspaces. Only affects LSP for > Dart SDK 2.17. |

### Pub Settings (6)

| Setting Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `dart.enablePub` | `boolean` | `true` | Whether to enable functionality for using Pub. Turning this setting off will prevent the extension from ever running pub and hide all commands relating to this. Use this if you are using an alternative package manager. |
| `dart.promptToGetPackages` | `boolean` | `true` | Whether to prompt to get/upgrade packages when opening a project with missing/out of date packages. |
| `dart.pubAdditionalArgs` | `array` | `[]` | Additional args to pass to all `pub` commands. |
| `dart.runPubGetOnPubspecChanges` | `enum` | `"always"` | Whether to run `pub get` whenever `pubspec.yaml` is saved. |
| `dart.runPubGetOnNestedProjects` | `enum` | `"none"` | Whether to automatically run `pub get` on nested projects above or below the one where the pubspec was changed. |
| `dart.runPubConcurrently` | `boolean` | `true` | Whether to run Pub operations across multiple folders concurrently. |

### Run and Debug Settings (19)

| Setting Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `dart.buildRunnerAdditionalArgs` | `array` | `[]` | Additional args to pass to the `build_runner` when building/watching/serving. |
| `dart.cliConsole` | `enum` | `"debugConsole"` | Whether to run Dart CLI apps in the Debug Console or a terminal. The Debug Console has more functionality because the process is controlled by the debug adapter, but is unable to accept input from the user via stdin. |
| `dart.debugExtensionBackendProtocol` | `enum` | `"ws"` | The protocol to use for the Dart Debug Extension backend service and injected client. Using WebSockets can improve performance but may fail when connecting through some proxy servers. |
| `dart.debugSdkLibraries` | `boolean` | `false` | Whether to mark Dart SDK libraries (`dart:*`) as debuggable, enabling stepping into them while debugging. |
| `dart.debugExternalPackageLibraries` | `boolean` | `false` | Whether to mark external pub package libraries (including `package:flutter`) as debuggable, enabling stepping into them while debugging. |
| `dart.evaluateGettersInDebugViews` | `boolean` | `true` | Whether to evaluate getters in order to display them in debug views (such as the Variables, Watch and Hovers views). |
| `dart.showGettersInDebugViews` | `boolean` | `true` | Whether to show getters in order to display them in debug views (such as the Variables, Watch and Hovers views). If `evaluateGettersInDebugViews` is `true` getters will be eagerly evaluated, otherwise they will require clicking to evaluate. |
| `dart.evaluateToStringInDebugViews` | `boolean` | `true` | Whether to call toString() on objects when rendering them in debug views (such as the Variables, Watch and Hovers views). Only applies to views of 100 or fewer values for performance reasons. |
| `dart.hotReloadProgress` | `enum` | `"notification"` | Determines how to display Hot Restart and Hot Reload progress. |
| `dart.promptToRunIfErrors` | `boolean` | `true` | Whether to prompt before running if there are errors in your project. Test scripts will be excluded from the check unless they're the script being run. |
| `dart.showDartDeveloperLogs` | `boolean` | `true` | Whether to show logs from the `dart:developer` `log()` function in the debug console. |
| `dart.showDebuggerNumbersAsHex` | `boolean` | `false` | Whether to show integers formatted as Hex in Variables, Watch, Debug Consoles. |
| `dart.showDevToolsDebugToolBarButtons` | `boolean` | `true` | Whether to show DevTools buttons in the floating Debug toolbar. |
| `dart.suppressTestTimeouts` | `enum` | `"debug"` | Whether to suppress test timeouts when running/debugging tests. To work properly this requires package:test version 1.20.1 or newer. For older versions, the default timeout will be increased to 1d but this will not affect tests that have explicit (non-factor) timeouts set with @timeout. |
| `dart.cliAdditionalArgs` | `array` | `[]` | Additional args to pass to the `dart` command when running CLI scripts. Using the `args`/`toolArgs` fields in `launch.json` is usually better than this setting as this setting will apply to _all_ projects. |
| `dart.testAdditionalArgs` | `array` | `[]` | Additional args to pass to the `dart test` command. Using the `args`/`toolArgs` fields in `launch.json` is usually better than this setting as this setting will apply to _all_ projects. |
| `dart.vmAdditionalArgs` | `array` | `[]` | Arguments to be passed to the Dart VM when running Dart CLI scripts/tests.  These arguments appear after "dart" but before subcommands like "test":  `dart (vmAdditionalArgs) test (toolArgs) test/my_test.dart (args)` |
| `dart.customDartDapPath` | `null \| string` | `null` | The path to a custom Dart Debug Adapter. This setting is intended for use by Dart Debug Adapter developers. Use `~` to insert the user's home directory (the path should then use `/` separators even on Windows). |
| `dart.customFlutterDapPath` | `null \| string` | `null` | The path to a custom Flutter Debug Adapter. This setting is intended for use by Dart Debug Adapter developers. Use `~` to insert the user's home directory (the path should then use `/` separators even on Windows). |

### SDK Settings (11)

| Setting Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `dart.checkForSdkUpdates` | `boolean` | `true` | Whether to check you are using the latest version of the Dart SDK at startup. |
| `dart.sdkPath` | `null \| string` | `null` | The location of the Dart SDK to use for analyzing and executing code. If blank (or not a valid SDK), Dart Code will attempt to find it from the `PATH` environment variable. When editing a Flutter project, the version of Dart included in the Flutter SDK is used in preference. Use `~` to insert the user's home directory (the path should then use `/` separators even on Windows). |
| `dart.sdkPaths` | `array` | `[]` | An array of paths that either directly point to a Dart SDK or the parent directory of multiple Dart SDKs that can be used for fast SDK switching. These paths are not used directly when searching for an SDK. When this setting is populated, the SDK version number in the status bar can be used to quickly switch between SDKs. Use `~` to insert the user's home directory (the path should then use `/` separators even on Windows). |
| `dart.flutterSdkPath` | `null \| string` | `null` | The location of the Flutter SDK to use. If blank (or not a valid SDK), Dart Code will attempt to find it from the project directory, `FLUTTER_ROOT` environment variable and the `PATH` environment variable. Use `~` to insert the user's home directory (the path should then use `/` separators even on Windows). |
| `dart.flutterSdkPaths` | `array` | `[]` | An array of paths that either directly point to a Flutter SDK or the parent directory of multiple Flutter SDKs that can be used for fast SDK switching. These paths are not used directly when searching for an SDK. When this setting is populated, the version number in the status bar can be used to quickly switch between SDKs. Use `~` to insert the user's home directory (the path should then use `/` separators even on Windows). |
| `dart.sdkSwitchingTarget` | `enum` | `"workspace"` | Where to save SDK selections when using fast SDK switching from the language status entry. |
| `dart.addSdkToTerminalPath` | `boolean` | `true` | Whether to add your selected Dart/Flutter SDK path to the `PATH` environment variable for the embedded terminal. This is useful when switching SDKs via `#dart.sdkPaths#` / `#dart.flutterSdkPaths#` to ensure commands run from the terminal are the same version as being used by the editor/debugger (requires restart). |
| `dart.getFlutterSdkCommand` | `null \| object` | `null` | Get the Flutter SDK path from a command. Useful when using tools such as direnv, asdf, mise... The command should exit with a 0 status code and it should print to the standard output just the path to the SDK. If the command fails (non zero exit or bad path), the extension will keep looking for other SDK paths. Some configuration examples can be found in: https://github.com/Dart-Code/Dart-Code/pull/5377 |
| `dart.getDartSdkCommand` | `null \| object` | `null` | Get the Dart SDK path from a command. Useful when using tools such as direnv, asdf, mise... The command should exit with a 0 status code and it should print to the standard output just the path to the SDK. If the command fails (non zero exit or bad path), the extension will keep looking for other SDK paths. Some configuration examples can be found in: https://github.com/Dart-Code/Dart-Code/pull/5377 |
| `dart.mcpServer` | `boolean` | `true` | Whether to register the Dart SDK's MCP server with VS Code. This only applies to Dart SDKs >= v3.9.0 which added the server. |
| `dart.mcpServerTools` | `object` | `{"analyze_files":false,"dar...` | A map of MCP tool names to booleans to enable/disable specific tools from the Dart MCP server. Tools set to `false` will be excluded (if supported). By default, tools that overlap with built-in VS Code functionality will be excluded. |

### Testing Settings (5)

| Setting Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `dart.allowTestsOutsideTestFolder` | `boolean` | `false` | Whether to consider files ending `_test.dart` that are outside of the test directory as tests. This should be enabled if you put tests inside the `lib` directory of your Flutter app so they will be run with `flutter test` and not `flutter run`. |
| `dart.coverageExcludePatterns` | `array` | `[]` | An array of glob patterns to exclude from code coverage results. Paths matching any of these patterns will still be collected by the Dart VM but not be included in coverage reported to VS Code. |
| `dart.openTestView` | `array` | `["testRunStart"]` | When to automatically switch focus to the test list (array to support multiple values). |
| `dart.showSkippedTests` | `boolean` | `true` | Whether to show skipped tests in the test tree. |
| `dart.testInvocationMode` | `enum` | `"name"` | How to identify tests when running/debugging. `name` is compatible with older versions of `package:test` but cannot handle some complex/dynamic test names. `line` will prefer to run tests by their line numbers (when available) and fall back to `name` only if the line number is unavailable. |

### Other Settings (3)

| Setting Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `dart.projectSearchDepth` | `number` | `5` | How many levels (including the workspace roots) down the workspace to search for Dart/Flutter projects. Increasing this number may help detect Flutter projects that are deeply nested in your workspace but slow down all operations that search for projects, including extension activation (requires restart). |
| `dart.env` | `object` | `{}` | Additional environment variables to be added to all Dart/Flutter processes spawned by the Dart and Flutter extensions. |
| `dart.toolingDaemonAdditionalArgs` | `array` | `[]` | Additional args to pass to the `dart tooling-daemon` command that runs as a background service (requires restart). |

### Experimental Settings (10)

| Setting Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `dart.normalizeFileCasing` | `boolean` | `false` | Whether to normalize file casings before sending them to the LSP server. This may fix issues with file_names lints not disappearing after renaming a file if the VS Code API continues to use the original casing. |
| `dart.daemonPort` | `null \| number` | `null` | EXPERIMENTAL: The port where flutter daemon can be accessed if daemon is run remotely. This setting is intended for use by Google developers. |
| `dart.previewCommitCharacters` | `boolean` | `false` | EXPERIMENTAL: Whether to enable commit characters for the LSP server. In a future release, the dart.enableCompletionCommitCharacters setting will also apply to LSP. |
| `dart.previewFlutterUiGuides` | `boolean` | `false` | EXPERIMENTAL: Whether to enable the [Flutter UI Guides preview](https://dartcode.org/releases/v3-1/#preview-flutter-ui-guides). |
| `dart.previewFlutterUiGuidesCustomTracking` | `boolean` | `false` | EXPERIMENTAL: Whether to enable custom tracking of Flutter UI guidelines (to hide some latency of waiting for the next Flutter Outline). |
| `dart.previewHotReloadOnSaveWatcher` | `boolean` | `false` | Whether to perform hot reload on save based on a filesystem watcher for Dart files rather than using VS Code's `onDidSave` event. This allows reloads to trigger when external tools modify Dart source files. |
| `dart.experimentalRefactors` | `boolean` | `false` | Whether to enable experimental (possibly unfinished or unstable) refactors on the lightbulb menu. This setting is intended for use by Dart Analysis Server developers or users that want to try out and provide feedback on in-progress refactors. |
| `dart.interactiveForms` | `boolean` | `true` | Whether to enable the Interactive Forms feature used for accepting user input during refactors. |
| `dart.dynamicTestTracking` | `boolean` | `true` | Whether to use the new dynamic test tracking. This is a temporary setting that will be removed in an upcoming release. |
| `dart.experimentalDtdHandlers` | `boolean` | `false` | Whether to enable experimental (possibly unfinished or unstable) LSP handlers through DTD. This setting is passed to the analysis server in the connectToDtd request and therefore relies on DTD being supported and enabled for the analysis server (requires restart). |

### Legacy Settings (3)

| Setting Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `dart.lineLength` | `integer` | `80` | **LEGACY SETTING: Use `formatter.page_width` in `analysis_options.yaml` instead.**  The maximum length of a line of code. This is used by the document formatter. If you change this value, you may wish to update `editor.rulers` (which draws vertical lines in the editor) in the `["dart"]` section of your settings to match. |
| `dart.webDaemonLogFile` | `null \| string` | `null` | **LEGACY SETTING: Only applies when using the legacy debug adapters.**  The path to a log file for communication between Dart Code and the webdev daemon. This is useful when trying to diagnose issues with launching web apps. Use `${name}` in the log file name to insert the Debug Session name to prevent concurrent debug sessions overwriting each others logs. Use `${workspaceName}` to insert the name of the current workspace in the file path. Use `~` to insert the user's home directory (the path should then use `/` separators even on Windows). Only the noted substitutions are supported, others will stay as-is. |
| `dart.onlyAnalyzeProjectsWithOpenFiles` | `boolean` | `false` | **Deprecated**: Whether to ignore workspace folders and perform analysis based on the open files. This setting can make performance significantly worse when moving around a project and is not recommended. |

