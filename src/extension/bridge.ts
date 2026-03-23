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
  let cachedHasUI: boolean | undefined;

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
    },
    onReconnect: () => {
      sendStateSync();
    },
  });

  const commandHandler = createCommandHandler(pi, sessionId);

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
    connection.send({
      type: "session_register",
      sessionId,
      cwd: process.cwd(),
      source: detectSessionSource(cachedHasUI),
    });

    // Send commands list
    const commands = pi.getCommands();
    connection.send({
      type: "commands_list",
      sessionId,
      commands,
    });
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
    pi.on(eventType as any, async (event: any) => {
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
    connection.connect();

    // Register session
    connection.send({
      type: "session_register",
      sessionId,
      cwd: ctx.cwd,
      source: detectSessionSource(cachedHasUI),
    });

    // Send initial commands list
    const commands = pi.getCommands();
    connection.send({
      type: "commands_list",
      sessionId,
      commands,
    });

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
    }, OPENSPEC_POLL_INTERVAL);
  });

  pi.on("turn_end", async (event, ctx) => {
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
