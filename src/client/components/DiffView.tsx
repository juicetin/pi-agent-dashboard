import React from "react";

interface Props {
  content: string;
}

export function DiffView({ content }: Props) {
  const lines = content.split("\n");

  return (
    <div className="font-mono text-xs overflow-x-auto">
      {lines.map((line, i) => {
        let bgColor = "";
        let textColor = "text-[var(--text-secondary)]";

        if (line.startsWith("+") && !line.startsWith("+++")) {
          bgColor = "bg-green-900/30";
          textColor = "text-green-400";
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          bgColor = "bg-red-900/30";
          textColor = "text-red-400";
        } else if (line.startsWith("@@")) {
          textColor = "text-blue-400";
        }

        return (
          <div key={i} className={`px-2 ${bgColor} ${textColor}`}>
            {line || " "}
          </div>
        );
      })}
    </div>
  );
}
