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
- **DartNative DevTools & Sidebar**:
  - Native tree views for Memory, Network, and Logging.
  - Streamlined settings under the `DartNative` configuration section.
