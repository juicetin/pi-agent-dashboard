import React, { useState } from "react";
import { Icon } from "@mdi/react";
import { mdiCheckCircle, mdiCheckboxMarkedOutline } from "@mdi/js";
import type { InteractiveRendererProps } from "./types.js";
import { InlineMarkdown } from "./InlineMarkdown.js";
import { MarkdownContent } from "../MarkdownContent.js";
import { AnsweredOption } from "./AnsweredOption.js";

const CUSTOM_OPTION_TITLE = "Other / custom response";

export function MultiselectRenderer({ params, status, result, onRespond, onCancel }: InteractiveRendererProps) {
  const title = params.title as string;
  const message = params.message as string | undefined;
  const options = (params.options as string[]) ?? [];
  const selectedValues = (result as any)?.values as string[] | undefined;
  const allowCustomAnswer = params.allowCustomAnswer === true;

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [customValue, setCustomValue] = useState("");

  const checkedOptionCount = options.filter((option) => checked.has(option)).length;
  const allChecked = options.length > 0 && checkedOptionCount === options.length;

  function toggle(option: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(option)) next.delete(option);
      else next.add(option);
      return next;
    });
  }

  function toggleAll() {
    setChecked((prev) => {
      const custom = [...prev].filter((value) => !options.includes(value));
      if (allChecked) return new Set(custom);
      return new Set([...options, ...custom]);
    });
  }

  function addCustomValue() {
    const trimmed = customValue.trim();
    if (!trimmed) return;
    setChecked((prev) => new Set([...prev, trimmed]));
    setCustomValue("");
  }

  if (status === "cancelled" || status === "dismissed") {
    return (
      <div className="mx-4 my-1 p-2 bg-[var(--bg-hover)] rounded text-xs flex items-center gap-2">
        <Icon path={mdiCheckboxMarkedOutline} size={0.55} className="text-[var(--text-secondary)] shrink-0" />
        <span className="text-[var(--text-secondary)]"><InlineMarkdown content={title} /></span>
        <span className="ml-1 text-[var(--text-tertiary)]">
          {status === "cancelled" ? "Cancelled" : "Answered in terminal"}
        </span>
      </div>
    );
  }

  if (status === "resolved") {
    const picks = selectedValues ?? [];
    const customPicks = picks.filter((value) => !options.includes(value));
    const totalOptions = options.length + customPicks.length;
    return (
      <div className="mx-4 my-1 p-3 bg-[var(--bg-hover)] rounded-lg text-xs">
        <div className="flex items-center gap-2 mb-2">
          <Icon path={mdiCheckboxMarkedOutline} size={0.55} className="text-[var(--text-secondary)] shrink-0" />
          <span className="text-[var(--text-primary)] font-medium"><InlineMarkdown content={title} /></span>
          <span className="ml-auto inline-flex items-center gap-0.5 text-green-400">
            <Icon path={mdiCheckCircle} size={0.5} /> {picks.length} of {totalOptions}
          </span>
        </div>
        <div className="flex flex-col gap-1 ml-6">
          {options.map((option) => (
            <AnsweredOption key={option} title={option} picked={picks.includes(option)} />
          ))}
          {customPicks.map((value) => (
            <AnsweredOption key={value} title={value} description="Custom response" picked />
          ))}
        </div>
      </div>
    );
  }

  const customChecked = [...checked].filter((value) => !options.includes(value));
  const customSubmitDisabled = customValue.trim().length === 0;

  return (
    <div className="mx-4 my-2 p-3 bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <Icon path={mdiCheckboxMarkedOutline} size={0.6} className="text-blue-400 shrink-0" />
        <span className="text-sm font-medium text-[var(--text-primary)]"><InlineMarkdown content={title} /></span>
      </div>
      {message && (
        <div className="text-xs text-[var(--text-secondary)] mb-3 ml-6"><MarkdownContent content={message} /></div>
      )}
      <div className="flex flex-col gap-1 ml-6 mb-2">
        {options.length > 0 && (
          <>
            <label
              data-testid="select-all-row"
              className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[var(--bg-surface)] rounded px-2 py-1 transition-colors text-[var(--text-tertiary)] italic"
            >
              <input
                type="checkbox"
                checked={allChecked}
                onChange={toggleAll}
                className="accent-blue-500"
              />
              <span>Select all</span>
            </label>
            <div className="border-t border-[var(--border-subtle)] my-1" />
          </>
        )}
        {options.map((option) => (
          <label
            key={option}
            className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[var(--bg-surface)] rounded px-2 py-1 transition-colors"
          >
            <input
              type="checkbox"
              checked={checked.has(option)}
              onChange={() => toggle(option)}
              className="accent-blue-500"
            />
            <span className="text-[var(--text-primary)]">{option}</span>
          </label>
        ))}
        {allowCustomAnswer && (
          <form
            className="flex flex-col gap-2 mt-1 px-2 py-2 rounded-lg border border-blue-500/30 bg-blue-500/5"
            onSubmit={(event) => {
              event.preventDefault();
              addCustomValue();
            }}
          >
            <label className="text-xs font-medium text-[var(--text-primary)]" htmlFor="multiselect-custom-answer">
              {CUSTOM_OPTION_TITLE}
            </label>
            <div className="flex gap-2">
              <input
                id="multiselect-custom-answer"
                value={customValue}
                onChange={(event) => setCustomValue(event.currentTarget.value)}
                className="min-w-0 flex-1 px-2 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border-secondary)] text-xs text-[var(--text-primary)]"
                placeholder="Type custom answer…"
              />
              <button
                type="submit"
                disabled={customSubmitDisabled}
                className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
              >
                Add
              </button>
            </div>
          </form>
        )}
        {customChecked.map((value) => (
          <label
            key={value}
            className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[var(--bg-surface)] rounded px-2 py-1 transition-colors"
          >
            <input
              type="checkbox"
              checked={checked.has(value)}
              onChange={() => toggle(value)}
              className="accent-blue-500"
            />
            <span className="text-[var(--text-primary)]">{value}</span>
            <span className="text-[10px] text-[var(--text-tertiary)]">Custom</span>
          </label>
        ))}
      </div>
      <div className="flex gap-2 ml-6">
        <button
          onClick={() => onRespond({ values: Array.from(checked) })}
          className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          Submit{checked.size > 0 ? ` (${checked.size})` : ""}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 text-xs rounded bg-transparent hover:bg-[var(--bg-surface)] text-[var(--text-tertiary)] border border-[var(--border-secondary)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
