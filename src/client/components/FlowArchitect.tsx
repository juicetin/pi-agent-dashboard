import React, { useState } from "react";
import { Icon } from "@mdi/react";
import { mdiChevronRight, mdiChevronDown, mdiLoading, mdiArrowLeft } from "@mdi/js";
import type { ArchitectState, ArchitectPrompt, FlowDetailEntry } from "../../shared/types.js";
import { MarkdownContent } from "./MarkdownContent.js";
import { FlowGraph, type FlowGraphStep } from "./FlowGraph.js";

/** Map ArchitectState.dagSteps to FlowGraphStep array (all pending) */
function architectStepsToGraphSteps(state: ArchitectState): FlowGraphStep[] {
  return state.dagSteps.map(step => ({
    id: step.id,
    label: step.agentName || step.id,
    status: "pending" as const,
    blockedBy: step.blockedBy,
    type: step.stepType === "flow-ref" ? "flow-ref" as const : "agent" as const,
  }));
}

// ── Detail view (reuses same patterns as FlowAgentDetail) ─────────

function extractInputPreview(toolName: string, input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const inp = input as Record<string, unknown>;
  switch (toolName.toLowerCase()) {
    case "read":
    case "write":
    case "edit":
      return String(inp.file_path || inp.path || "");
    case "bash":
      return String(inp.command || "").slice(0, 80);
    case "grep":
      return String(inp.pattern || "").slice(0, 40);
    default:
      return JSON.stringify(input).slice(0, 60);
  }
}

function ToolCallEntry({ entry }: { entry: FlowDetailEntry & { kind: "tool" } }) {
  const preview = extractInputPreview(entry.toolName, entry.input);
  const hasOutput = entry.output !== undefined;
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className={`border-l-2 pl-3 py-1.5 ${entry.isError ? "border-red-500/50" : "border-purple-500/30"}`}>
      <div
        className="flex items-center gap-1.5 cursor-pointer"
        onClick={() => hasOutput && setExpanded(!expanded)}
      >
        <span className={`text-xs font-mono ${entry.isError ? "text-red-400" : "text-purple-400"}`}>
          {entry.toolName}
        </span>
        <span className="text-xs text-[var(--text-tertiary)] truncate">{preview}</span>
        {hasOutput && (
          <span className="text-[10px] text-[var(--text-muted)] ml-auto flex-shrink-0">
            {expanded ? "▾" : "▸"}
          </span>
        )}
      </div>
      {expanded && hasOutput && (
        <pre className="text-[11px] text-[var(--text-secondary)] mt-1 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap break-words bg-[var(--bg-tertiary)] rounded p-2">
          {typeof entry.output === "string" ? entry.output : JSON.stringify(entry.output, null, 2)}
        </pre>
      )}
    </div>
  );
}

function TextEntry({ text }: { text: string }) {
  return (
    <div className="py-1.5 pl-3">
      <MarkdownContent content={text} />
    </div>
  );
}

function ThinkingEntry({ text }: { text: string }) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div className="py-1 pl-3">
      <div
        className="flex items-center gap-1 cursor-pointer text-[11px] text-purple-400/70"
        onClick={() => setExpanded(!expanded)}
      >
        <span>{expanded ? "▾" : "▸"}</span>
        <span>Thinking</span>
      </div>
      {expanded && (
        <pre className="text-[11px] text-[var(--text-muted)] mt-1 whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
          {text}
        </pre>
      )}
    </div>
  );
}

export function FlowArchitectDetail({
  state,
  onBack,
}: {
  state: ArchitectState;
  onBack: () => void;
}) {
  const isActive = state.phase === "context" || state.phase === "designing";
  const detailRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as new entries arrive
  React.useEffect(() => {
    if (detailRef.current) {
      detailRef.current.scrollTop = detailRef.current.scrollHeight;
    }
  }, [state.detailHistory.length]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex items-center gap-2">
        <button
          onClick={onBack}
          className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <Icon path={mdiArrowLeft} size={0.7} />
        </button>
        {isActive ? (
          <Icon path={mdiLoading} size={0.55} className="text-purple-400 animate-spin" />
        ) : (
          <span className="text-purple-400">◇</span>
        )}
        <span className="text-sm font-medium text-[var(--text-primary)]">Flow Architect</span>
        {state.flowName && (
          <span className="text-[11px] text-[var(--text-tertiary)]">{state.flowName}</span>
        )}
        <span className="text-[11px] text-[var(--text-muted)] ml-auto">
          {state.architectMode === "edit" ? "Edit" : "New"}
          {state.iteration > 1 && ` · Iteration ${state.iteration}`}
        </span>
      </div>

      {/* Detail history */}
      <div ref={detailRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {state.detailHistory.length === 0 ? (
          <div className="text-sm text-[var(--text-muted)] py-4 text-center">
            {isActive ? "Working..." : "No activity yet"}
          </div>
        ) : (
          state.detailHistory.map((entry, i) => {
            switch (entry.kind) {
              case "tool":
                return <ToolCallEntry key={i} entry={entry} />;
              case "text":
                return <TextEntry key={i} text={entry.text} />;
              case "thinking":
                return <ThinkingEntry key={i} text={entry.text} />;
              case "error":
                return (
                  <div key={i} className="py-1.5 pl-3 text-sm text-red-400">
                    {entry.text}
                  </div>
                );
              default:
                return null;
            }
          })
        )}
      </div>
    </div>
  );
}

// ── Card (shown in the sticky header bar) ─────────────────────────

// ── Inline prompt renderers ───────────────────────────────────────

function ArchitectSelectPrompt({
  prompt,
  onRespond,
}: {
  prompt: ArchitectPrompt;
  onRespond: (answer: string) => void;
}) {
  return (
    <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]">
      <div className="text-[11px] text-[var(--text-secondary)] mb-1.5">{prompt.question}</div>
      <div className="flex flex-wrap gap-1.5">
        {prompt.options?.map((opt) => (
          <button
            key={opt}
            onClick={() => onRespond(opt)}
            className={`text-[11px] px-2.5 py-1 rounded border transition-colors ${
              opt === "Cancel" || opt === "Don't save"
                ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                : opt === "Save"
                ? "border-green-500/30 text-green-400 hover:bg-green-500/10"
                : "border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function ArchitectInputPrompt({
  prompt,
  onRespond,
}: {
  prompt: ArchitectPrompt;
  onRespond: (answer: string) => void;
}) {
  const [value, setValue] = React.useState(prompt.defaultValue || "");
  const handleSubmit = () => {
    if (value.trim()) onRespond(value.trim());
  };
  return (
    <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]">
      <div className="text-[11px] text-[var(--text-secondary)] mb-1.5">{prompt.question}</div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className="flex-1 text-[11px] px-2 py-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] outline-none focus:border-purple-500/50"
          placeholder="Enter a value..."
          autoFocus
        />
        <button
          onClick={handleSubmit}
          className="text-[11px] px-2.5 py-1 rounded border border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
        >
          Submit
        </button>
      </div>
    </div>
  );
}

function ArchitectConfirmPrompt({
  prompt,
  onRespond,
}: {
  prompt: ArchitectPrompt;
  onRespond: (answer: string) => void;
}) {
  return (
    <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]">
      <div className="text-[11px] text-[var(--text-secondary)] mb-1.5">{prompt.question}</div>
      <div className="flex gap-1.5">
        <button
          onClick={() => onRespond("true")}
          className="text-[11px] px-2.5 py-1 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10"
        >
          Yes
        </button>
        <button
          onClick={() => onRespond("false")}
          className="text-[11px] px-2.5 py-1 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10"
        >
          No
        </button>
      </div>
    </div>
  );
}

function ArchitectPromptInline({
  prompt,
  onRespond,
}: {
  prompt: ArchitectPrompt;
  onRespond: (answer: string) => void;
}) {
  switch (prompt.type) {
    case "select":
      return <ArchitectSelectPrompt prompt={prompt} onRespond={onRespond} />;
    case "input":
      return <ArchitectInputPrompt prompt={prompt} onRespond={onRespond} />;
    case "confirm":
      return <ArchitectConfirmPrompt prompt={prompt} onRespond={onRespond} />;
    default:
      return null;
  }
}

// ── Collapsible section component ─────────────────────────────────

function AccordionSection({
  title,
  badge,
  expanded,
  onToggle,
  maxHeight = 200,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  maxHeight?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-[var(--border-subtle)] rounded mt-1.5">
      <div
        className="flex items-center gap-1.5 px-2 py-1 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
        onClick={onToggle}
      >
        <Icon path={expanded ? mdiChevronDown : mdiChevronRight} size={0.5} className="text-[var(--text-muted)] shrink-0" />
        <span className="text-[11px] font-medium text-[var(--text-secondary)] truncate">{title}</span>
        {badge && <span className="ml-auto shrink-0">{badge}</span>}
      </div>
      {expanded && (
        <div className="px-2 pb-2 overflow-y-auto" style={{ maxHeight }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Agent chip component ─────────────────────────────────────────

function AgentChip({ agent }: { agent: import("../../shared/types.js").ArchitectAgentEntry }) {
  const [expanded, setExpanded] = useState(false);
  const icon = agent.status === "done" ? "✓" : agent.status === "creating" ? "…" : agent.status === "error" ? "✗" : "○";
  const color = agent.status === "done" ? "text-green-400" : agent.status === "creating" ? "text-yellow-400" : agent.status === "error" ? "text-red-400" : "text-[var(--text-muted)]";

  return (
    <div>
      <span
        onClick={() => agent.source && setExpanded(!expanded)}
        className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-[var(--border-subtle)] ${agent.source ? "cursor-pointer hover:bg-[var(--bg-tertiary)]" : ""}`}
      >
        <span className={color}>{icon}</span>
        <span className="text-[var(--text-primary)]">{agent.name}</span>
        {agent.source && <span className="text-[var(--text-muted)]">{expanded ? "▾" : "▸"}</span>}
      </span>
      {expanded && agent.source && (
        <pre className="text-[10px] text-[var(--text-secondary)] mt-1 overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap break-words bg-[var(--bg-tertiary)] rounded p-2 border border-[var(--border-subtle)]">
          {agent.source}
        </pre>
      )}
    </div>
  );
}

// ── Card (shown in the sticky header bar) ─────────────────────────

export function FlowArchitect({
  state,
  onAbort,
  onClick,
  onPromptRespond,
  onViewYaml,
}: {
  state: ArchitectState;
  onAbort: () => void;
  onClick?: () => void;
  onPromptRespond?: (promptId: string, answer: string) => void;
  onViewYaml?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const isActive = state.phase === "context" || state.phase === "designing";
  const isPreview = state.phase === "preview";

  // Accordion section states — flow expanded during preview, process during designing
  const [flowExpanded, setFlowExpanded] = useState(isPreview);
  const [agentsExpanded, setAgentsExpanded] = useState(false);
  const [processExpanded, setProcessExpanded] = useState(isActive);

  // Sync defaults when phase changes
  React.useEffect(() => {
    if (isPreview) {
      setFlowExpanded(true);
      setProcessExpanded(false);
    } else if (isActive) {
      setProcessExpanded(true);
    }
  }, [state.phase]);

  const customAgents = state.agents.filter(a => a.type === "custom");
  const customDoneCount = customAgents.filter(a => a.status === "done").length;
  const firstFlow = state.parsedFlows[0];

  return (
    <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] px-3 py-2">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="inline-flex text-[var(--text-tertiary)] cursor-pointer"
          onClick={() => setCollapsed(!collapsed)}
        >
          <Icon path={collapsed ? mdiChevronRight : mdiChevronDown} size={0.6} />
        </span>
        <span className="text-purple-400 text-sm font-medium">π</span>
        <span className="text-sm text-[var(--text-primary)] truncate flex-1">
          Flow Architect
          <span className="text-[var(--text-tertiary)] ml-1.5">
            {state.phase === "context" ? "Analyzing conversation..." :
             state.phase === "designing" ? (state.flowName ? `Designing: ${state.flowName}` : "Designing...") :
             state.phase === "preview" ? (state.flowName ? `Preview: ${state.flowName}` : "Preview") :
             ""}
          </span>
        </span>

        {/* Model + alias */}
        {state.resolvedModel && (
          <span className="text-[10px] text-[var(--text-muted)] shrink-0">
            {state.resolvedModel.split("/").pop()}
            {state.modelAlias?.startsWith("@") && (
              <span className="text-[var(--text-tertiary)] ml-0.5">{state.modelAlias}</span>
            )}
          </span>
        )}

        {/* Iteration badge */}
        {state.iteration > 1 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-purple-500/30 text-purple-400">
            Iteration {state.iteration}
          </span>
        )}

        {/* Mode badge */}
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
          state.architectMode === "edit"
            ? "border-yellow-500/30 text-yellow-400"
            : "border-purple-500/30 text-purple-400"
        }`}>
          {state.architectMode === "edit" ? "Edit" : "New"}
        </span>

        {/* Abort button - show during active design, preview, or when prompt is pending */}
        {(isActive || isPreview || state.pendingPrompt) && (
          <button
            onClick={(e) => { e.stopPropagation(); onAbort(); }}
            className="text-[10px] px-1.5 py-0.5 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10"
            title="Abort architect"
          >
            Abort
          </button>
        )}
      </div>

      {/* Accordion sections — collapsible */}
      <div className={`group-collapse ${collapsed ? "collapsed" : "expanded"}`}>
        <div>
          {/* Section 1: Designed Flow (primary) */}
          {state.dagSteps.length > 0 && (
            <AccordionSection
              title="Designed Flow"
              badge={firstFlow && (
                <span className="text-[10px] text-[var(--text-muted)]">
                  {firstFlow.steps.length} steps · max {firstFlow.maxConcurrent}
                </span>
              )}
              expanded={flowExpanded}
              onToggle={() => setFlowExpanded(!flowExpanded)}
              maxHeight={180}
            >
              <div
                onClick={onViewYaml}
                style={{ cursor: onViewYaml ? "pointer" : "default" }}
              >
                <FlowGraph
                  steps={architectStepsToGraphSteps(state)}
                  onGraphClick={onViewYaml}
                />
              </div>
            </AccordionSection>
          )}

          {/* Section 2: Created Agents (secondary) */}
          {customAgents.length > 0 && (
            <AccordionSection
              title="Created Agents"
              badge={
                <span className="text-[10px] text-[var(--text-muted)]">
                  new: {customDoneCount}
                </span>
              }
              expanded={agentsExpanded}
              onToggle={() => setAgentsExpanded(!agentsExpanded)}
              maxHeight={200}
            >
              <div className="flex flex-wrap gap-1.5">
                {customAgents.map(agent => (
                  <AgentChip key={agent.name} agent={agent} />
                ))}
              </div>
            </AccordionSection>
          )}

          {/* Section 3: Architect Process (tertiary) — clickable for full detail */}
          <AccordionSection
            title="Architect Process"
            badge={state.lastToolCall && (
              <span className="text-[10px] text-[var(--text-tertiary)] truncate max-w-[200px] inline-block">
                {state.lastToolCall.toolName}
              </span>
            )}
            expanded={processExpanded}
            onToggle={() => setProcessExpanded(!processExpanded)}
            maxHeight={200}
          >
            <div>
              {/* Summary info */}
              {state.catalogSummary && (
                <div className="text-[10px] text-[var(--text-muted)] mb-1">{state.catalogSummary}</div>
              )}
              {/* Recent tool calls */}
              <div className="space-y-0">
                {state.recentTools.map((tool, i) => (
                  <div key={i} className="text-[10px] text-[var(--text-tertiary)] truncate">
                    {i === state.recentTools.length - 1 ? "▸" : "·"} {tool.toolName} {tool.inputPreview}
                  </div>
                ))}
              </div>
              {/* Link to full detail view */}
              {onClick && (
                <div
                  onClick={onClick}
                  className="text-[10px] text-purple-400 mt-1.5 cursor-pointer hover:underline"
                >
                  View full detail →
                </div>
              )}
            </div>
          </AccordionSection>
        </div>
      </div>

      {/* Inline prompt (Save/Replan/Cancel etc.) */}
      {state.pendingPrompt && onPromptRespond && (
        <ArchitectPromptInline
          prompt={state.pendingPrompt}
          onRespond={(answer) => onPromptRespond(state.pendingPrompt!.id, answer)}
        />
      )}

      {/* Error display */}
      {state.error && (
        <div className="text-[11px] text-red-400 mt-1.5 px-1">
          ⚠ {state.error}
        </div>
      )}
    </div>
  );
}
