/**
 * E2E task 9.8: install gate renders when extension absent, full panel
 * renders when present, install button POSTs the right body.
 *
 * Uses in-process Fastify fixture; see ./fixtures/server-fixture.ts.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import {
  createE2eServerFixture,
  type E2eServerFixture,
} from "./fixtures/server-fixture.js";
import { mountHonchoComponent } from "./fixtures/client-mount.js";
import { HonchoSettings } from "../../client/HonchoSettings.js";

describe("e2e: install gate (task 9.8)", () => {
  let server: E2eServerFixture;

  beforeEach(async () => {
    server = await createE2eServerFixture();
  });

  afterEach(async () => {
    cleanup();
    await server.close();
  });

  it("renders the install gate when extension is absent", async () => {
    server.setHonchoExtensionInstalled(false);

    mountHonchoComponent({
      server,
      children: <HonchoSettings />,
    });

    // Loading message clears, then install gate renders.
    await waitFor(() => {
      expect(screen.getByText(/Honcho memory not installed/i)).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /Install pi-memory-honcho/i }),
    ).toBeInTheDocument();
  });

  it("renders the full settings panel when extension is present", async () => {
    server.setHonchoExtensionInstalled(true);

    mountHonchoComponent({
      server,
      children: <HonchoSettings />,
    });

    // Full panel renders the ConnectionSection legend "Connection".
    // Wait until that's present — the InstallGate path doesn't render it.
    await waitFor(
      () => {
        expect(
          screen.getByText("Connection", { selector: "legend" }),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    // Sanity: InstallGate is not the rendered branch anymore.
    expect(
      screen.queryByText(/Honcho memory not installed/i),
    ).not.toBeInTheDocument();
  });

  it("install button POSTs to /api/packages/install with source npm:pi-memory-honcho", async () => {
    server.setHonchoExtensionInstalled(false);

    // Spy on global.fetch (after the shim is installed by mountHonchoComponent)
    // to capture the exact body the client sends.
    mountHonchoComponent({
      server,
      children: <HonchoSettings />,
    });

    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    const shimmed = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      fetchCalls.push({ url, init: init ?? undefined });
      return shimmed(input, init);
    };

    const button = await screen.findByRole("button", {
      name: /Install pi-memory-honcho/i,
    });
    fireEvent.click(button);

    await waitFor(() => {
      const installCall = fetchCalls.find(
        (c) => c.url === "/api/packages/install" && c.init?.method === "POST",
      );
      expect(installCall).toBeDefined();
      const body = JSON.parse(installCall!.init!.body as string);
      expect(body).toEqual({ source: "npm:pi-memory-honcho", scope: "global" });
    });
  });
});
