## Why

Markdown tables render as raw pipe-delimited text because `react-markdown` requires the `remark-gfm` plugin for GFM table syntax. Additionally, there are no copy-to-clipboard buttons anywhere in the dashboard — users can't easily copy messages, code blocks, or table data.

## What Changes

- **Install `remark-gfm`** and wire it into `ReactMarkdown` so GFM tables (and other GFM extensions like strikethrough, autolinks) render correctly.
- **Add a reusable `CopyButton` component** — small icon button that copies text to clipboard and shows a ✓ checkmark briefly as feedback.
- **Add copy buttons to code blocks** — always-visible 📋 icon in the top-right corner, copies raw code.
- **Add copy buttons to tables** — always-visible icon bar with two options: 📋 (markdown source) and 📊 (TSV for spreadsheet paste).
- **Add copy buttons to messages** — always-visible icon bar on each message bubble with two options: 📋 (markdown source) and 📝 (plain text, no formatting).

## Capabilities

### New Capabilities
- `content-copy`: Copy-to-clipboard buttons on messages, code blocks, and tables with format selection icons and visual feedback

### Modified Capabilities
- `markdown-rendering`: Add `remark-gfm` plugin for GFM table rendering; wrap code blocks and tables with copy button containers

## Impact

- **Dependencies** (`package.json`): Add `remark-gfm`
- **MarkdownContent** (`src/client/components/MarkdownContent.tsx`): Add gfm plugin, custom `table` and `code` component overrides with copy button wrappers
- **ChatView** (`src/client/components/ChatView.tsx`): Add message-level copy buttons to each message bubble
- **New component** (`src/client/components/CopyButton.tsx`): Reusable copy icon button with ✓ feedback
- **Styles** (`src/client/index.css`): Minor positioning styles for copy button containers if needed
