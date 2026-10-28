# WebVim

Vim-style editing, everywhere on the web.

WebVim brings Vim-inspired keyboard editing to web-based code editors. It is
enabled by default. Click the WebVim toolbar icon to check its current state or
pause/resume it across websites. The setting is saved in `chrome.storage.local`
and applies to pages that are already open.

## Install locally

1. Install dependencies with `npm install`.
2. Create the extension package with `npm run build`.
3. Open `chrome://extensions` and turn on **Developer mode**.
4. Select **Load unpacked** and choose the generated `.output/chrome-mv3`
   directory.

## Permissions

WebVim uses Chrome's `storage` permission for the persistent enabled setting.
Its static content-script match patterns cover ordinary HTTP and HTTPS sites,
so Chrome asks permission to run on those sites and displays the associated
broad site-access warning. WebVim does not request separate programmatic host
permissions, file URL access, or access to browser-internal pages.

Chrome restricts extensions from injecting into pages such as `chrome://`
settings and the Chrome Web Store. Local `file://` pages are outside WebVim's
HTTP/HTTPS match patterns. Those pages are not supported by this extension.

## Compatibility

WebVim injects into ordinary HTTP and HTTPS pages, but an injected script does
not mean that every editor is supported. Adapters resolve only the focused
editable surface. Password fields, buttons, hidden inputs, and unrelated page
shortcuts are not editor targets.

| Editing surface | Available behavior | Limits |
| --- | --- | --- |
| Text and search inputs | `h`, `l`, `w`, `b`; Normal/Insert modes | No vertical or linewise operations for single-line inputs |
| Textareas | `h`, `j`, `k`, `l`, `w`, `b`, `dd`, `yy` | Browser-native undo integration depends on the host browser |
| `contenteditable` and design-mode documents | Character, line, and word motion | No `dd`/`yy`; complex rich-text document edits are deliberately avoided |
| Monaco | All listed motions and line operations when the page exposes `window.monaco`; cursor style uses Monaco options | No adapter when the application hides its Monaco API |
| Ace | All listed motions and line operations when the page exposes `window.ace`; cursor style uses Ace options | No adapter when the application bundles Ace without exposing its API |
| CodeMirror 6 | Motions and line operations when the page exposes `CodeMirror.EditorView.findFromDOM` | No cursor-style API; most bundled pages do not expose the constructor |
| CodeMirror 5 | Not currently supported | The public API does not provide a general way to retrieve an existing editor instance from its focused DOM input |

ProseMirror, TipTap, and Quill can be treated as ordinary `contenteditable`
surfaces for movement when browser selection APIs own the active caret. They do
not receive dedicated document-editing commands. Other editors require a
reliable public API or an explicit adapter before WebVim will intercept their
keys.

### Google Workspace

WebVim deliberately registers no editor adapters in Google Docs contexts,
including related blank and nested frames, and does not show its mode panel
there. Native Google Docs keyboard handling remains in control:

| Application | Status | Reason |
| --- | --- | --- |
| Google Docs | Unsupported | The Docs REST API edits document resources, not the live browser caret. Apps Script can access a cursor only from a script bound to that document, with Google authorization. |
| Google Sheets | Unsupported | The Sheets API edits ranges by spreadsheet ID. It does not expose the browser's active in-cell edit target; intercepting grid keys could break cell navigation. |
| Google Slides | Unsupported | The Slides API edits presentation resources, not the live text caret or selection in the editor. |

These applications have no dedicated WebVim adapter, command support, or
cursor styling. Their editor and selection APIs require application-specific
integration and authorization that this extension does not request.

### Modes and cursor style

Normal mode uses a block caret and Insert mode uses a bar where the native
editor exposes a supported cursor option. Standard HTML editing surfaces use
the browser's `caret-shape` CSS property when available. WebVim saves and
restores inline caret styles and editor cursor options when focus leaves an
adapter or WebVim is disabled. The mode indicator is displayed in the top-level
page; an editor focused inside a separate frame has its own mode state.

## Iframes and permissions

The content script runs in matching frames and in related `about:blank` frames
when Chrome permits it. It cannot cross browser security boundaries to inspect
or control an inaccessible frame. Closed shadow roots are also outside the
focus paths available to WebVim.

The manifest requests only Chrome's `storage` API permission in addition to
static HTTP/HTTPS content-script matches. Those matches require the user to
grant broad site access in Chrome; the popup's WebVim switch controls behavior
after that permission is granted. WebVim does not request file URL, Google API,
OAuth, or browser-internal page access.

## Manual checks

- Open the toolbar popup, confirm the enabled indicator, disable WebVim, and
  confirm the panel disappears from an open NeetCode tab.
- Re-enable it and confirm the panel returns without reloading the tab.
- Close and reopen the browser or reload a page, then confirm the selected
  state persists.
- On NeetCode, confirm `Esc` and `i` switch modes and `j`/`k` move the cursor.
- On a text input, textarea, and contenteditable surface, confirm supported
  motions work and unrelated page shortcuts still pass through.
- In any Monaco, Ace, or CodeMirror 6 page with its public API exposed, confirm
  the listed motions and line commands; otherwise confirm it remains untouched.
- Confirm Google Docs, Sheets, and Slides keep their native editing and
  navigation behavior. Restricted browser pages are not expected to run WebVim.
