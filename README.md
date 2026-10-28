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
Google Docs support also uses Chrome's `debugger` permission to send arrow-key
input through Chrome's page input pipeline. Chrome shows a broad warning for
this permission (including access to the page debugger and site data); WebVim
attaches only to an enabled Google Docs editor tab and detaches when disabled
or when the page closes. If the debugger cannot attach, Docs remains native and
WebVim does not intercept its keys.
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

Google Docs uses a canvas-based editor and a separate hidden text-event frame.
WebVim listens in that frame and asks Chrome's debugger protocol to send the
corresponding arrow-key input to the focused page. This avoids treating the
hidden event target as an ordinary textarea and keeps the panel and Docs
keyboard controller on one mode state.

| Application | Status | Reason |
| --- | --- | --- |
| Google Docs | Partial support | `h`, `j`, `k`, `l`, `w`, `b`, and Normal/Insert mode. Requires Chrome's debugger permission. Docs' visible caret has no reliable style API; `dd` and `yy` are not supported. |
| Google Sheets | Unsupported | The Sheets API edits ranges by spreadsheet ID. It does not expose the browser's active in-cell edit target; intercepting grid keys could break cell navigation. |
| Google Slides | Unsupported | The Slides API edits presentation resources, not the live text caret or selection in the editor. |

Google Docs movement uses Chrome's page input pipeline rather than a synthetic
`KeyboardEvent`; the Docs application still decides how that input moves its
caret. The hidden text-event iframe is an input target, not the visible caret:
WebVim has no supported Docs API or DOM geometry that reports the live caret
position and rendered dimensions. An overlay therefore could not be kept
reliably aligned through wrapping, scrolling, zoom, selection, and document
reflow. Docs draws its own caret, so WebVim cannot provide the block/bar cursor
treatment available in Monaco or ordinary HTML controls. Google Sheets and
Slides have no WebVim adapters in this milestone.

### Modes and cursor style

Normal mode uses a block caret and Insert mode uses a bar where the native
editor exposes a supported cursor option. Standard HTML editing surfaces use
the browser's `caret-shape` CSS property when available. WebVim saves and
restores inline caret styles and editor cursor options when focus leaves an
adapter or WebVim is disabled. Google Docs does not expose a reliable cursor
styling hook. Its top-level mode panel shares state with the Docs input-frame
controller.

## Iframes and permissions

The content script runs in matching frames and in related `about:blank` frames
when Chrome permits it. The Docs integration requires its event iframe to be
same-origin accessible; cross-origin or detached frames are left untouched.
Closed shadow roots are also outside the focus paths available to WebVim.

The manifest requests Chrome's `storage` and `debugger` API permissions in
addition to static HTTP/HTTPS content-script matches. Those matches require
the user to grant broad site access in Chrome; the popup's WebVim switch
controls behavior after that permission is granted. WebVim does not request
file URL, Google API, OAuth, or browser-internal page access.

## Manual checks

- Open the toolbar popup, confirm the enabled indicator, disable WebVim, and
  confirm the panel disappears from an open NeetCode tab.
- Re-enable it and confirm the panel returns without reloading the tab.
- Close and reopen the browser or reload a page, then confirm the selected
  state persists.
- On NeetCode, confirm `Esc` and `i` switch modes and `j`/`k` move the cursor.
- In a Google Docs document, confirm the WebVim panel appears, `i` enters
  Insert mode, `Esc` returns to Normal mode, and `h`/`j`/`k`/`l` move the Docs
  caret. Confirm Docs' native caret style remains unchanged.
- On a text input, textarea, and contenteditable surface, confirm supported
  motions work and unrelated page shortcuts still pass through.
- In any Monaco, Ace, or CodeMirror 6 page with its public API exposed, confirm
  the listed motions and line commands; otherwise confirm it remains untouched.
- Confirm Google Sheets and Slides keep their native editing and navigation
  behavior. Restricted browser pages are not expected to run WebVim.
