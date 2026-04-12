import { defineConfig } from "vite";
import { builtinModules } from "node:module";

// Externalize all Node.js builtins (node:fs, node:path, etc.) and Electron
const nodeExternals = [
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
  "electron",
  "electron-updater",
];

export default defineConfig({
  build: {
    outDir: ".vite/build",
    lib: {
      entry: "src/main.ts",
      formats: ["es"],
      fileName: () => "main.js",
    },
    rollupOptions: {
      external: nodeExternals,
    },
  },
});
