# WebVim Popup and Global Site Support Implementation Plan

> Archived planning snapshot for the initial popup/global-site milestone. The
> scope and constraints below describe that milestone, not the current editor
> adapter architecture. Checklist items are historical planning notes.

> **Historical constraint:** The original request excluded automated tests,
> builds, and runtime checks.

**Goal:** Add a persistent popup toggle and run WebVim’s existing behavior on ordinary HTTP and HTTPS pages while preserving NeetCode’s Monaco commands.

**Architecture:** An isolated content script owns storage, key handling, and enable/disable lifecycle. A NeetCode-only MAIN-world bridge exposes only Monaco cursor commands through a DOM event. The popup and content script share one storage key and default missing state to enabled.

**Tech Stack:** WXT, React, TypeScript, Chrome Manifest V3 storage, static content scripts.

**Spec:** User request in the conversation dated 2026-10-28.

## Global Constraints

- Do not run, build, test, or otherwise verify the application.
- Do not add or run automated tests.
- Preserve Normal/Insert modes, Esc/i, j/k, and native behavior outside supported editor inputs.
- Use HTTP and HTTPS match patterns; do not request file URL or restricted browser page access.
- Add only the `storage` API permission; static content script matches provide site injection access.
- Add no editor adapters or site-specific integrations beyond the existing NeetCode Monaco adapter.

## Review Focus

- Missing stored state defaults to enabled; non-boolean/corrupt values also use the default.
- Changes from the popup take effect in open pages without duplicate listeners or panels.
- Key handling remains scoped to the Monaco input selectors and passes through unrelated inputs.
- The MAIN-world bridge can only request existing Monaco up/down commands and does not own enable state.
- Restricted browser URLs are excluded by HTTP/HTTPS match patterns and browser injection policy.

---

### Task 1: Shared setting and minimal popup

**Files:**
- Create `core/settings.ts` for the storage key, default, and storage helpers.
- Modify `entrypoints/popup/App.tsx`, `entrypoints/popup/App.css`, and `entrypoints/popup/style.css` for the toggle state and compact styling.
- Modify `wxt.config.ts` to request `storage` and give the toolbar action a WebVim title.

- [ ] Define one shared enabled key, defaulting to `true`, and type-safe read/write helpers.
- [ ] Replace the starter popup with an enabled indicator and accessible Enable/Disable switch; restore and subscribe to stored state and handle storage errors.
- [ ] Add the minimum manifest API permission.

### Task 2: Isolated runtime lifecycle and Monaco bridge

**Files:**
- Modify `entrypoints/content.ts` for global isolated execution and storage-driven lifecycle.
- Modify `input/keyboard-controller.ts` so start/stop are idempotent.
- Modify `adapters/monaco-adapter.ts` to request Monaco commands through a narrow bridge event and preserve its arrow fallback.
- Create `entrypoints/monaco-bridge.content.ts` as a NeetCode-only MAIN-world Monaco command bridge.

- [ ] Use HTTP/HTTPS patterns for the isolated content script and read the shared setting before activation, observing storage changes immediately.
- [ ] Start one runtime session when enabled; stop it and remove its panel when disabled; safely clean up partial initialization failures.
- [ ] Keep adapter resolution limited to current Monaco editor input selectors and NeetCode host matching.
- [ ] Keep main-world code limited to the NeetCode Monaco command bridge; it must not read or mutate the enabled setting.

### Task 3: User-facing documentation

**Files:**
- Modify `README.md`.

- [ ] Document loading the built extension unpacked, popup persistence, the broad site-access permission, supported HTTP/HTTPS surfaces, restricted pages, and current Monaco-on-NeetCode compatibility limits.
- [ ] Include concise manual verification steps; do not perform them in this task.
