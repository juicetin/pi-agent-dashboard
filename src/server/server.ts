/**
 * Dashboard HTTP + WebSocket server.
 */
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabaseAsync, type Database } from "./db.js";
import { createEventStore, type EventStore } from "./event-store.js";
import { createSessionManager, type SessionManager } from "./session-manager.js";
import { createPiGateway, type PiGateway } from "./pi-gateway.js";
import { createBrowserGateway, type BrowserGateway } from "./browser-gateway.js";
import { createWorkspaceManager, type WorkspaceManager } from "./workspace-manager.js";
import type { ApiResponse } from "../shared/types.js";
import { extractSessionUpdates } from "./event-status-extraction.js";
import { createTunnel, deleteTunnel } from "./tunnel.js";
import { detectEditors, EDITORS } from "./editor-registry.js";
import { localhostGuard } from "./localhost-guard.js";
import { spawn } from "node:child_process";

export interface ServerConfig {
  port: number;
  piPort: number;
  dbPath: string;
  dev: boolean;
  autoShutdown: boolean;
  shutdownIdleSeconds: number;
  tunnel: boolean;
}

export interface DashboardServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  db: Database;
  sessionManager: SessionManager;
  eventStore: EventStore;
}

export async function createServer(config: ServerConfig): Promise<DashboardServer> {
  const db = await createDatabaseAsync(config.dbPath);
  const eventStore = createEventStore(db);
  const sessionManager = createSessionManager(db);
  const workspaceManager = createWorkspaceManager(db);
  const piGateway = createPiGateway(sessionManager);
  const browserGateway = createBrowserGateway(sessionManager, eventStore, piGateway);

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
      const session = sessionManager.get(sessionId);
      if (session) {
        browserGateway.broadcastSessionAdded(session);
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
      browserGateway.sendToSubscribers(sessionId, {
        type: "openspec_update",
        sessionId,
        data: msg.data,
      });
    }
    if (msg.type === "stats_update") {
      // Broadcast accumulated totals (pi-gateway already accumulated into session manager)
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

      // Forward as event so the reducer can update turnStats/contextUsage
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
  };

  // Auto-shutdown idle timer
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let stopServer: (() => Promise<void>) | null = null;

  function startIdleTimer() {
    if (!config.autoShutdown) return;
    cancelIdleTimer();
    idleTimer = setTimeout(async () => {
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

  fastify.get("/api/workspaces", async () => {
    return { success: true, data: workspaceManager.list() } satisfies ApiResponse;
  });

  fastify.post<{ Body: { path: string; name?: string } }>("/api/workspaces", async (request) => {
    try {
      const ws = workspaceManager.create(request.body);
      return { success: true, data: ws } satisfies ApiResponse;
    } catch (err: any) {
      return { success: false, error: err.message } satisfies ApiResponse;
    }
  });

  fastify.put<{ Params: { id: string }; Body: { name?: string; sortOrder?: number } }>(
    "/api/workspaces/:id",
    async (request) => {
      try {
        const ws = workspaceManager.update(request.params.id, request.body);
        return { success: true, data: ws } satisfies ApiResponse;
      } catch (err: any) {
        return { success: false, error: err.message } satisfies ApiResponse;
      }
    }
  );

  fastify.delete<{ Params: { id: string } }>("/api/workspaces/:id", async (request) => {
    workspaceManager.delete(request.params.id);
    return { success: true } satisfies ApiResponse;
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

      // Validate path against known session cwds
      const allSessions = sessionManager.listAll();
      if (!allSessions.some((s) => s.cwd === cwd)) {
        return { success: false, error: "unknown session path" } satisfies ApiResponse;
      }

      // Validate editor ID
      const editorEntry = EDITORS.find((e) => e.id === editorId);
      if (!editorEntry) {
        return { success: false, error: "unknown editor" } satisfies ApiResponse;
      }

      // Build args: open specific file or workspace root
      const target = file ? path.resolve(cwd, file) : cwd;
      const args = line && file ? [`${target}:${line}`] : [target];

      // Spawn editor as detached process
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

  // Serve static files (built web client) in production
  if (!config.dev) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const clientDir = path.join(__dirname, "../../dist/client");
    await fastify.register(fastifyStatic, {
      root: clientDir,
      prefix: "/",
    });
  }

  const server: DashboardServer = {
    db,
    sessionManager,
    eventStore,

    async start() {
      // Start Pi Gateway
      piGateway.start(config.piPort);

      // Start HTTP server with WebSocket upgrade for browser gateway
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
      console.log(`Dashboard server running at http://localhost:${config.port}`);
      console.log(`Pi gateway listening on port ${config.piPort}`);

      // Create zrok tunnel if enabled
      if (config.tunnel) {
        const tunnelUrl = await createTunnel(config.port);
        if (tunnelUrl) {
          console.log(`🌐 Tunnel: ${tunnelUrl}`);
        }
      }

      // Start idle timer immediately (handles case where no sessions ever connect)
      startIdleTimer();
    },

    async stop() {
      cancelIdleTimer();
      await deleteTunnel();
      piGateway.stop();
      // Forcibly terminate browser WebSocket clients before closing
      for (const client of browserGateway.wss.clients) {
        client.terminate();
      }
      browserGateway.wss.close();
      await fastify.close();
      db.close();
    },
  };

  stopServer = server.stop.bind(server);
  return server;
}
