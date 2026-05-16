/**
 * Repo-lint contracts for change: add-plugin-activation-ui.
 *
 *  - SettingsPanel STILL calls <SettingsSectionSlot tab="..."> for every
 *    legacy tab value, preserving backward compatibility for plugins that
 *    target a specific tab via `claim.tab`.
 *  - browser-protocol introduces NO new message types in this change
 *    (toggles ride on existing plugin_config_update; requirement installs
 *    ride on existing package_progress / package_operation_complete).
 *  - /api/health payload always carries a `startedAt: ISO` field.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

describe("add-plugin-activation-ui repo-lint", () => {
  it("SettingsPanel does NOT render plugin-contributed settings in legacy tabs", () => {
    // Plugin-contributed `settings-section` claims render ONLY under the
    // owning plugin's row in Settings ▸ Plugins. The legacy
    // <SettingsSectionSlot tab="..." /> consumers have been removed; the
    // `claim.tab` manifest field is now an inert hint.
    // See change: add-plugin-activation-ui (settings-consolidation).
    const panel = fs.readFileSync(
      path.join(REPO_ROOT, "packages/client/src/components/SettingsPanel.tsx"),
      "utf-8",
    );
    expect(panel.includes("<SettingsSectionSlot")).toBe(false);
    expect(panel.includes("SettingsSectionSlot")).toBe(false);
  });

  it("browser-protocol introduces no new message types in this change", () => {
    // This change adds zero new variants to ServerToBrowserMessage. Toggles
    // reuse `plugin_config_update`; requirement installs reuse the existing
    // package_progress / package_operation_complete pair.
    const proto = fs.readFileSync(
      path.join(REPO_ROOT, "packages/shared/src/browser-protocol.ts"),
      "utf-8",
    );
    // Sentinel: the existing fields are intact.
    expect(proto.includes('"plugin_config_update"')).toBe(true);
    expect(proto.includes('"package_progress"')).toBe(true);
    expect(proto.includes('"package_operation_complete"')).toBe(true);
    // Forbidden: anything that smells like a new plugin-specific message
    // type added by THIS change.
    const forbidden = [
      '"plugin_install_progress"',
      '"plugin_install_complete"',
      '"plugin_uninstall_progress"',
      '"plugin_uninstall_complete"',
      '"plugin_toggle_complete"',
    ];
    for (const f of forbidden) {
      expect(
        proto.includes(f),
        `browser-protocol.ts must NOT define ${f}; plugin operations ride ` +
          "on existing package_progress / package_operation_complete / " +
          "plugin_config_update.",
      ).toBe(false);
    }
  });

  it("system-routes /api/health payload includes startedAt (ISO 8601 timestamp)", () => {
    const sys = fs.readFileSync(
      path.join(REPO_ROOT, "packages/server/src/routes/system-routes.ts"),
      "utf-8",
    );
    expect(sys.includes("startedAt:")).toBe(true);
    // ISO format produced by Date.prototype.toISOString().
    expect(/serverStartTime.*toISOString\(\)|new Date\(serverStartTime\)\.toISOString\(\)/.test(sys))
      .toBe(true);
  });
});
