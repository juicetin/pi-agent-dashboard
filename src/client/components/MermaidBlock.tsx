import React, { useEffect, useRef, useState, useId } from "react";
import { useThemeContext } from "./ThemeProvider.js";

let mermaidIdCounter = 0;

interface Props {
  code: string;
}

export function MermaidBlock({ code }: Props) {
  const reactId = useId();
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { resolved: theme } = useThemeContext();
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    setSvg(null);
    setError(null);

    const id = `mermaid-${reactId.replace(/:/g, "")}-${mermaidIdCounter++}`;

    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: theme === "dark" ? "dark" : "default",
        });
        const result = await mermaid.render(id, code);
        if (!cancelledRef.current) {
          setSvg(result.svg);
        }
      } catch (err) {
        if (!cancelledRef.current) {
          setError(err instanceof Error ? err.message : "Failed to render diagram");
        }
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [code, theme]);

  if (error) {
    return (
      <div className="rounded-md overflow-hidden mb-2">
        <div className="text-xs text-red-400 px-3 py-1.5 bg-red-900/20">
          Failed to render Mermaid diagram
        </div>
        <pre className="bg-[var(--bg-code)] rounded-b-md p-4 overflow-x-auto text-sm">
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="flex items-center justify-center py-8 text-[var(--text-muted)] text-sm">
        Loading diagram…
      </div>
    );
  }

  return (
    <div
      className="mermaid-diagram my-2 overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
