import type { ForgeConfig } from "@electron-forge/shared-types";

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: "PI Dashboard",
    appBundleId: "com.blackbelt-technology.pi-dashboard",
    // macOS universal binary (arm64 + x64)
    ...(process.platform === "darwin" ? { arch: "universal" as any } : {}),
    extraResource: [
      "./resources/node",
    ],
    // macOS code signing — requires APPLE_IDENTITY env var in CI
    ...(process.env.APPLE_IDENTITY ? {
      osxSign: {
        identity: process.env.APPLE_IDENTITY,
        hardenedRuntime: true,
        entitlements: "entitlements.plist",
        "entitlements-inherit": "entitlements.plist",
      },
      osxNotarize: {
        appleId: process.env.APPLE_ID || "",
        appleIdPassword: process.env.APPLE_ID_PASSWORD || "",
        teamId: process.env.APPLE_TEAM_ID || "",
      },
    } : {}),
  },
  makers: [
    {
      name: "@electron-forge/maker-dmg",
      config: {
        format: "ULFO",
      },
    },
    {
      name: "@electron-forge/maker-deb",
      config: {
        options: {
          maintainer: "Blackbelt Technology",
          homepage: "https://github.com/BlackBeltTechnology/pi-agent-dashboard",
        },
      },
    },
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "pi-dashboard",
      },
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-vite",
      config: {
        build: [
          {
            entry: "src/main.ts",
            config: "vite.main.config.ts",
            target: "main",
          },
          {
            entry: "src/preload.ts",
            config: "vite.preload.config.ts",
            target: "preload",
          },
        ],
        renderer: [],
      },
    },
  ],
};

export default config;
