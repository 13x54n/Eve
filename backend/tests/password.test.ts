import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
} from "../src/utils/password.js";

describe("Password utilities", () => {
  it("hashes a password", async () => {
    const password = "password123";
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash).toContain("$argon2");
  });

  it("verifies the correct password", async () => {
    const password = "password123";
    const hash = await hashPassword(password);

    await expect(
      verifyPassword(hash, password),
    ).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("password123");

    await expect(
      verifyPassword(hash, "wrong-password"),
    ).resolves.toBe(false);
  });
});