/**
 * LLM section (self-host only) — model dropdown, route override, credential editors.
 * Tasks 6.8a through 6.8e.
 */
import React, { useState, useEffect, useCallback } from "react";
import Icon from "@mdi/react";
import {
  mdiChevronDown,
  mdiRefresh,
  mdiCheck,
  mdiAlert,
  mdiMagnify,
  mdiLoading,
} from "@mdi/js";
import { fetchModels, refreshModels, saveConfig } from "./api.js";
import type {
  RedactedHonchoPluginConfig,
  HonchoPluginConfig,
  AggregateModelsResponse,
  LlmSource,
  ModelEntry,
} from "../shared/types.js";

const SOURCE_LABELS: Record<LlmSource, string> = {
  "pi-model-proxy": "via pi-model-proxy",
  anthropic: "via Anthropic direct",
  openai: "via OpenAI direct",
  gemini: "via Gemini direct",
  "openai-compatible": "via OpenAI-compatible",
};

const SOURCE_ORDER: LlmSource[] = [
  "pi-model-proxy",
  "anthropic",
  "openai",
  "gemini",
  "openai-compatible",
];

interface Props {
  config: RedactedHonchoPluginConfig;
  onSave: (partial: Partial<HonchoPluginConfig>) => Promise<void>;
  saving: boolean;
}

export function LlmSection({ config, onSave, saving }: Props) {
  const [models, setModels] = useState<AggregateModelsResponse | null>(null);
  const [loadingModels, setLoadingModels] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedCredential, setExpandedCredential] = useState<LlmSource | null>(null);
  const [credKey, setCredKey] = useState("");
  const [credBaseUrl, setCredBaseUrl] = useState("");
  const [credSaving, setCredSaving] = useState(false);

  const currentModel = config.selfHost?.llm?.model ?? "";
  const currentSource = config.selfHost?.llm?.source ?? "pi-model-proxy";

  const loadModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      setModels(await fetchModels());
    } catch {
      /* ignore */
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const handleRefresh = async () => {
    setLoadingModels(true);
    try {
      await refreshModels();
      setModels(await fetchModels());
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSelect = async (source: LlmSource, modelId: string) => {
    setDropdownOpen(false);
    setSearch("");
    await onSave({ selfHost: { llm: { source, model: modelId } } });
  };

  // Find which sources have the currently selected model
  const sourcesWithCurrentModel: LlmSource[] = [];
  if (models && currentModel) {
    for (const src of SOURCE_ORDER) {
      const info = models.sources[src];
      if (info?.models.some((m) => m.id === currentModel)) {
        sourcesWithCurrentModel.push(src);
      }
    }
  }
  const showRouteOverride = sourcesWithCurrentModel.length > 1;

  const handleRouteChange = async (source: LlmSource) => {
    await onSave({ selfHost: { llm: { source } } });
  };

  const handleSaveCredential = async (source: LlmSource) => {
    setCredSaving(true);
    try {
      if (source === "openai-compatible") {
        await saveConfig({ selfHost: { llm: { baseUrl: credBaseUrl, apiKey: credKey || undefined } } });
      } else {
        await saveConfig({ selfHost: { llm: { apiKey: credKey } } });
      }
      await refreshModels(source);
      setModels(await fetchModels());
      setExpandedCredential(null);
      setCredKey("");
      setCredBaseUrl("");
    } finally {
      setCredSaving(false);
    }
  };

  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
        LLM Model
        <button
          onClick={handleRefresh}
          disabled={loadingModels}
          className="text-[10px] text-blue-400 hover:text-blue-300 disabled:opacity-50 inline-flex items-center gap-0.5"
          title="Refresh model list"
        >
          <Icon path={loadingModels ? mdiLoading : mdiRefresh} size={0.5} spin={loadingModels} />
          Refresh
        </button>
      </legend>

      {/* Current selection */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full text-left bg-[var(--bg-secondary)] text-[var(--text)] border border-[var(--border)] rounded px-2 py-1.5 text-xs flex items-center justify-between"
        >
          <span className="font-mono">
            {currentModel || "Select model…"}
          </span>
          <Icon path={mdiChevronDown} size={0.5} className="text-[var(--text-muted)]" />
        </button>

        {dropdownOpen && (
          <div className="absolute z-50 mt-1 w-full max-h-72 overflow-auto bg-[var(--bg-secondary)] border border-[var(--border)] rounded shadow-lg">
            <div className="sticky top-0 bg-[var(--bg-secondary)] p-1 border-b border-[var(--border)]">
              <div className="relative">
                <Icon
                  path={mdiMagnify}
                  size={0.5}
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search models…"
                  className="w-full bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] rounded pl-6 pr-2 py-1 text-xs"
                  autoFocus
                />
              </div>
            </div>
            {models &&
              SOURCE_ORDER.map((source) => {
                const info = models.sources[source];
                if (!info) return null;
                const filtered = info.models.filter(
                  (m) =>
                    !search ||
                    m.id.toLowerCase().includes(search.toLowerCase()) ||
                    m.displayName.toLowerCase().includes(search.toLowerCase()),
                );
                const isDisabled = !info.available;

                return (
                  <div key={source}>
                    <div className="px-2 py-1 text-[10px] font-semibold text-[var(--text-muted)] bg-[var(--bg)] flex items-center justify-between">
                      <span>
                        {SOURCE_LABELS[source]} ({info.models.length})
                      </span>
                      <span className="inline-flex items-center gap-1">
                        {info.reachable && !info.stale && (
                          <Icon path={mdiCheck} size={0.4} color="rgb(134, 239, 172)" />
                        )}
                        {info.stale && (
                          <span className="inline-flex items-center gap-0.5 text-yellow-400" title="Using bundled list">
                            <Icon path={mdiAlert} size={0.4} />
                            stale
                          </span>
                        )}
                        {isDisabled && (
                          <span className="text-[var(--text-muted)]">disabled</span>
                        )}
                      </span>
                    </div>
                    {isDisabled && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedCredential(expandedCredential === source ? null : source);
                        }}
                        className="w-full text-left px-3 py-1 text-[10px] text-blue-400 hover:bg-[var(--bg)]"
                      >
                        {source === "openai-compatible"
                          ? "Configure base URL"
                          : source === "pi-model-proxy"
                            ? "Install pi-model-proxy"
                            : `Add ${SOURCE_LABELS[source].replace("via ", "")} API key`}
                      </button>
                    )}
                    {expandedCredential === source && (
                      <CredentialInlineForm
                        source={source}
                        apiKey={credKey}
                        baseUrl={credBaseUrl}
                        onApiKeyChange={setCredKey}
                        onBaseUrlChange={setCredBaseUrl}
                        onSave={() => handleSaveCredential(source)}
                        saving={credSaving}
                      />
                    )}
                    {filtered.map((m) => (
                      <button
                        key={`${source}:${m.id}`}
                        onClick={() => !isDisabled && handleSelect(source, m.id)}
                        disabled={isDisabled}
                        className={`w-full text-left px-3 py-1 text-xs hover:bg-[var(--bg)] ${
                          isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                        } ${currentModel === m.id && currentSource === source ? "bg-blue-900/30" : ""}`}
                      >
                        <span className="font-mono text-[var(--text)]">{m.id}</span>
                        {m.notes && (
                          <span className="text-[10px] text-[var(--text-muted)] ml-2">{m.notes}</span>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Route override (6.8c) */}
      {showRouteOverride && (
        <label className="flex items-center gap-2 text-xs">
          <span className="text-[var(--text-muted)]">Route:</span>
          <select
            value={currentSource}
            onChange={(e) => handleRouteChange(e.target.value as LlmSource)}
            disabled={saving}
            className="bg-[var(--bg-secondary)] text-[var(--text)] border border-[var(--border)] rounded px-2 py-1 text-xs"
          >
            {sourcesWithCurrentModel.map((src) => (
              <option key={src} value={src}>
                {SOURCE_LABELS[src]}
              </option>
            ))}
          </select>
        </label>
      )}
    </fieldset>
  );
}

/** Inline credential editor for a source (6.8d, 6.8e). */
function CredentialInlineForm({
  source,
  apiKey,
  baseUrl,
  onApiKeyChange,
  onBaseUrlChange,
  onSave,
  saving,
}: {
  source: LlmSource;
  apiKey: string;
  baseUrl: string;
  onApiKeyChange: (v: string) => void;
  onBaseUrlChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const isOpenAICompat = source === "openai-compatible";

  return (
    <div className="px-3 py-2 space-y-1 bg-[var(--bg)] border-y border-[var(--border)]">
      {isOpenAICompat && (
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => onBaseUrlChange(e.target.value)}
          placeholder="Base URL (e.g. http://localhost:11434/v1)"
          className="w-full bg-[var(--bg-secondary)] text-[var(--text)] border border-[var(--border)] rounded px-2 py-1 text-xs font-mono"
        />
      )}
      <input
        type="password"
        value={apiKey}
        onChange={(e) => onApiKeyChange(e.target.value)}
        placeholder={isOpenAICompat ? "API key (optional)" : "API key"}
        className="w-full bg-[var(--bg-secondary)] text-[var(--text)] border border-[var(--border)] rounded px-2 py-1 text-xs font-mono"
      />
      <button
        onClick={onSave}
        disabled={saving || (!isOpenAICompat && !apiKey)}
        className="text-[10px] px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
