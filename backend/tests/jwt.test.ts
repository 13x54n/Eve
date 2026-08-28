import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import {
  createAccessToken,
  verifyAccessToken,
} from "@eve/shared";

function tokenLifetimeSeconds(token: string): number {
  const payload = jwt.decode(token);

  if (!payload || typeof payload === "string" || !payload.iat || !payload.exp) {
    throw new Error("Token payload is missing iat/exp");
  }

  return payload.exp - payload.iat;
}

describe("JWT utilities", () => {
  it("creates and verifies an access token", () => {
    const token = createAccessToken({
      id: "user-123",
      role: "RIDER",
    });

    expect(token).toEqual(expect.any(String));

    const payload = verifyAccessToken(token);

    expect(payload.sub).toBe("user-123");
    expect(payload.role).toBe("RIDER");
  });

  it("rejects an invalid token", () => {
    expect(() => {
      verifyAccessToken("invalid-token");
    }).toThrow();
  });

  it("rejects an empty token", () => {
    expect(() => {
      verifyAccessToken("");
    }).toThrow();
  });

  it("issues longer-lived tokens for riders and drivers than admins", () => {
    const riderToken = createAccessToken({
      id: "rider-1",
      role: "RIDER",
    });
    const driverToken = createAccessToken({
      id: "driver-1",
      role: "DRIVER",
    });
    const adminToken = createAccessToken({
      id: "admin-1",
      role: "ADMIN",
    });

    expect(tokenLifetimeSeconds(riderToken)).toBe(30 * 24 * 60 * 60);
    expect(tokenLifetimeSeconds(driverToken)).toBe(30 * 24 * 60 * 60);
    expect(tokenLifetimeSeconds(adminToken)).toBe(15 * 60);
  });
});