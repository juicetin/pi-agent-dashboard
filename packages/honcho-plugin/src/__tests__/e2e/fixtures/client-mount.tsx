/**
 * E2E client-mount fixture for honcho-plugin.
 *
 * Renders a single honcho component wrapped in `<PluginContextProvider>`
 * (with the inner `<CurrentPluginLayer pluginId="honcho">` so hooks like
 * `usePluginConfig` work) and installs a `globalThis.fetch` shim that
 * delegates to the in-process Fastify instance via `inject`.
 *
 * Why fetch-shim instead of `vi.spyOn(global, "fetch")`: the honcho
 * plugin's component tree calls `fetch("/api/...")` directly. The shim
 * lets every URL pass through real Fastify routing, so the assertions
 * exercise the real client-to-route contract rather than canned mocks.
 *
 * Background: see openspec/changes/honcho-dashboard-plugin/design.md
 * "E2E Test Fixture Approach".
 */
import React, { type ReactNode } from "react";
import { render, type RenderResult } from "@testing-library/react";
import {
  PluginContextProvider,
  CurrentPluginLayer,
} from "@blackbelt-technology/dashboard-plugin-runtime/context";
import type { E2eServerFixture } from "./server-fixture.js";

export interface MountOpts {
  server: E2eServerFixture;
  /** The component to render. */
  children: ReactNode;
}

export interface MountResult extends RenderResult {
  server: E2eServerFixture;
  /** Restore the previous global fetch. Called automatically on unmount. */
  restoreFetch(): void;
}

/**
 * Install a fetch shim that routes any request whose URL is "" / "/" /
 * starts with "/" through `server.fastify.inject`. Absolute URLs fall
 * through to the original fetch (rare in plugin code).
 */
function installFetchShim(server: E2eServerFixture): () => void {
  const original = globalThis.fetch;

  const shim: typeof fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;

    const isRelative = url.startsWith("/");
    if (!isRelative) return original(input, init);

    const method = (init?.method ?? "GET").toUpperCase();
    let payload: unknown = undefined;
    if (init?.body !== undefined && init?.body !== null) {
      if (typeof init.body === "string") {
        try {
          payload = JSON.parse(init.body);
        } catch {
          payload = init.body;
        }
      } else {
        payload = init.body;
      }
    }

    const res = await server.fastify.inject({
      method: method as never,
      url,
      payload: payload as never,
      headers: (init?.headers as Record<string, string>) ?? undefined,
    });

    // Build a Response-like object the calling code can `.json()` / `.text()` /
    // `.ok`-check. jsdom ships a real `Response` constructor.
    const headers = new Headers();
    for (const [k, v] of Object.entries(res.headers)) {
      if (typeof v === "string") headers.set(k, v);
      else if (Array.isArray(v)) headers.set(k, v.join(", "));
    }
    return new Response(res.body, {
      status: res.statusCode,
      headers,
    });
  };

  globalThis.fetch = shim;
  return () => {
    globalThis.fetch = original;
  };
}

/**
 * Mount a single honcho component in jsdom with PluginContextProvider +
 * a fetch-shim wired to the given in-process Fastify fixture.
 */
export function mountHonchoComponent(opts: MountOpts): MountResult {
  const restoreFetch = installFetchShim(opts.server);

  const result = render(
    <PluginContextProvider sessions={[]}>
      <CurrentPluginLayer pluginId="honcho">{opts.children}</CurrentPluginLayer>
    </PluginContextProvider>,
  );

  // Patch unmount to also restore fetch.
  const originalUnmount = result.unmount;
  result.unmount = () => {
    restoreFetch();
    originalUnmount();
  };

  return { ...result, server: opts.server, restoreFetch };
}
