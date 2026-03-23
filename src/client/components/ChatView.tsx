import React, { useRef, useEffect, useCallback } from "react";
import type { SessionState } from "../lib/event-reducer.js";
import { MarkdownContent } from "./MarkdownContent.js";
import { CopyButton } from "./CopyButton.js";
import { ToolCallStep } from "./ToolCallStep.js";

interface Props {
  state: SessionState;
}

function MessageBubble({ content, className }: { content: string; className: string }) {
  const contentRef = useRef<HTMLDivElement>(null);

  const getPlainText = useCallback(() => {
    return contentRef.current?.innerText ?? content;
  }, [content]);

  return (
    <div className={className}>
      <div ref={contentRef}>
        <MarkdownContent content={content} />
      </div>
      <div className="flex justify-end gap-0.5 mt-1 opacity-50 hover:opacity-100 transition-opacity">
        <CopyButton text={content} icon="📋" title="Copy as Markdown" />
        <CopyButton text={getPlainText()} icon="📝" title="Copy as plain text" />
      </div>
    </div>
  );
}

export function ChatView({ state }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [state.messages.length, state.streamingText]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
      {state.messages.map((msg) => {
        if (msg.role === "user") {
          return (
            <div key={msg.id} className="flex justify-end">
              <MessageBubble
                content={msg.content}
                className="bg-blue-600 rounded-lg px-4 py-2 max-w-[80%]"
              />
            </div>
          );
        }

        if (msg.role === "toolResult") {
          return (
            <ToolCallStep
              key={msg.id}
              toolName={msg.toolName ?? "unknown"}
              toolCallId={msg.toolCallId ?? msg.id}
              args={msg.args}
              status={msg.toolStatus ?? "running"}
              result={msg.result}
            />
          );
        }

        // assistant
        return (
          <div key={msg.id} className="flex justify-start">
            <MessageBubble
              content={msg.content}
              className="bg-gray-800 rounded-lg px-4 py-2 max-w-[80%]"
            />
          </div>
        );
      })}

      {/* Streaming text */}
      {state.streamingText && (
        <div className="flex justify-start">
          <div className="bg-gray-800 rounded-lg px-4 py-2 max-w-[80%]">
            <MarkdownContent content={state.streamingText} />
            <span className="inline-block w-1.5 h-4 bg-gray-400 animate-pulse ml-0.5" />
          </div>
        </div>
      )}

      {state.messages.length === 0 && !state.streamingText && (
        <div className="flex items-center justify-center h-full text-gray-500">
          <p>No messages yet</p>
        </div>
      )}
    </div>
  );
}
