import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { MarkdownContent, tableToMarkdown, tableToTsv } from "../MarkdownContent.js";

describe("MarkdownContent", () => {
  it("renders plain text as a paragraph", () => {
    const { container } = render(<MarkdownContent content="Hello world" />);
    expect(container.querySelector("p")?.textContent).toBe("Hello world");
  });

  it("renders inline code with monospace styling", () => {
    const { container } = render(
      <MarkdownContent content="Use `npm install` here" />
    );
    const code = container.querySelector("code");
    expect(code).not.toBeNull();
    expect(code?.textContent).toBe("npm install");
    expect(code?.className).toContain("font-mono");
  });

  it("renders fenced code block with syntax highlighter", () => {
    const content = "```javascript\nconst x = 42;\n```";
    const { container } = render(<MarkdownContent content={content} />);
    // SyntaxHighlighter renders with language class
    const highlighted = container.querySelector('[class*="language-"]');
    expect(highlighted).not.toBeNull();
    expect(container.textContent).toContain("const x = 42;");
  });

  it("renders fenced code block without language", () => {
    const content = "```\nsome code\n```";
    const { container } = render(<MarkdownContent content={content} />);
    expect(container.textContent).toContain("some code");
  });

  it("renders headings", () => {
    const { container } = render(<MarkdownContent content="## My Heading" />);
    const h2 = container.querySelector("h2");
    expect(h2?.textContent).toBe("My Heading");
  });

  it("renders bold and italic", () => {
    const { container } = render(
      <MarkdownContent content="**bold** and *italic*" />
    );
    expect(container.querySelector("strong")?.textContent).toBe("bold");
    expect(container.querySelector("em")?.textContent).toBe("italic");
  });

  it("renders unordered lists", () => {
    const content = "- item one\n- item two";
    const { container } = render(<MarkdownContent content={content} />);
    const items = container.querySelectorAll("li");
    expect(items.length).toBe(2);
    expect(items[0].textContent).toBe("item one");
  });

  it("renders links", () => {
    const { container } = render(
      <MarkdownContent content="[click here](https://example.com)" />
    );
    const link = container.querySelector("a");
    expect(link?.textContent).toBe("click here");
    expect(link?.getAttribute("href")).toBe("https://example.com");
  });

  it("uses div as root element to avoid nested p tags", () => {
    const { container } = render(<MarkdownContent content="Hello world" />);
    const root = container.firstElementChild;
    expect(root?.tagName).toBe("DIV");
    expect(root?.className).toContain("markdown-content");
  });

  it("renders fenced code block with copy button", () => {
    const content = "```javascript\nconst x = 42;\n```";
    const { container } = render(<MarkdownContent content={content} />);
    const copyBtn = container.querySelector('button[title="Copy code"]');
    expect(copyBtn).not.toBeNull();
    expect(copyBtn?.querySelector("svg")).not.toBeNull();
  });

  it("does not render copy button on inline code", () => {
    const { container } = render(
      <MarkdownContent content="Use `npm install` here" />
    );
    const copyBtn = container.querySelector('button[title="Copy code"]');
    expect(copyBtn).toBeNull();
  });

  it("renders GFM table as HTML table", () => {
    const content = [
      "| Name | Age |",
      "| --- | --- |",
      "| Alice | 30 |",
      "| Bob | 25 |",
    ].join("\n");

    const { container } = render(<MarkdownContent content={content} />);
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    const headers = container.querySelectorAll("th");
    expect(headers.length).toBe(2);
    expect(headers[0].textContent).toBe("Name");
    expect(headers[1].textContent).toBe("Age");
    const cells = container.querySelectorAll("td");
    expect(cells.length).toBe(4);
    expect(cells[0].textContent).toBe("Alice");
  });

  it("renders table with copy buttons", () => {
    const content = "| Name | Age |\n| --- | --- |\n| Alice | 30 |";
    const { container } = render(<MarkdownContent content={content} />);
    const mdBtn = container.querySelector('button[title="Copy as Markdown"]');
    const tsvBtn = container.querySelector('button[title="Copy as TSV"]');
    expect(mdBtn).not.toBeNull();
    expect(mdBtn?.querySelector("svg")).not.toBeNull();
    expect(tsvBtn).not.toBeNull();
    expect(tsvBtn?.querySelector("svg")).not.toBeNull();
  });

  it("tableToMarkdown produces correct output", () => {
    const doc = document.createElement("div");
    doc.innerHTML = "<table><tr><th>Name</th><th>Age</th></tr><tr><td>Alice</td><td>30</td></tr></table>";
    const table = doc.querySelector("table") as HTMLTableElement;
    const md = tableToMarkdown(table);
    expect(md).toBe("| Name | Age |\n| --- | --- |\n| Alice | 30 |");
  });

  it("tableToTsv produces correct output", () => {
    const doc = document.createElement("div");
    doc.innerHTML = "<table><tr><th>Name</th><th>Age</th></tr><tr><td>Alice</td><td>30</td></tr></table>";
    const table = doc.querySelector("table") as HTMLTableElement;
    const tsv = tableToTsv(table);
    expect(tsv).toBe("Name\tAge\nAlice\t30");
  });

  it("renders mixed markdown content", () => {
    const content = [
      "# Title",
      "",
      "Some **bold** text with `inline code`.",
      "",
      "```typescript",
      "const x = 1;",
      "```",
      "",
      "- list item",
    ].join("\n");

    const { container } = render(<MarkdownContent content={content} />);
    expect(container.querySelector("h1")).not.toBeNull();
    expect(container.querySelector("strong")).not.toBeNull();
    expect(container.querySelector("code")).not.toBeNull();
    expect(container.querySelector("li")).not.toBeNull();
  });

  // ASCII table fixer disabled pending refinement
  it.skip("renders ASCII box-drawing table in monospace code block", () => {
    const content = [
      "Here is a table:",
      "┌──────┬──────┐",
      "│ Name │ Type │",
      "├──────┼──────┤",
      "│ foo  │ str  │",
      "└──────┴──────┘",
    ].join("\n");

    const { container } = render(<MarkdownContent content={content} />);
    // The table should be rendered inside a code/pre block (monospace)
    const codeBlock = container.querySelector("code");
    expect(codeBlock).not.toBeNull();
    expect(codeBlock!.textContent).toContain("┌──────┬──────┐");
    expect(codeBlock!.textContent).toContain("│ Name │ Type │");
  });

  // ASCII table fixer disabled pending refinement
  it.skip("renders mixed ASCII table and normal markdown correctly", () => {
    const content = [
      "Some **bold** text.",
      "",
      "┌───┬───┐",
      "│ A │ B │",
      "└───┴───┘",
      "",
      "More text.",
    ].join("\n");

    const { container } = render(<MarkdownContent content={content} />);
    expect(container.querySelector("strong")).not.toBeNull();
    const codeBlock = container.querySelector("code");
    expect(codeBlock).not.toBeNull();
    expect(codeBlock!.textContent).toContain("│ A │ B │");
  });
});
