import React, { useState } from "react";
import { Icon } from "@mdi/react";
import { mdiFormatListBulleted } from "@mdi/js";
import type { InteractiveRendererProps } from "./types.js";
import { InlineMarkdown } from "./InlineMarkdown.js";
import { MarkdownContent } from "../MarkdownContent.js";
import { AnsweredOption } from "./AnsweredOption.js";
import { parseOption, isCancelOption } from "./parseOption.js";

const CUSTOM_OPTION_TITLE = "Other / custom response";

export function SelectRenderer({ params, status, result, onRespond, onCancel }: InteractiveRendererProps) {
  const title = params.title as string;
  const message = params.message as string | undefined;
  const options = (params.options as string[]) ?? [];
  const selectedValue = (result as any)?.value as string | undefined;
  const allowCustomAnswer = params.allowCustomAnswer === true;
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");

  if (status === "cancelled" || status === "dismissed") {
    return (
      <div className="mx-4 my-1 p-2 bg-[var(--bg-hover)] rounded text-xs flex items-center gap-2">
        <Icon path={mdiFormatListBulleted} size={0.55} className="text-[var(--text-secondary)] shrink-0" />
        <span className="text-[var(--text-secondary)]"><InlineMarkdown content={title} /></span>
        <span className="ml-1 text-[var(--text-tertiary)]">
          {status === "cancelled" ? "Cancelled" : "Answered in terminal"}
        </span>
      </div>
    );
  }

  if (status === "resolved") {
    const customSelected = selectedValue !== undefined && !options.includes(selectedValue);
    return (
      <div className="mx-4 my-1 p-3 bg-[var(--bg-hover)] rounded-lg text-xs">
        <div className="flex items-center gap-2 mb-2">
          <Icon path={mdiFormatListBulleted} size={0.55} className="text-[var(--text-secondary)] shrink-0" />
          <span className="text-[var(--text-primary)] font-medium"><InlineMarkdown content={title} /></span>
        </div>
        <div className="flex flex-col gap-1 ml-6">
          {options.map((option) => {
            const { title: oTitle, description } = parseOption(option);
            return (
              <AnsweredOption
                key={option}
                title={oTitle}
                description={description}
                picked={option === selectedValue}
              />
            );
          })}
          {customSelected && (
            <AnsweredOption
              title={selectedValue}
              description="Custom response"
              picked
            />
          )}
        </div>
      </div>
    );
  }

  const hasCancelOption = options.some(isCancelOption);

  return (
    <div className="mx-4 my-2 p-3 bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <Icon path={mdiFormatListBulleted} size={0.6} className="text-blue-400 shrink-0" />
        <span className="text-sm font-medium text-[var(--text-primary)]"><InlineMarkdown content={title} /></span>
      </div>
      {message && (
        <div className="text-xs text-[var(--text-secondary)] mb-3 ml-6"><MarkdownContent content={message} /></div>
      )}
      <div className="flex flex-col gap-1.5 ml-6">
        {options.map((option) => {
          const cancel = isCancelOption(option);
          const { title: oTitle, description } = parseOption(option);
          return (
            <OptionRow
              key={option}
              title={oTitle}
              description={cancel ? undefined : description}
              cancel={cancel}
              onClick={() => (cancel ? onCancel() : onRespond({ value: option }))}
            />
          );
        })}
        {allowCustomAnswer && (
          <CustomSelectRow
            open={customOpen}
            value={customValue}
            onOpen={() => setCustomOpen(true)}
            onChange={setCustomValue}
            onSubmit={() => {
              const trimmed = customValue.trim();
              if (trimmed) onRespond({ value: trimmed });
            }}
          />
        )}
        {!hasCancelOption && (
          <OptionRow title="Cancel" cancel onClick={onCancel} />
        )}
      </div>
    </div>
  );
}

function OptionRow({
  title,
  description,
  cancel,
  onClick,
}: {
  title: string;
  description?: string;
  cancel?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        cancel
          ? "w-full text-left flex items-start gap-2.5 px-3 py-2 rounded-lg border border-dashed border-[var(--border-secondary)] bg-transparent text-[var(--text-tertiary)] hover:border-red-500 hover:bg-red-500/10 transition-colors"
          : "w-full text-left flex items-start gap-2.5 px-3 py-2 rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-blue-500 hover:bg-blue-500/10 transition-colors"
      }
    >
      <span className="min-w-0">
        <span className="block text-xs font-medium">{title}</span>
        {description && (
          <span className="block text-[11px] text-[var(--text-tertiary)] mt-0.5">{description}</span>
        )}
      </span>
    </button>
  );
}

function CustomSelectRow({
  open,
  value,
  onOpen,
  onChange,
  onSubmit,
}: {
  open: boolean;
  value: string;
  onOpen: () => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  if (!open) {
    return (
      <OptionRow
        title={CUSTOM_OPTION_TITLE}
        description="Type a free-form answer instead of choosing above."
        onClick={onOpen}
      />
    );
  }

  const disabled = value.trim().length === 0;
  return (
    <form
      className="flex flex-col gap-2 px-3 py-2 rounded-lg border border-blue-500/40 bg-blue-500/10"
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled) onSubmit();
      }}
    >
      <label className="text-xs font-medium text-[var(--text-primary)]" htmlFor="select-custom-answer">
        {CUSTOM_OPTION_TITLE}
      </label>
      <input
        id="select-custom-answer"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="w-full px-2 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border-secondary)] text-xs text-[var(--text-primary)]"
        placeholder="Type custom answer…"
        autoFocus
      />
      <button
        type="submit"
        disabled={disabled}
        className="self-start px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
      >
        Use custom answer
      </button>
    </form>
  );
}
