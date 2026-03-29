import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { TunnelButton } from "../TunnelButton.js";

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
}));

afterEach(cleanup);

describe("TunnelButton", () => {
  it("should render the tunnel button", () => {
    render(<TunnelButton />);
    expect(screen.getByTestId("tunnel-btn")).toBeDefined();
  });

  it("should have a title", () => {
    render(<TunnelButton />);
    expect(screen.getByTestId("tunnel-btn").getAttribute("title")).toBe("Tunnel status");
  });
});
