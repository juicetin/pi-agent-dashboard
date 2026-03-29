import { describe, it, expect } from "vitest";
import { validateWsUpgrade } from "../auth-plugin.js";
import { signToken, COOKIE_NAME } from "../auth.js";

const SECRET = "test-secret-for-ws-auth-testing";

describe("validateWsUpgrade", () => {
  it("should allow localhost without cookie", () => {
    expect(validateWsUpgrade(undefined, "127.0.0.1", SECRET)).toBe(true);
    expect(validateWsUpgrade(undefined, "::1", SECRET)).toBe(true);
    expect(validateWsUpgrade(undefined, "::ffff:127.0.0.1", SECRET)).toBe(true);
  });

  it("should reject external request without cookie", () => {
    expect(validateWsUpgrade(undefined, "1.2.3.4", SECRET)).toBe(false);
  });

  it("should reject external request with invalid cookie", () => {
    expect(validateWsUpgrade(`${COOKIE_NAME}=invalidtoken`, "1.2.3.4", SECRET)).toBe(false);
  });

  it("should allow external request with valid cookie", () => {
    const token = signToken({ sub: "user@example.com", name: "User", username: "user", provider: "github" }, SECRET);
    expect(validateWsUpgrade(`${COOKIE_NAME}=${token}`, "1.2.3.4", SECRET)).toBe(true);
  });

  it("should reject external request with wrong secret", () => {
    const token = signToken({ sub: "user@example.com", name: "User", username: "user", provider: "github" }, "other-secret");
    expect(validateWsUpgrade(`${COOKIE_NAME}=${token}`, "1.2.3.4", SECRET)).toBe(false);
  });
});
