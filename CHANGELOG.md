# Change Log

All notable changes to the "dartnative" extension will be documented in this file.

## [3.144.0-dev] - 2026-09-13

### Added
- **DartNative Framework Support**:
  - First-class support for DartNative mobile applications and packages.
  - Automatic detection of DartNative projects via `pubspec.yaml` dependencies.
  - Integrated `dn` CLI runner routing for package management (`dn pub get`, `dn pub upgrade`), execution (`dn run`), and testing (`dn test`).
  - Seamless passing of `pubAdditionalArgs`, `runAdditionalArgs`, and `testAdditionalArgs` directly to `dn` commands.
- **Rich Widget Refactoring Engine**:
  - Single-widget wrap actions: `Wrap with widget...`, `Wrap with Padding`, `Wrap with Center`, `Wrap with Container`, `Wrap with Column`, `Wrap with Row`, `Wrap with SizedBox`, `Wrap with Expanded`.
  - Multi-widget selection support inside `children: [...]` lists (`Wrap with Column`, `Wrap with Row`, `Remove widgets`).
  - Intelligent `Extract Widget` refactoring with variable extraction, constructor generation, and type inference.
  - `Convert to StatefulWidget` and `Convert to StatelessWidget` refactorings with constructor restoration and state management.
  - Multi-trigger integration via lightbulb, `Cmd+.` / `Ctrl+.`, and Refactor menus.
- **Enhanced Output Experience**:
  - Automatic reveal and post-execution focus of the output channel for all package operations (`pub get`, `add dependency`, `pub upgrade`).
  - Rebranded SDK initialization channel to `DartNative initializating`.
  - Cleaned up output channel list by removing background daemon channels.
- **DartNative Clean Project & Clean All Projects**:
  - Updated notification progress titles to display `DartNative: Clean Project` and `DartNative: Clean All Projects` when running clean operations on DartNative projects.
  - Updated folder and project selection prompt to display `Select the folder to run "DartNative clean" in` (instead of "flutter clean").
  - Updated project folder filters to discover DartNative projects alongside Flutter projects in clean commands and workspace project search.
- **DartNative SDK Locator & Auto-Validation**:
  - Interactive SDK folder picker (`dart.locateDartNativeSdk`) with automatic detection and validation of `bin/dn` (`dn.bat` on Windows).
  - Automatically resolves parent SDK folder when user selects the `bin` folder directly.
  - Registered SDK commands early in extension activation so `DartNative: Locate SDK` is always available from the Command Palette even when no SDK is installed.
  - Always prompt for SDK location when the DartNative SDK path is not set or not found upon workspace activation.
  - Added fallback command handlers for `dart.getPackages`, `pub.get`, `flutter.packages.get`, and package management commands when SDK is missing to guide users to locate the SDK instead of erroring with command not found.
  - Validates `dn` executable in the SDK path before modifying shell environment files (`.zshenv`, `.bashrc`, etc.) in "Add SDK to PATH".
  - Direct integration into the SDK switcher quick-pick via `"$(folder) Locate SDK (Browse...)"`.
- **Strict `dn` Routing**:
  - Enforced strict `dn` routing for package management, debug adapters, debugger launch, and doctor commands with zero fallback to standard Dart or Flutter.
- **DartNative License Key Support**:
  - Interactive license key command (`dart.setDartNativeLicenseKey`) that executes `dn config --license-key <key>`.
  - Configuration setting `dart.dartNativeLicenseKey` for workspace/user settings.
  - Exports `DN_LICENSE_KEY` environment variable and appends `--dart-define=DN_LICENSE_KEY=<key>` to `dn run` and debug launch configurations.
- **Configurable Command Palette Visibility**:
  - Added boolean setting `dartx.showCommandsWhenSdkMissing` to toggle whether other commands (such as Get Packages) are displayed in the Command Palette when the SDK is missing or not configured.
- **Fixes**:
  - Fixed "Add SDK to PATH" notification branding so it displays "The DartNative SDK is already in your PATH" instead of "The Flutter SDK...".
  - Fixed duplicate command registration of `dartnative.addSdkToPath` when missing SDK fallback handlers are active.
  - Fixed configuration reloading during extension restart so newly selected SDK paths are recognized immediately upon clicking "Reload".
  - Fixed duplicate paths and double-slash prefixes in terminal environment (e.g. `bin//dart`), normalizing paths and deduplicating against `process.env.PATH`.
