import React, { useState } from "react";

interface Props {
  changeName: string;
  onSend: (text: string) => void;
  onClose: () => void;
}

export function ExploreDialog({ changeName, onSend, onClose }: Props) {
  const [text, setText] = useState("");

  const handleSend = () => {
    if (text.trim()) {
      onSend(text.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSend();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="explore-dialog">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-lg p-4 max-w-md w-full mx-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-300">Explore: {changeName}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xs">✕</button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What do you want to explore?"
          className="w-full h-24 bg-gray-800 border border-gray-700 rounded p-2 text-sm text-gray-300 resize-none focus:outline-none focus:border-blue-500"
          autoFocus
          data-testid="explore-textarea"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded border border-gray-700 text-gray-400 hover:text-white"
            data-testid="explore-cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="explore-send"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
