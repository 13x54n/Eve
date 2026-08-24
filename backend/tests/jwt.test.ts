import { describe, expect, it } from "vitest";
import {
  createAccessToken,
  verifyAccessToken,
} from "../src/utils/jwt.js";

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
});