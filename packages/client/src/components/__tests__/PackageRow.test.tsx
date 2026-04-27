import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import React from "react";
import { PackageRow } from "../PackageRow.js";

afterEach(() => cleanup());

describe("PackageRow", () => {
	it("renders display name and source caption", () => {
		render(
			<PackageRow
				displayName="pi-flows"
				source="https://github.com/x/pi-flows.git"
				sourceType="git"
			/>,
		);
		expect(screen.getByText("pi-flows")).toBeTruthy();
		expect(screen.getByText("https://github.com/x/pi-flows.git")).toBeTruthy();
	});

	it("renders the source-type badge", () => {
		render(
			<PackageRow displayName="x" source="npm:x" sourceType="npm" />,
		);
		expect(screen.getByText("npm")).toBeTruthy();
	});

	it("renders the bundled badge when isBundled=true", () => {
		render(
			<PackageRow
				displayName="x"
				source="https://github.com/x/x.git"
				sourceType="git"
				isBundled
			/>,
		);
		expect(screen.getByText("bundled")).toBeTruthy();
	});

	it("shows current → latest when updateAvailable", () => {
		render(
			<PackageRow
				displayName="x"
				source="npm:x"
				sourceType="npm"
				currentVersion="0.4.0"
				latestVersion="0.4.1"
				updateAvailable
				onUpdate={() => {}}
			/>,
		);
		expect(screen.getByText("0.4.0")).toBeTruthy();
		expect(screen.getByText("0.4.1")).toBeTruthy();
		expect(screen.getByText("Update")).toBeTruthy();
	});

	it("shows version-only when up to date", () => {
		render(
			<PackageRow
				displayName="x"
				source="npm:x"
				sourceType="npm"
				currentVersion="1.0.0"
				updateAvailable={false}
			/>,
		);
		expect(screen.getByText("1.0.0")).toBeTruthy();
		expect(screen.queryByText("Update")).toBeNull();
	});

	it("hides Update button when canUpdate=false even if updateAvailable", () => {
		render(
			<PackageRow
				displayName="x"
				source="npm:x"
				sourceType="npm"
				currentVersion="0.4.0"
				latestVersion="0.4.1"
				updateAvailable
				canUpdate={false}
				onUpdate={() => {}}
			/>,
		);
		expect(screen.queryByText("Update")).toBeNull();
	});

	it("shows kebab menu only when at least one menu action is wired", () => {
		const { container } = render(
			<PackageRow displayName="x" source="npm:x" sourceType="npm" />,
		);
		expect(container.querySelector("[title='More actions']")).toBeNull();
	});

	it("shows kebab menu and Uninstall when canUninstall=true", () => {
		const onUninstall = vi.fn();
		render(
			<PackageRow
				displayName="x"
				source="npm:x"
				sourceType="npm"
				canUninstall
				onUninstall={onUninstall}
				testId="row"
			/>,
		);
		const menuBtn = screen.getByTestId("row-menu");
		fireEvent.click(menuBtn);
		const uninstall = screen.getByText("Uninstall");
		fireEvent.click(uninstall);
		expect(onUninstall).toHaveBeenCalledOnce();
	});

	it("hides Uninstall in menu when canUninstall=false (Core)", () => {
		render(
			<PackageRow
				displayName="x"
				source="npm:x"
				sourceType="npm"
				canUninstall={false}
				onViewReadme={() => {}}
				testId="row"
			/>,
		);
		fireEvent.click(screen.getByTestId("row-menu"));
		expect(screen.queryByText("Uninstall")).toBeNull();
		expect(screen.getByText("View README")).toBeTruthy();
	});

	it("renders error message when error prop set", () => {
		render(
			<PackageRow
				displayName="x"
				source="npm:x"
				sourceType="npm"
				error="something blew up"
			/>,
		);
		expect(screen.getByText("something blew up")).toBeTruthy();
	});
});
