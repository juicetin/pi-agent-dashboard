/**
 * E2E task 9.9: per-card badge + action bar gated on extension installation.
 *
 * Asserts:
 *   - HonchoBadge returns null (renders nothing) when extension absent
 *   - HonchoCardActions returns null when extension absent
 *   - Both render when extension is present
 *
 * Uses in-process Fastify fixture; see ./fixtures/server-fixture.ts.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { screen, waitFor, cleanup } from "@testing-library/react";
import React from "react";
import {
  createE2eServerFixture,
  type E2eServerFixture,
} from "./fixtures/server-fixture.js";
import { mountHonchoComponent } from "./fixtures/client-mount.js";
import { HonchoBadge } from "../../client/HonchoBadge.js";
import { HonchoCardActions } from "../../client/HonchoCardActions.js";

describe("e2e: card-actions gate (task 9.9)", () => {
  let server: E2eServerFixture;

  beforeEach(async () => {
    server = await createE2eServerFixture();
  });

  afterEach(async () => {
    cleanup();
    await server.close();
  });

  it("HonchoBadge renders nothing when extension absent", async () => {
    server.setHonchoExtensionInstalled(false);
    const { container } = mountHonchoComponent({
      server,
      children: <HonchoBadge />,
    });
    // Wait long enough for the install-state probe to resolve to false,
    // then confirm the badge is still absent.
    await waitFor(() => {
      // No <span data-testid="honcho-badge"> in the DOM.
      expect(container.querySelector('[data-testid="honcho-badge"]')).toBeNull();
    });
  });

  it("HonchoBadge renders the brain pill when extension present", async () => {
    server.setHonchoExtensionInstalled(true);
    mountHonchoComponent({
      server,
      children: <HonchoBadge />,
    });
    await waitFor(() => {
      const badge = screen.getByTestId("honcho-badge");
      expect(badge).toBeInTheDocument();
    });
  });

  it("HonchoCardActions renders nothing when extension absent", async () => {
    server.setHonchoExtensionInstalled(false);
    mountHonchoComponent({
      server,
      children: <HonchoCardActions />,
    });
    await waitFor(() => {
      expect(screen.queryByLabelText(/Honcho interview/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Honcho sync/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Honcho map name/i)).not.toBeInTheDocument();
    });
  });

  it("HonchoCardActions renders the three action buttons when extension present", async () => {
    server.setHonchoExtensionInstalled(true);
    mountHonchoComponent({
      server,
      children: <HonchoCardActions />,
    });
    await waitFor(() => {
      expect(screen.getByLabelText(/Honcho interview/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Honcho sync/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Honcho map name/i)).toBeInTheDocument();
    });
  });
});
