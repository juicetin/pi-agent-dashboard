/**
 * Backward-compat re-export shim.
 *
 * The pi-model-proxy detector was lifted into the shared dashboard plugin
 * runtime so any plugin can declare `requires.services: ["pi-model-proxy"]`.
 * See `packages/dashboard-plugin-runtime/src/server/service-probes/pi-model-proxy.ts`.
 *
 * See change: add-plugin-activation-ui (Layer 1.5, task 12).
 */
export {
  detectPiModelProxy,
  probePiModelProxy,
  pickProxyDefaultModel,
  PROXY_MODEL_PREFERENCE,
  type ProxyDetection,
} from "@blackbelt-technology/dashboard-plugin-runtime/server";
