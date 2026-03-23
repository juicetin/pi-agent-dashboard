import React, { useState, useCallback, type ReactNode } from "react";
import Icon from "@mdi/react";
import { mdiCheck } from "@mdi/js";

interface Props {
  text: string;
  icon: ReactNode;
  title: string;
}

export function CopyButton({ text, icon, title }: Props) {
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — fail silently
    }
  }, [text]);

  return (
    <button
      onClick={handleClick}
      title={title}
      className="px-1.5 py-0.5 text-xs text-gray-400 hover:text-white rounded hover:bg-gray-700 transition-colors inline-flex items-center"
    >
      {copied ? <Icon path={mdiCheck} size={0.6} /> : icon}
    </button>
  );
}
