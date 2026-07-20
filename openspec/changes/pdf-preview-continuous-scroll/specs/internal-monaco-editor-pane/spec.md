# internal-monaco-editor-pane — delta

## MODIFIED Requirements

### Requirement: Pane SHALL dispatch viewers via a kind-based registry

The pane SHALL dispatch the active tab to a viewer via a kind-based registry. The registry SHALL cover: `monaco` (text/code), `markdown`, `image`, `pdf`, `html`, `video`, `audio`, `mermaid`, `docx`, `pptx`, `spreadsheet`, `asciidoc`, `email`, and `binary-warn`. Where a shared `preview/*` renderer exists for a kind, the registry entry SHALL delegate to it rather than a pane-local duplicate:

- `pdf` → `PdfPreview`; `html` → `HtmlPreview` (sandboxed, scripts disabled);

#### Scenario: PDF renders via pdfjs, not a native plugin

- **GIVEN** the pane runs inside the Electron shell (no PDF plugin)
- **WHEN** the user opens a `.pdf` tab
- **THEN** the tab renders `PdfPreview` as a continuous-scroll pdfjs viewer (text-selectable, find-capable), not a Prev/Next paged canvas
