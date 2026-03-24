/**
 * PI Dashboard Bridge Extension
 *
 * Global extension that connects to the dashboard server,
 * forwards all pi events, and relays commands back.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { ConnectionManager } from "./connection.js";
import { detectSessionSource } from "./source-detector.js";
import { mapEventToProtocol } from "./event-forwarder.js";
import { createCommandHandler } from "./command-handler.js";
import { loadConfig, ensureConfig } from "../shared/config.js";
import { isPortOpen } from "./server-probe.js";
import { launchServer } from "./server-launcher.js";
import type { ServerToExtensionMessage } from "../shared/protocol.js";
import { gatherGitInfo, type GitInfo } from "./git-info.js";
import { extractTurnStats } from "./stats-extractor.js";
import { pollOpenSpec } from "./openspec-poller.js";

const HEARTBEAT_INTERVAL = 15_000;
const GIT_POLL_INTERVAL = 30_000;
const OPENSPEC_POLL_INTERVAL = 30_000;

export default function (pi: ExtensionAPI) {
  const sessionId = crypto.randomUUID();
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let gitPollTimer: ReturnType<typeof setInterval> | null = null;
  let openspecPollTimer: ReturnType<typeof setInterval> | null = null;
  let lastGitBranch: string | undefined;
  let lastGitPrNumber: number | undefined;
  let lastOpenSpecJson: string | undefined;
  let lastSessionName: string | undefined;
  let cachedHasUI: boolean | undefined;
  let cachedModelRegistry: any | undefined;
  let cachedCtx: any | undefined;
  let lastModel: string | undefined;
  let lastThinkingLevel: string | undefined;

  // Load config to determine WebSocket URL
  ensureConfig();
  const config = loadConfig();
  const dashboardUrl = process.env.PI_DASHBOARD_URL ?? `ws://localhost:${config.piPort}`;

  const connection = new ConnectionManager({
    url: dashboardUrl,
    onMessage: (data) => {
      const msg = data as ServerToExtensionMessage;
      const response = commandHandler.handle(msg);
      if (response) connection.send(response);
      // Force openspec refresh and update cache
      if (msg.type === "openspec_refresh") {
        sendOpenSpecNow(process.cwd());
      }
      // Immediately send model/thinking update after handling set_thinking_level
      if (msg.type === "set_thinking_level") {
        // Small delay to let pi process the level change
        setTimeout(() => sendModelUpdateIfChanged(), 50);
      }
    },
    onReconnect: () => {
      sendStateSync();
    },
  });

  const commandHandler = createCommandHandler(pi, sessionId, {
    getModelRegistry: () => cachedModelRegistry,
    setThinkingLevel: (level: string) => (pi as any).setThinkingLevel?.(level),
    getThinkingLevel: () => (pi as any).getThinkingLevel?.(),
    shutdown: () => {
      if (cachedCtx?.shutdown) {
        cachedCtx.shutdown();
      } else {
        process.exit(0);
      }
    },
    abort: () => {
      if (cachedCtx?.abort) {
        cachedCtx.abort();
      }
    },
  });

  function sendOpenSpecIfChanged(cwd: string) {
    const data = pollOpenSpec(cwd);
    const json = JSON.stringify(data);
    if (json === lastOpenSpecJson) return;
    lastOpenSpecJson = json;
    connection.send({
      type: "openspec_update",
      sessionId,
      data,
    });
  }

  function sendOpenSpecNow(cwd: string) {
    const data = pollOpenSpec(cwd);
    lastOpenSpecJson = JSON.stringify(data);
    connection.send({
      type: "openspec_update",
      sessionId,
      data,
    });
  }

  function getCurrentModelString(): string | undefined {
    const model = cachedCtx?.model;
    if (!model) return undefined;
    return `${model.provider}/${model.id}`;
  }

  function sendModelUpdateIfChanged() {
    const model = getCurrentModelString();
    const thinkingLevel = (pi as any).getThinkingLevel?.() ?? undefined;
    if (model === lastModel && thinkingLevel === lastThinkingLevel) return;
    lastModel = model;
    lastThinkingLevel = thinkingLevel;
    if (model) {
      connection.send({
        type: "model_update",
        sessionId,
        model,
        thinkingLevel,
      });
    }
  }

  function sendSessionNameIfChanged() {
    const name = pi.getSessionName() ?? "";
    if (name === lastSessionName) return;
    lastSessionName = name;
    connection.send({
      type: "session_name_update",
      sessionId,
      name,
    });
  }

  function sendGitInfoIfChanged(cwd: string) {
    const info = gatherGitInfo(cwd);
    if (!info) return;
    if (info.gitBranch === lastGitBranch && info.gitPrNumber === lastGitPrNumber) return;
    lastGitBranch = info.gitBranch;
    lastGitPrNumber = info.gitPrNumber;
    connection.send({
      type: "git_info_update",
      sessionId,
      ...info,
    });
  }

  function sendStateSync() {
    // Re-register session on reconnect
    const model = getCurrentModelString();
    const thinkingLevel = (pi as any).getThinkingLevel?.() ?? undefined;
    lastModel = model;
    lastThinkingLevel = thinkingLevel;
    connection.send({
      type: "session_register",
      sessionId,
      cwd: process.cwd(),
      name: pi.getSessionName() ?? undefined,
      source: detectSessionSource(cachedHasUI),
      model,
      thinkingLevel,
    });

    // Send current openspec data
    sendOpenSpecNow(process.cwd());

    // Send commands list
    const commands = pi.getCommands();
    connection.send({
      type: "commands_list",
      sessionId,
      commands,
    });

    // Send models list
    if (cachedModelRegistry) {
      try {
        const models = cachedModelRegistry.getAvailable().map((m: any) => ({
          provider: m.provider,
          id: m.id,
        }));
        connection.send({ type: "models_list", sessionId, models });
      } catch { /* ignore */ }
    }
  }

  // Forward all relevant pi events
  const eventTypes = [
    "agent_start",
    "agent_end",
    "turn_start",
    "turn_end",
    "message_start",
    "message_update",
    "message_end",
    "tool_execution_start",
    "tool_execution_update",
    "tool_execution_end",
    "session_compact",
    "session_switch",
    "model_select",
  ] as const;

  for (const eventType of eventTypes) {
    pi.on(eventType as any, async (event: any, ctx: any) => {
      // Always keep latest context for abort/shutdown
      cachedCtx = ctx;
      // For model_select, enrich the event data with thinkingLevel
      if (eventType === "model_select") {
        const enriched = { ...event, thinkingLevel: (pi as any).getThinkingLevel?.() };
        const msg = mapEventToProtocol(sessionId, enriched);
        connection.send(msg);
        // Also send a model_update for session-level tracking
        sendModelUpdateIfChanged();
        return;
      }
      const msg = mapEventToProtocol(sessionId, event);
      connection.send(msg);
    });
  }

  pi.on("session_start", async (_event, ctx) => {
    // Auto-start server if not running
    const serverRunning = await isPortOpen(config.piPort);

    if (!serverRunning && config.autoStart) {
      const result = await launchServer(config);
      if (result.success) {
        ctx.ui.notify(`🌐 Dashboard started at http://localhost:${config.port}`, "info");
      } else {
        ctx.ui.notify(`Dashboard server failed to start: ${result.message}`, "warning");
      }
    }

    cachedHasUI = ctx.hasUI;
    cachedCtx = ctx;
    connection.connect();

    // Register session with initial model/thinkingLevel
    lastSessionName = pi.getSessionName() ?? "";
    const initialModel = getCurrentModelString();
    const initialThinkingLevel = (pi as any).getThinkingLevel?.() ?? undefined;
    lastModel = initialModel;
    lastThinkingLevel = initialThinkingLevel;
    connection.send({
      type: "session_register",
      sessionId,
      cwd: ctx.cwd,
      name: lastSessionName || undefined,
      source: detectSessionSource(cachedHasUI),
      model: initialModel,
      thinkingLevel: initialThinkingLevel,
    });

    // Send initial commands list
    const commands = pi.getCommands();
    connection.send({
      type: "commands_list",
      sessionId,
      commands,
    });

    // Send available models
    cachedModelRegistry = (ctx as any).modelRegistry;
    if (cachedModelRegistry) {
      try {
        const models = cachedModelRegistry.getAvailable().map((m: any) => ({
          provider: m.provider,
          id: m.id,
        }));
        connection.send({ type: "models_list", sessionId, models });
      } catch { /* modelRegistry not available */ }
    }

    // Send initial git info
    sendGitInfoIfChanged(ctx.cwd);

    // Start heartbeat
    heartbeatTimer = setInterval(() => {
      connection.send({
        type: "session_heartbeat",
        sessionId,
      });
    }, HEARTBEAT_INTERVAL);

    // Start git info polling
    gitPollTimer = setInterval(() => {
      sendGitInfoIfChanged(ctx.cwd);
    }, GIT_POLL_INTERVAL);

    // Send initial openspec data and start polling
    sendOpenSpecIfChanged(ctx.cwd);
    openspecPollTimer = setInterval(() => {
      sendOpenSpecIfChanged(ctx.cwd);
      sendSessionNameIfChanged();
      sendModelUpdateIfChanged();
    }, OPENSPEC_POLL_INTERVAL);
  });

  pi.on("turn_end", async (event, ctx) => {
    cachedCtx = ctx;
    const stats = extractTurnStats(
      event as Record<string, unknown>,
      ctx.getContextUsage(),
    );

    if (stats) {
      connection.send({
        type: "stats_update",
        sessionId,
        stats: stats as any,
      });
    }
  });

  pi.on("session_shutdown", async () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (gitPollTimer) {
      clearInterval(gitPollTimer);
      gitPollTimer = null;
    }
    if (openspecPollTimer) {
      clearInterval(openspecPollTimer);
      openspecPollTimer = null;
    }

    connection.send({
      type: "session_unregister",
      sessionId,
    });

    // Give time for the unregister to send
    await new Promise((resolve) => setTimeout(resolve, 100));
    connection.disconnect();
  });
}
