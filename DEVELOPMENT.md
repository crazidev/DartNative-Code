# DartNative Development Guide

This guide describes the workflow for developing, testing, managing patches, and releasing updates across branches in the DartNative VS Code extension project.

---

## 1. Branch Architecture

The repository uses a 3-branch strategy:

| Branch | Remote Tracking | Purpose |
| :--- | :--- | :--- |
| **`master`** | `upstream/master` (`Dart-Code/Dart-Code`) | **Clean Upstream Mirror**. Never commit customizations here. Used to track and pull upstream updates. |
| **`dev`** | `origin/dev` (`crazidev/DartNative-Code`) | **Modular Development Branch**. Contains modular code (`src/extension/dartnative/`), patch overlays (`package.dartnative.json`), and patch files (`patches/dartnative-upstream-hooks.patch`). Upstream files remain unpatched in git history for clean diffing. |
| **`main`** | `origin/main` (`crazidev/DartNative-Code`) | **Release Branch**. Contains the **full patch directly applied and committed**. Ready to compile and distribute directly without running patch commands. `CHANGELOG.md` is maintained here. |

---

## 2. Developing on `dev`

All new features, refactorings, and bug fixes should begin on the `dev` branch.

### 2.1 Branch Checkout
```bash
git checkout dev
```

### 2.2 Modular Code Architecture
Whenever possible, write new functionality in dedicated, modular files under:
- `src/extension/dartnative/` (CLI runner, argument passing, etc.)
- `src/extension/dartnative/refactors/` (Widget refactoring engine, AST scanners, generators)
- `src/test/unit/` (Fast-running Mocha unit tests)

This keeps modifications to upstream files minimal.

### 2.3 Manifest & Configuration Overlays
Extension configuration, views, and commands that override upstream definitions are declared in:
- `package.dartnative.json`

Do not manually edit `package.json` on `dev`; instead, update `package.dartnative.json`. The patch script automatically merges and transforms `package.json` when applying the patch.

### 2.4 Upstream Source Hooks & Patches
When modifications to upstream files (e.g. `src/extension/extension.ts`, `src/extension/commands/packages.ts`) are necessary:
1. Apply the current patch to edit and test files:
   ```bash
   ./scripts/patch-all.sh
   ```
2. Make your edits to upstream files.
3. Test and verify your changes (see Section 3).
4. Update the patch file with your changes:
   ```bash
   git diff -U3 > patches/dartnative-upstream-hooks.patch
   ```
   *(Note: Ensure only intended upstream source modifications are included in the diff; do not include untracked scratch files).*
5. Revert working tree modifications to upstream files on `dev` before committing:
   ```bash
   ./scripts/unpatch-all.sh
   ```
6. Commit the updated modular files, `package.dartnative.json`, and `patches/dartnative-upstream-hooks.patch` on `dev`:
   ```bash
   git add src/extension/dartnative package.dartnative.json patches/
   git commit -m "feat(dartnative): your feature description"
   git push origin dev
   ```

---

## 3. Testing & Verification

Before promoting changes to `main`, run the verification test suite:

### 3.1 Linting
Ensure code style and rules conform to the project standards:
```bash
npm run lint
```
To automatically fix formatting or fixable lint issues:
```bash
npm run lint:fix
```

### 3.2 Compilation & Unit Tests
Compile TypeScript and run unit tests:
```bash
npm run build
npm run build-tests
npx mocha "out/src/test/unit/**/*.test.js"
```

### 3.3 Interactive / Extension Testing
To manually test the extension:
1. Open the project in VS Code.
2. Press `F5` (or select **"Launch Extension"** from the Run & Debug panel).
3. In the new Extension Development Host window, open a Dart or DartNative project to verify:
   - Output channels (`DartNative initializating`, package command outputs).
   - Widget refactoring lightbulbs (`Cmd+.` / `Ctrl+.`).
   - DartNative CLI package execution (`dn pub get`, `dn run`).

---

## 4. Applying Changes & Releasing to `main`

The `main` branch contains the full patch applied directly so users and CI can build the extension immediately.

### Step-by-Step Workflow:

1. **Ensure `dev` is Clean and Pushed**:
   ```bash
   git checkout dev
   git status
   git push origin dev
   ```

2. **Switch to `main`**:
   ```bash
   git checkout main
   ```

3. **Merge or Sync Updates from `dev`**:
   ```bash
   git merge dev
   ```

4. **Apply the Full Patch Suite**:
   Run the patch script to update all upstream files and `package.json`:
   ```bash
   ./scripts/patch-all.sh
   ```

5. **Update `CHANGELOG.md`**:
   Add a new version section or update the current version entry in [`CHANGELOG.md`](file:///Users/mac/Dev/projects/dart-extension/CHANGELOG.md) summarizing:
   - Added features
   - Changed behaviors
   - Bug fixes

6. **Verify Build & Tests on `main`**:
   ```bash
   npm run build
   npm run build-tests
   npx mocha "out/src/test/unit/**/*.test.js"
   npm run lint
   ```

7. **Stage & Commit the Applied State**:
   ```bash
   git add -A
   git commit -m "feat(release): <version or summary of applied changes>"
   ```

8. **Push to `origin/main`**:
   ```bash
   git push origin main
   ```

---

## 5. Syncing with Upstream `master`

When upstream releases new versions or changes in `Dart-Code/Dart-Code`:

1. **Update `master` Mirror**:
   ```bash
   git checkout master
   git fetch upstream
   git merge --ff-only upstream/master
   git push origin master
   ```

2. **Rebase `dev` on `master`**:
   ```bash
   git checkout dev
   git rebase master
   ```
   If any upstream hook patch conflict arises, resolve conflicts in `patches/` and modular files, then push:
   ```bash
   git push origin dev --force-with-lease
   ```

3. **Promote Rebased Updates to `main`**:
   Follow Section 4 to apply the updated patch suite onto `main`, verify tests, update `CHANGELOG.md`, and push to `origin/main`.
