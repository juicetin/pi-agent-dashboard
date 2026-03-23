/**
 * Zrok tunnel integration via direct REST API calls.
 * No native dependencies — just fetch().
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface ZrokEnv {
  apiEndpoint: string;
  envZId: string;
  token: string;
}

let activeShare: { env: ZrokEnv; shareToken: string } | null = null;

/**
 * Load zrok environment from ~/.zrok/environment.json.
 * Returns null if zrok is not enrolled or config is invalid.
 */
export function loadZrokEnv(): ZrokEnv | null {
  try {
    const envFile = path.join(os.homedir(), ".zrok", "environment.json");
    if (!fs.existsSync(envFile)) return null;

    const data = JSON.parse(fs.readFileSync(envFile, "utf-8"));
    const apiEndpoint = data.api_endpoint;
    const envZId = data.ziti_identity;
    const token = data.zrok_token;

    if (!apiEndpoint || !envZId || !token) return null;

    return { apiEndpoint, envZId, token };
  } catch {
    return null;
  }
}

/**
 * Create a public proxy share pointing at localhost:{port}.
 * Returns the public URL or null on failure.
 */
export async function createTunnel(port: number): Promise<string | null> {
  const env = loadZrokEnv();
  if (!env) return null;

  try {
    const res = await fetch(`${env.apiEndpoint}/api/v1/share`, {
      method: "POST",
      headers: {
        "Content-Type": "application/zrok.v1+json",
        "x-token": env.token,
      },
      body: JSON.stringify({
        envZId: env.envZId,
        shareMode: "public",
        backendMode: "proxy",
        backendProxyEndpoint: `http://localhost:${port}`,
        frontendSelection: ["public"],
        authScheme: "none",
      }),
    });

    if (!res.ok) {
      console.warn(`zrok share creation failed: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    const shareToken = data.shareToken;
    const url = data.frontendProxyEndpoints?.[0];

    if (!shareToken || !url) {
      console.warn("zrok share response missing token or endpoints");
      return null;
    }

    activeShare = { env, shareToken };
    return url;
  } catch (err: any) {
    console.warn(`zrok tunnel creation failed: ${err.message}`);
    return null;
  }
}

/**
 * Delete the active share. Safe to call when no share exists.
 */
export async function deleteTunnel(): Promise<void> {
  if (!activeShare) return;

  const { env, shareToken } = activeShare;
  activeShare = null;

  try {
    await fetch(`${env.apiEndpoint}/api/v1/unshare`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/zrok.v1+json",
        "x-token": env.token,
      },
      body: JSON.stringify({
        envZId: env.envZId,
        shareToken,
      }),
    });
  } catch (err: any) {
    console.warn(`zrok tunnel cleanup failed: ${err.message}`);
  }
}
