/**
 * Dashboard HTTP + WebSocket server.
 */
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMemoryEventStore, type EventStore } from "./memory-event-store.js";
import { createMemorySessionManager, type SessionManager } from "./memory-session-manager.js";
import { createPiGateway, type PiGateway } from "./pi-gateway.js";
import { createBrowserGateway, type BrowserGateway } from "./browser-gateway.js";
import { createStateStore, type StateStore } from "./state-store.js";
import { createSessionPersistence, type SessionPersistence } from "./session-persistence.js";
import { createSessionOrderManager, type SessionOrderManager } from "./session-order-manager.js";
import { createPendingForkRegistry, type PendingForkRegistry } from "./pending-fork-registry.js";

import { createPendingLoadManager, type PendingLoadManager } from "./pending-load-manager.js";
import { writePid, removePid } from "./server-pid.js";
import type { ApiResponse } from "../shared/types.js";
import { extractSessionUpdates } from "./event-status-extraction.js";
import { createTunnel, deleteTunnel } from "./tunnel.js";
import { detectEditors, EDITORS } from "./editor-registry.js";
import { localhostGuard } from "./localhost-guard.js";
import { spawn } from "node:child_process";

export interface ServerConfig {
  port: number;
  piPort: number;
  dev: boolean;
  autoShutdown: boolean;
  shutdownIdleSeconds: number;
  tunnel: boolean;
}

export interface DashboardServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  sessionManager: SessionManager;
  eventStore: EventStore;
  browserGateway: BrowserGateway;
}

export async function createServer(config: ServerConfig): Promise<DashboardServer> {
  const stateStore = createStateStore();
  const sessionManager = createMemorySessionManager(stateStore);
  const sessionPersistence = createSessionPersistence();
  const sessionOrderManager = createSessionOrderManager(stateStore);
  const pendingForkRegistry = createPendingForkRegistry();

  // Restore persisted sessions from previous server run
  for (const session of sessionPersistence.load()) {
    sessionManager.restore({ ...session, dataUnavailable: true });
  }

  // Save sessions to disk on any change
  sessionManager.onChange = () => {
    sessionPersistence.save(sessionManager.listAll());
  };

  const piGateway = createPiGateway(sessionManager);

  // Create event store with pinning callback
  const eventStore = createMemoryEventStore(
    (sessionId) =>
      piGateway.isSessionConnected(sessionId) ||
      browserGateway.getSubscriberCount(sessionId) > 0,
  );

  // Create pending load manager with timeout handler
  const pendingLoadManager = createPendingLoadManager((sessionId, browsers) => {
    // Timeout: send dataUnavailable to all waiting browsers
    sessionManager.update(sessionId, { dataUnavailable: true });
    browserGateway.broadcastSessionUpdated(sessionId, { dataUnavailable: true });
  });

  const browserGateway = createBrowserGateway(sessionManager, eventStore, piGateway, pendingLoadManager, pendingForkRegistry, sessionOrderManager, stateStore);

  // Handle bridge disconnect — cancel pending loads
  piGateway.onDisconnect = (bridgeSessionId) => {
    const cancelled = pendingLoadManager.cancelForBridge(bridgeSessionId);
    for (const [sessionId, browsers] of cancelled) {
      // Try another bridge
      const session = sessionManager.get(sessionId);
      const altBridge = session?.cwd ? piGateway.findSessionByCwd(session.cwd) : undefined;
      if (altBridge && session?.sessionFile) {
        // Retry with another bridge
        for (const ws of browsers) {
          pendingLoadManager.start(sessionId, ws, altBridge);
        }
        piGateway.sendToSession(altBridge, {
          type: "load_session_events",
          sessionId,
          sessionFile: session.sessionFile,
        });
      } else {
        // No alternative bridge — data unavailable
        sessionManager.update(sessionId, { dataUnavailable: true });
        browserGateway.broadcastSessionUpdated(sessionId, { dataUnavailable: true });
      }
    }
  };

  // Broadcast placeholder session to browsers when auto-created from early events
  piGateway.onSessionCreated = (sessionId) => {
    const session = sessionManager.get(sessionId);
    if (session) {
      browserGateway.broadcastSessionAdded(session);
    }
  };

  // Wire up event forwarding from pi gateway to browser gateway
  piGateway.onEvent = (sessionId, msg) => {
    if (msg.type === "event_forward") {
      const seq = eventStore.insertEvent(sessionId, msg.event);
      browserGateway.broadcastEvent(sessionId, seq, msg.event);

      // Extract status/tool updates from the event and broadcast
      const updates = extractSessionUpdates(msg.event);
      if (updates) {
        sessionManager.update(sessionId, updates);
        browserGateway.broadcastSessionUpdated(sessionId, updates);
      }
    }
    if (msg.type === "session_register") {
      // Always clear events — bridge replays full session history after registering
      eventStore.deleteEventsForSession(sessionId);
      // Force visible + clear dataUnavailable — active sessions must always be visible
      sessionManager.update(sessionId, { hidden: false, dataUnavailable: false });
      // Link headless PID to session ID (if spawned from dashboard)
      browserGateway.headlessPidRegistry.linkSession(sessionId, msg.cwd);

      // Insert into session order — check for pending fork to place after parent
      const forkParent = pendingForkRegistry.consumeFork(msg.cwd);
      sessionOrderManager.insert(msg.cwd, sessionId, forkParent ?? undefined);

      // Carry over attachedProposal only for forked/resumed sessions (not brand new spawns)
      if (forkParent) {
        const session = sessionManager.get(sessionId);
        if (session && !session.attachedProposal) {
          const donor = sessionManager.listAll().find(
            (s) => s.id !== sessionId && s.cwd === msg.cwd && s.status === "ended" && s.attachedProposal,
          );
          if (donor?.attachedProposal) {
            sessionManager.update(sessionId, { attachedProposal: donor.attachedProposal });
          }
        }
      }

      // Broadcast order update
      const validIds = new Set(sessionManager.listAll().filter((s) => s.cwd === msg.cwd).map((s) => s.id));
      const order = sessionOrderManager.getOrder(msg.cwd, validIds);
      browserGateway.broadcastToAll({ type: "sessions_reordered", cwd: msg.cwd, sessionIds: order });

      const updatedSession = sessionManager.get(sessionId);
      if (updatedSession) {
        browserGateway.broadcastSessionAdded(updatedSession);
      }
    }
    if (msg.type === "session_history_sync") {
      // Broadcast newly inserted historical sessions to browsers
      for (const hist of msg.sessions) {
        const session = sessionManager.get(hist.id);
        if (session && session.status === "ended") {
          browserGateway.broadcastSessionAdded(session);
        }
      }
    }
    if (msg.type === "session_unregister") {
      browserGateway.broadcastSessionRemoved(sessionId);
    }
    if (msg.type === "commands_list") {
      browserGateway.sendToSubscribers(sessionId, {
        type: "commands_list",
        sessionId,
        commands: msg.commands,
      });
    }
    if (msg.type === "git_info_update") {
      const gitUpdates = {
        gitBranch: msg.gitBranch,
        gitBranchUrl: msg.gitBranchUrl,
        gitPrNumber: msg.gitPrNumber,
        gitPrUrl: msg.gitPrUrl,
      };
      sessionManager.update(sessionId, gitUpdates);
      browserGateway.broadcastSessionUpdated(sessionId, gitUpdates);
    }
    if (msg.type === "files_list") {
      browserGateway.sendToSubscribers(sessionId, {
        type: "files_list",
        sessionId,
        query: msg.query,
        files: msg.files,
      });
    }
    if (msg.type === "openspec_update") {
      sessionManager.update(sessionId, { openspecData: JSON.stringify(msg.data) });
      browserGateway.sendToSubscribers(sessionId, {
        type: "openspec_update",
        sessionId,
        data: msg.data,
      });
    }
    if (msg.type === "openspec_activity_update") {
      const activityUpdates: Partial<import("../shared/types.js").DashboardSession> = {};
      if (msg.phase !== undefined) activityUpdates.openspecPhase = msg.phase;
      if (msg.changeName !== undefined) activityUpdates.openspecChange = msg.changeName;

      // Apply updates first so we can check accumulated state
      sessionManager.update(sessionId, activityUpdates);

      // Auto-attach: when both phase and changeName are accumulated and no proposal is attached
      const session = sessionManager.get(sessionId);
      const attachUpdates: Partial<import("../shared/types.js").DashboardSession> = {};
      if (session?.openspecPhase && session?.openspecChange && !session.attachedProposal) {
        attachUpdates.attachedProposal = session.openspecChange;
        // Auto-name if session name is empty
        if (!session.name?.trim()) {
          attachUpdates.name = session.openspecChange;
          piGateway.sendToSession(sessionId, {
            type: "rename_session",
            sessionId,
            name: session.openspecChange,
          });
        }
        sessionManager.update(sessionId, attachUpdates);
      }

      browserGateway.broadcastSessionUpdated(sessionId, {
        openspecPhase: msg.phase ?? null,
        openspecChange: msg.changeName ?? null,
        ...(attachUpdates.attachedProposal !== undefined ? { attachedProposal: attachUpdates.attachedProposal } : {}),
        ...(attachUpdates.name !== undefined ? { name: attachUpdates.name } : {}),
      });
    }
    if (msg.type === "models_list") {
      browserGateway.sendToSubscribers(sessionId, {
        type: "models_list",
        sessionId,
        models: msg.models,
      });
    }
    if (msg.type === "model_update") {
      const modelUpdates: Partial<import("../shared/types.js").DashboardSession> = {
        model: msg.model,
      };
      if (msg.thinkingLevel !== undefined) {
        modelUpdates.thinkingLevel = msg.thinkingLevel;
      }
      sessionManager.update(sessionId, modelUpdates);
      browserGateway.broadcastSessionUpdated(sessionId, modelUpdates);
    }
    if (msg.type === "session_name_update") {
      const nameUpdates = { name: msg.name || undefined };
      sessionManager.update(sessionId, nameUpdates);
      browserGateway.broadcastSessionUpdated(sessionId, nameUpdates);
    }
    if (msg.type === "sessions_list") {
      // Create in-memory records for sessions not already known
      for (const piSession of msg.sessions) {
        const existing = sessionManager.get(piSession.id);
        if (!existing) {
          sessionManager.register({
            id: piSession.id,
            cwd: piSession.cwd,
            name: piSession.name,
            source: "unknown",
            sessionFile: piSession.path,
            sessionDir: piSession.cwd,
            firstMessage: piSession.firstMessage,
          });
          sessionManager.unregister(piSession.id);
        } else if (existing.sessionFile !== piSession.path) {
          sessionManager.update(piSession.id, {
            sessionFile: piSession.path,
            sessionDir: piSession.cwd,
          });
        }
      }
      browserGateway.broadcastToAll({
        type: "sessions_list",
        sessionId,
        cwd: msg.cwd,
        sessions: msg.sessions,
      });
    }
    if (msg.type === "stats_update") {
      const session = sessionManager.get(sessionId);
      if (session) {
        browserGateway.broadcastSessionUpdated(sessionId, {
          tokensIn: session.tokensIn,
          tokensOut: session.tokensOut,
          cacheRead: session.cacheRead,
          cacheWrite: session.cacheWrite,
          cost: session.cost,
        });

      }

      const statsEvent = {
        eventType: "stats_update",
        timestamp: Date.now(),
        data: {
          tokensIn: msg.stats.tokensIn,
          tokensOut: msg.stats.tokensOut,
          cost: msg.stats.cost,
          turnUsage: msg.stats.turnUsage,
          contextUsage: msg.stats.contextUsage,
        },
      };
      const seq = eventStore.insertEvent(sessionId, statsEvent);
      browserGateway.broadcastEvent(sessionId, seq, statsEvent);
    }

    // Handle on-demand session load results from bridge
    if (msg.type === "load_session_events_result") {
      const loadSessionId = msg.sessionId;
      const browsers = pendingLoadManager.complete(loadSessionId);
      if (browsers) {
        // Insert events into memory buffer
        for (const evt of msg.events) {
          eventStore.insertEvent(loadSessionId, evt);
        }
        // Clear dataUnavailable
        sessionManager.update(loadSessionId, { dataUnavailable: false });
        browserGateway.broadcastSessionUpdated(loadSessionId, { dataUnavailable: false });
        // Send batch replay to all waiting browsers
        const stored = eventStore.getEvents(loadSessionId, 1);
        const replayMsg = {
          type: "event_replay" as const,
          sessionId: loadSessionId,
          events: stored.map((e) => ({ seq: e.seq, event: e.event })),
          isLast: true,
        };
        for (const ws of browsers) {
          if (ws.readyState === 1) { // WebSocket.OPEN
            ws.send(JSON.stringify(replayMsg));
          }
        }
      }
    }
    if (msg.type === "load_session_events_error") {
      const loadSessionId = msg.sessionId;
      const browsers = pendingLoadManager.complete(loadSessionId);
      if (browsers) {
        sessionManager.update(loadSessionId, { dataUnavailable: true });
        browserGateway.broadcastSessionUpdated(loadSessionId, { dataUnavailable: true });
      }
    }
  };

  // Auto-shutdown idle timer with sleep-wake resilience
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let stopServer: (() => Promise<void>) | null = null;
  let lastConnectionTimestamp = 0;

  function startIdleTimer() {
    if (!config.autoShutdown) return;
    cancelIdleTimer();
    idleTimer = setTimeout(async () => {
      // Double-check: verify truly idle before exiting (prevents false shutdown after sleep/wake)
      const realIdleMs = Date.now() - lastConnectionTimestamp;
      if (piGateway.connectionCount() > 0 || realIdleMs < config.shutdownIdleSeconds * 1000) {
        // Sessions reconnected or not truly idle — restart timer
        startIdleTimer();
        return;
      }
      console.log(`No pi sessions for ${config.shutdownIdleSeconds}s, shutting down...`);
      await stopServer?.();
      process.exit(0);
    }, config.shutdownIdleSeconds * 1000);
  }

  function cancelIdleTimer() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  piGateway.onEmpty = () => {
    startIdleTimer();
  };

  piGateway.onConnection = () => {
    lastConnectionTimestamp = Date.now();
    cancelIdleTimer();
  };

  const fastify = Fastify({ logger: false });

  // REST API routes
  fastify.get("/api/sessions", async () => {
    const sessions = sessionManager.listAll();
    return { success: true, data: sessions } satisfies ApiResponse;
  });

  fastify.get<{ Params: { sessionId: string; seq: string } }>(
    "/api/events/:sessionId/:seq",
    async (request) => {
      const { sessionId, seq } = request.params;
      const event = eventStore.getEvent(sessionId, parseInt(seq, 10));
      if (!event) {
        return { success: false, error: "Event not found" } satisfies ApiResponse;
      }
      return { success: true, data: event } satisfies ApiResponse;
    }
  );

  fastify.get("/api/pinned-dirs", async () => {
    return { success: true, data: stateStore.getPinnedDirectories() } satisfies ApiResponse;
  });

  // Editor detection endpoint (localhost-only)
  fastify.get<{ Querystring: { path?: string } }>(
    "/api/editors",
    { preHandler: localhostGuard },
    async (request) => {
      const cwd = request.query.path;
      if (!cwd) {
        return { success: false, error: "path parameter required" } satisfies ApiResponse;
      }
      const editors = detectEditors(cwd);
      return { success: true, data: editors } satisfies ApiResponse;
    }
  );

  // Open editor endpoint (localhost-only)
  fastify.post<{ Body: { path?: string; editor?: string; file?: string; line?: number } }>(
    "/api/open-editor",
    { preHandler: localhostGuard },
    async (request) => {
      const { path: cwd, editor: editorId, file, line } = request.body ?? {};
      if (!cwd || !editorId) {
        return { success: false, error: "path and editor required" } satisfies ApiResponse;
      }

      const allSessions = sessionManager.listAll();
      if (!allSessions.some((s) => s.cwd === cwd)) {
        return { success: false, error: "unknown session path" } satisfies ApiResponse;
      }

      const editorEntry = EDITORS.find((e) => e.id === editorId);
      if (!editorEntry) {
        return { success: false, error: "unknown editor" } satisfies ApiResponse;
      }

      const target = file ? path.resolve(cwd, file) : cwd;
      const args = line && file ? [`${target}:${line}`] : [target];

      try {
        const child = spawn(editorEntry.cli, args, {
          detached: true,
          stdio: "ignore",
        });
        child.unref();
        return { success: true } satisfies ApiResponse;
      } catch (err: any) {
        return { success: false, error: `failed to open editor: ${err.message}` } satisfies ApiResponse;
      }
    }
  );

  // Health endpoint — liveness check for CLI status and probing
  const serverStartTime = Date.now();
  fastify.get("/api/health", async () => {
    return {
      ok: true,
      pid: process.pid,
      uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    };
  });

  // Shutdown endpoint (localhost-only) — used by devBuildOnReload
  // Skips server.stop() to avoid killing headless/spawned sessions.
  // Just exits the process; the OS cleans up sockets.
  fastify.post(
    "/api/shutdown",
    { preHandler: localhostGuard },
    async () => {
      setTimeout(() => process.exit(0), 100);
      return { ok: true };
    }
  );

  // Serve static files (built web client) in production
  if (!config.dev) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const clientDir = path.join(__dirname, "../../dist/client");
    await fastify.register(fastifyStatic, {
      root: clientDir,
      prefix: "/",
    });

    // SPA fallback: serve index.html for client-side routes
    fastify.setNotFoundHandler(async (_request, reply) => {
      return reply.sendFile("index.html");
    });
  }

  const server: DashboardServer = {
    sessionManager,
    eventStore,
    browserGateway,

    async start() {
      // Clean up orphan headless processes from a previous server instance
      browserGateway.headlessPidRegistry.cleanupOrphans();

      piGateway.start(config.piPort);

      fastify.server.on("upgrade", (request, socket, head) => {
        if (request.url === "/ws") {
          browserGateway.wss.handleUpgrade(request, socket, head, (ws) => {
            browserGateway.wss.emit("connection", ws, request);
          });
        } else {
          socket.destroy();
        }
      });

      await fastify.listen({ port: config.port, host: "0.0.0.0" });
      writePid(process.pid);
      console.log(`Dashboard server running at http://localhost:${config.port}`);
      console.log(`Pi gateway listening on port ${config.piPort}`);

      if (config.tunnel) {
        const tunnelUrl = await createTunnel(config.port);
        if (tunnelUrl) {
          console.log(`🌐 Tunnel: ${tunnelUrl}`);
        }
      }

      startIdleTimer();
    },

    async stop() {
      removePid();
      cancelIdleTimer();
      browserGateway.shutdownHeadlessProcesses();
      pendingLoadManager.dispose();
      sessionPersistence.flush();
      sessionPersistence.dispose();
      pendingForkRegistry.dispose();
      stateStore.flush();
      stateStore.dispose();

      await deleteTunnel();
      piGateway.stop();
      for (const client of browserGateway.wss.clients) {
        client.terminate();
      }
      browserGateway.wss.close();
      await fastify.close();
    },
  };

  stopServer = server.stop.bind(server);
  return server;
}
