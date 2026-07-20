/**
 * Tests for FirstLaunchDisplayModal — preset PATCH on submit, default-to-
 * standard on dismiss. See change: configurable-chat-display.
 */
import { DISPLAY_PRESETS } from "@blackbelt-technology/pi-dashboard-shared/display-prefs.js";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FirstLaunchDisplayModal } from "../components/settings/FirstLaunchDisplayModal.js";

describe("FirstLaunchDisplayModal", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation(async (_url, init) => ({
      ok: true,
      json: async () => ({ displayPrefs: JSON.parse(init.body as string) }),
    }));
    (globalThis as any).fetch = fetchMock;
  });

  afterEach(() => {
    cleanup();
  });

  it("PATCHes the chosen preset on Continue and closes with those prefs", async () => {
    const onClose = vi.fn();
    render(<FirstLaunchDisplayModal apiBase="" onClose={onClose} />);
    fireEvent.click(screen.getByDisplayValue("simple"));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const call = fetchMock.mock.calls[0]!;
    expect(call[0]).toBe("/api/preferences/display");
    expect(call[1].method).toBe("PATCH");
    const body = JSON.parse(call[1].body as string);
    expect(body).toEqual(DISPLAY_PRESETS.simple);
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(DISPLAY_PRESETS.simple));
  });

  it("refines onClose prefs from the PATCH 200 body when readable", async () => {
    const merged = { ...DISPLAY_PRESETS.simple, tokenStatsBar: true };
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ displayPrefs: merged }) });
    const onClose = vi.fn();
    render(<FirstLaunchDisplayModal apiBase="" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(merged));
  });

  it("keeps the modal open when the PATCH returns non-2xx", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const onClose = vi.fn();
    render(<FirstLaunchDisplayModal apiBase="" onClose={onClose} />);
    fireEvent.click(screen.getByDisplayValue("everything"));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/couldn't save/i));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the modal open when a version-skewed server returns the SPA HTML", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => { throw new SyntaxError("Unexpected token '<'"); },
    });
    const onClose = vi.fn();
    render(<FirstLaunchDisplayModal apiBase="" onClose={onClose} />);
    fireEvent.click(screen.getByDisplayValue("everything"));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/dashboard version/i));
    expect(onClose).not.toHaveBeenCalled();
    expect((screen.getByDisplayValue("everything") as HTMLInputElement).checked).toBe(true);
  });

  it("keeps the modal open when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const onClose = vi.fn();
    render(<FirstLaunchDisplayModal apiBase="" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/couldn't save/i));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the modal open when the response contains malformed preferences", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ displayPrefs: { tokenStatsBar: true, toolCalls: null } }),
    });
    const onClose = vi.fn();
    render(<FirstLaunchDisplayModal apiBase="" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("ignores Escape while a preset save is pending", async () => {
    let resolveFetch: ((value: unknown) => void) | undefined;
    fetchMock.mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve; }));
    const onClose = vi.fn();
    render(<FirstLaunchDisplayModal apiBase="" onClose={onClose} />);
    fireEvent.click(screen.getByDisplayValue("everything"));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch?.({ ok: true, json: async () => ({ displayPrefs: DISPLAY_PRESETS.everything }) });
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(DISPLAY_PRESETS.everything));
  });

  it("PATCHes standard on Skip dismissal", async () => {
    const onClose = vi.fn();
    render(<FirstLaunchDisplayModal apiBase="" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /Skip/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body).toEqual(DISPLAY_PRESETS.standard);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("PATCHes standard on Escape key", async () => {
    const onClose = vi.fn();
    render(<FirstLaunchDisplayModal apiBase="" onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body).toEqual(DISPLAY_PRESETS.standard);
  });

  it("PATCHes everything when chosen", async () => {
    const onClose = vi.fn();
    render(<FirstLaunchDisplayModal apiBase="" onClose={onClose} />);
    fireEvent.click(screen.getByDisplayValue("everything"));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body).toEqual(DISPLAY_PRESETS.everything);
  });
});
