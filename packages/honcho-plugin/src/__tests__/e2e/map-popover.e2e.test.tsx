/**
 * E2E task 9.10: per-card map popover round-trip.
 *
 * open → edit → save → re-open shows new value.
 *
 * Round-trip is verified two ways:
 *   1. After save, the per-tmpHome ~/.honcho/config.json contains the
 *      new mapping under hosts.pi.sessions[cwd].
 *   2. Re-mounting the popover with the same cwd shows the saved name
 *      pre-filled in the input.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import React from "react";
import {
  createE2eServerFixture,
  type E2eServerFixture,
} from "./fixtures/server-fixture.js";
import { mountHonchoComponent } from "./fixtures/client-mount.js";
import { HonchoMapPopover } from "../../client/HonchoMapPopover.js";

describe("e2e: map popover round-trip (task 9.10)", () => {
  let server: E2eServerFixture;
  const cwd = "/test/project/foo";

  beforeEach(async () => {
    server = await createE2eServerFixture();
  });

  afterEach(async () => {
    cleanup();
    await server.close();
  });

  it("open → edit → save persists to ~/.honcho/config.json", async () => {
    const onClose = (): void => {};
    mountHonchoComponent({
      server,
      children: <HonchoMapPopover cwd={cwd} onClose={onClose} />,
    });

    // Wait for input to render (it gates on cwd present + config loaded).
    const input = await screen.findByPlaceholderText(/Session name…/i);

    fireEvent.change(input, { target: { value: "memory-foo" } });
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    // Server-side: config file persisted via real route + real config-store.
    await waitFor(() => {
      const raw = readFileSync(server.configPath, "utf-8");
      const parsed = JSON.parse(raw);
      expect(parsed.hosts?.pi?.sessions?.[cwd]).toBe("memory-foo");
    });
  });

  it("re-opening the popover for the same cwd shows the saved name", async () => {
    // Seed via the real route.
    const seed = await server.inject({
      method: "POST",
      url: "/api/plugins/honcho/sessions",
      payload: { cwd, name: "saved-name" },
    });
    expect(seed.statusCode).toBe(200);

    mountHonchoComponent({
      server,
      children: <HonchoMapPopover cwd={cwd} onClose={() => {}} />,
    });

    // The component's input should pre-fill from /config.
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/Session name…/i) as HTMLInputElement;
      expect(input.value).toBe("saved-name");
    });
  });

  it("Clear button removes the mapping from config.json", async () => {
    // Seed first.
    await server.inject({
      method: "POST",
      url: "/api/plugins/honcho/sessions",
      payload: { cwd, name: "to-clear" },
    });

    mountHonchoComponent({
      server,
      children: <HonchoMapPopover cwd={cwd} onClose={() => {}} />,
    });

    // Wait for the input to pre-fill, which gates the Clear button visible.
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/Session name…/i) as HTMLInputElement;
      expect(input.value).toBe("to-clear");
    });

    fireEvent.click(screen.getByRole("button", { name: /Clear/i }));

    await waitFor(() => {
      const raw = readFileSync(server.configPath, "utf-8");
      const parsed = JSON.parse(raw);
      expect(parsed.hosts?.pi?.sessions?.[cwd]).toBeUndefined();
    });
  });
});
