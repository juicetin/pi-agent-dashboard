import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import React from "react";
import { ProcessList, computeVisibleRows, type ProcessEntry } from "../ProcessList.js";

function mkProc(pid: number, elapsedMs: number, command = `node script-${pid}.js`): ProcessEntry {
  return { pid, pgid: pid, command, elapsedMs };
}

afterEach(() => cleanup());

describe("computeVisibleRows (tighten-process-list-ux)", () => {
  it("returns empty visible + 5 skeletons at length 0... well, callers gate on length>0", () => {
    // For length 0 the component returns null; computeVisibleRows still works but caller should not call it.
    expect(computeVisibleRows([])).toEqual({ visible: [], overflow: [], skeletonCount: 5 });
  });

  it("pads to 5 skeletons when 1 real process", () => {
    const r = computeVisibleRows([mkProc(1, 60_000)]);
    expect(r.visible).toHaveLength(1);
    expect(r.overflow).toHaveLength(0);
    expect(r.skeletonCount).toBe(4);
  });

  it("pads to 2 skeletons when 3 real processes", () => {
    const r = computeVisibleRows([mkProc(1, 10), mkProc(2, 20), mkProc(3, 30)]);
    expect(r.visible).toHaveLength(3);
    expect(r.skeletonCount).toBe(2);
    expect(r.overflow).toHaveLength(0);
  });

  it("no skeletons + no overflow at exactly 5", () => {
    const five = [mkProc(1, 1), mkProc(2, 2), mkProc(3, 3), mkProc(4, 4), mkProc(5, 5)];
    const r = computeVisibleRows(five);
    expect(r.visible).toHaveLength(5);
    expect(r.skeletonCount).toBe(0);
    expect(r.overflow).toHaveLength(0);
  });

  it("clips to 5 + overflow at length 6", () => {
    const six = Array.from({ length: 6 }, (_, i) => mkProc(i + 1, (i + 1) * 1000));
    const r = computeVisibleRows(six);
    expect(r.visible).toHaveLength(5);
    expect(r.overflow).toHaveLength(1);
    expect(r.skeletonCount).toBe(0);
  });

  it("orders by elapsedMs descending", () => {
    const r = computeVisibleRows([mkProc(1, 60_000), mkProc(2, 10_000), mkProc(3, 120_000)]);
    expect(r.visible.map(p => p.elapsedMs)).toEqual([120_000, 60_000, 10_000]);
  });

  it("overflow contains the shortest-running entries when N>5", () => {
    const procs = Array.from({ length: 8 }, (_, i) => mkProc(i + 1, (i + 1) * 1000));
    const r = computeVisibleRows(procs);
    // Longest-running first; overflow contains the 3 shortest.
    expect(r.overflow.map(p => p.elapsedMs).sort((a, b) => a - b)).toEqual([1000, 2000, 3000]);
  });
});

describe("ProcessList render contract (tighten-process-list-ux)", () => {
  const noop = vi.fn();

  it("returns null at length 0", () => {
    const { container } = render(<ProcessList processes={[]} onKill={noop} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders 1 real + 4 skeleton rows at length 1", () => {
    const { container } = render(<ProcessList processes={[mkProc(1, 60_000)]} onKill={noop} />);
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons).toHaveLength(4);
  });

  it("renders 5 real rows and no skeleton/overflow at length 5", () => {
    const five = Array.from({ length: 5 }, (_, i) => mkProc(i + 1, (i + 1) * 1000));
    const { container } = render(<ProcessList processes={five} onKill={noop} />);
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons).toHaveLength(0);
    expect(container.textContent).not.toContain("more processes");
  });

  it("renders 5 real + overflow row at length 6", () => {
    const six = Array.from({ length: 6 }, (_, i) => mkProc(i + 1, (i + 1) * 1000, `cmd-${i + 1}`));
    const { container } = render(<ProcessList processes={six} onKill={noop} />);
    expect(container.textContent).toContain("+1 more processes");
  });

  it("overflow row title attribute lists hidden command lines", () => {
    const procs: ProcessEntry[] = [
      mkProc(1, 9000, "long-a"),
      mkProc(2, 8000, "long-b"),
      mkProc(3, 7000, "long-c"),
      mkProc(4, 6000, "long-d"),
      mkProc(5, 5000, "long-e"),
      mkProc(6, 4000, "hidden-f"),
      mkProc(7, 3000, "hidden-g"),
    ];
    const { container } = render(<ProcessList processes={procs} onKill={noop} />);
    const overflowRow = Array.from(container.querySelectorAll<HTMLElement>("[title]"))
      .find((el) => el.textContent?.includes("more processes"));
    expect(overflowRow).toBeTruthy();
    const title = overflowRow!.getAttribute("title") ?? "";
    expect(title).toContain("hidden-f");
    expect(title).toContain("hidden-g");
    expect(title).not.toContain("long-a");
  });

  it("orders visible rows by elapsedMs descending", () => {
    const procs = [
      mkProc(1, 60_000, "cmd-medium"),
      mkProc(2, 10_000, "cmd-short"),
      mkProc(3, 120_000, "cmd-long"),
    ];
    const { container } = render(<ProcessList processes={procs} onKill={noop} />);
    const text = container.textContent ?? "";
    const idxLong = text.indexOf("cmd-long");
    const idxMedium = text.indexOf("cmd-medium");
    const idxShort = text.indexOf("cmd-short");
    expect(idxLong).toBeGreaterThanOrEqual(0);
    expect(idxLong).toBeLessThan(idxMedium);
    expect(idxMedium).toBeLessThan(idxShort);
  });

  it("compact layout also applies the floor/ceiling contract", () => {
    const six = Array.from({ length: 6 }, (_, i) => mkProc(i + 1, (i + 1) * 1000));
    const { container } = render(<ProcessList processes={six} onKill={noop} compact />);
    expect(container.textContent).toContain("+1 more processes");
  });
});
