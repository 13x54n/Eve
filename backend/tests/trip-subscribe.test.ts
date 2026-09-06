import { describe, expect, it } from "vitest";
import { canJoinTripRoom } from "../services/notify/src/realtime.js";

describe("trip:subscribe authorization", () => {
  const trip = {
    riderUserId: "user-rider",
    driverUserId: "user-driver",
    recipientUserId: "user-recipient",
  };

  it("allows rider, driver, recipient, and admin by User.id", () => {
    expect(canJoinTripRoom({ sub: "user-rider", role: "RIDER" }, trip)).toBe(true);
    expect(canJoinTripRoom({ sub: "user-driver", role: "DRIVER" }, trip)).toBe(true);
    expect(canJoinTripRoom({ sub: "user-recipient", role: "RIDER" }, trip)).toBe(true);
    expect(canJoinTripRoom({ sub: "user-admin", role: "ADMIN" }, trip)).toBe(true);
  });

  it("rejects profile ids and strangers", () => {
    expect(canJoinTripRoom({ sub: "profile-rider", role: "RIDER" }, trip)).toBe(false);
    expect(canJoinTripRoom({ sub: "user-other", role: "DRIVER" }, trip)).toBe(false);
  });
});
