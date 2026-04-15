/**
 * REST routes for known servers management and network discovery.
 */
import type { FastifyInstance } from "fastify";
import type { NetworkGuard } from "./route-deps.js";
import type { ApiResponse } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import type { KnownServer } from "@blackbelt-technology/pi-dashboard-shared/config.js";
import type { DiscoveredServer } from "@blackbelt-technology/pi-dashboard-shared/mdns-discovery.js";
import type {
  AddKnownServerRequest,
  RemoveKnownServerRequest,
  DiscoveredServerInfo,
} from "@blackbelt-technology/pi-dashboard-shared/rest-api.js";
import { loadConfig } from "@blackbelt-technology/pi-dashboard-shared/config.js";
import { writeConfigPartial } from "../config-api.js";

export function registerKnownServersRoutes(
  fastify: FastifyInstance,
  deps: {
    networkGuard: NetworkGuard;
    getPeerServers: () => Map<string, DiscoveredServer>;
  },
) {
  const { networkGuard, getPeerServers } = deps;

  // List known servers from config
  fastify.get(
    "/api/known-servers",
    { preHandler: networkGuard },
    async (): Promise<ApiResponse<KnownServer[]>> => {
      const config = loadConfig();
      return { success: true, data: config.knownServers };
    },
  );

  // Add or update a known server
  fastify.post<{ Body: AddKnownServerRequest }>(
    "/api/known-servers",
    { preHandler: networkGuard },
    async (request): Promise<ApiResponse> => {
      const { host, port, label } = request.body;
      if (!host || typeof port !== "number") {
        return { success: false, error: "host and port are required" };
      }

      const config = loadConfig();
      const existing = config.knownServers;
      const idx = existing.findIndex((s) => s.host === host && s.port === port);

      if (idx >= 0) {
        // Update label on duplicate
        existing[idx] = { ...existing[idx], ...(label !== undefined ? { label } : {}) };
      } else {
        existing.push({
          host,
          port,
          ...(label ? { label } : {}),
          addedAt: new Date().toISOString(),
        });
      }

      const result = writeConfigPartial({ knownServers: existing });
      if (!result.success) {
        return { success: false, error: result.error };
      }
      return { success: true };
    },
  );

  // Remove a known server
  fastify.delete<{ Body: RemoveKnownServerRequest }>(
    "/api/known-servers",
    { preHandler: networkGuard },
    async (request): Promise<ApiResponse> => {
      const { host, port } = request.body;
      if (!host || typeof port !== "number") {
        return { success: false, error: "host and port are required" };
      }

      const config = loadConfig();
      const filtered = config.knownServers.filter(
        (s) => !(s.host === host && s.port === port),
      );

      const result = writeConfigPartial({ knownServers: filtered });
      if (!result.success) {
        return { success: false, error: result.error };
      }
      return { success: true };
    },
  );

  // On-demand network discovery — returns current mDNS peers
  fastify.post(
    "/api/discover-servers",
    { preHandler: networkGuard },
    async (): Promise<ApiResponse<DiscoveredServerInfo[]>> => {
      const peers = getPeerServers();
      const data: DiscoveredServerInfo[] = Array.from(peers.values()).map((s) => ({
        host: s.host,
        port: s.port,
        piPort: s.piPort,
        version: s.version,
        pid: s.pid,
        isLocal: s.isLocal,
      }));
      return { success: true, data };
    },
  );
}
