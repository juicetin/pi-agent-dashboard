import React, { useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { CopyButton } from "./CopyButton.js";

interface Props {
  content: string;
}

/** Convert a <table> DOM element to markdown */
export function tableToMarkdown(table: HTMLTableElement): string {
  const rows: string[][] = [];
  for (const row of table.rows) {
    const cells: string[] = [];
    for (const cell of row.cells) {
      cells.push(cell.textContent?.trim() ?? "");
    }
    rows.push(cells);
  }
  if (rows.length === 0) return "";

  const header = `| ${rows[0].join(" | ")} |`;
  const separator = `| ${rows[0].map(() => "---").join(" | ")} |`;
  const body = rows.slice(1).map((r) => `| ${r.join(" | ")} |`).join("\n");
  return [header, separator, body].join("\n");
}

/** Convert a <table> DOM element to TSV */
export function tableToTsv(table: HTMLTableElement): string {
  const lines: string[] = [];
  for (const row of table.rows) {
    const cells: string[] = [];
    for (const cell of row.cells) {
      cells.push(cell.textContent?.trim() ?? "");
    }
    lines.push(cells.join("\t"));
  }
  return lines.join("\n");
}

function CodeBlockWrapper({ codeString, children }: { codeString: string; children: React.ReactNode }) {
  return (
    <div>
      {children}
      <div className="flex justify-end gap-0.5 -mt-1 mb-1 opacity-50 hover:opacity-100 transition-opacity">
        <CopyButton text={codeString} icon="📋" title="Copy code" />
      </div>
    </div>
  );
}

function TableWrapper({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const getTable = useCallback(() => {
    return ref.current?.querySelector("table") as HTMLTableElement | null;
  }, []);

  const copyMarkdown = useCallback(() => {
    const table = getTable();
    return table ? tableToMarkdown(table) : "";
  }, [getTable]);

  const copyTsv = useCallback(() => {
    const table = getTable();
    return table ? tableToTsv(table) : "";
  }, [getTable]);

  return (
    <div ref={ref}>
      {children}
      <div className="flex justify-end gap-0.5 -mt-1 mb-1 opacity-50 hover:opacity-100 transition-opacity">
        <CopyButton text={copyMarkdown()} icon="📋" title="Copy as Markdown" />
        <CopyButton text={copyTsv()} icon="📊" title="Copy as TSV" />
      </div>
    </div>
  );
}

export function MarkdownContent({ content }: Props) {
  return (
    <div className="markdown-content text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const codeString = String(children).replace(/\n$/, "");

            if (match) {
              return (
                <CodeBlockWrapper codeString={codeString}>
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                  >
                    {codeString}
                  </SyntaxHighlighter>
                </CodeBlockWrapper>
              );
            }

            // Check if this is a block code (inside <pre>) or inline
            // react-markdown wraps block code in <pre><code>, inline is just <code>
            const isInline = !className && codeString.indexOf("\n") === -1;

            if (isInline) {
              return (
                <code
                  className="bg-gray-700 px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <CodeBlockWrapper codeString={codeString}>
                <SyntaxHighlighter style={oneDark} PreTag="div">
                  {codeString}
                </SyntaxHighlighter>
              </CodeBlockWrapper>
            );
          },
          table({ children }) {
            return (
              <TableWrapper>
                <table>{children}</table>
              </TableWrapper>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
