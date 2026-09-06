import { describe, expect, it } from "vitest";
import { isTerminalTripStatus, tripActiveKey, tripDetailKey } from "@eve/shared";

describe("trip confirmation cache keys", () => {
  it("uses user and trip ids", () => {
    expect(tripActiveKey("user-1")).toBe("trip:active:user-1");
    expect(tripDetailKey("trip-1")).toBe("trip:detail:trip-1");
  });

  it("treats completed and cancelled as terminal", () => {
    expect(isTerminalTripStatus("COMPLETED")).toBe(true);
    expect(isTerminalTripStatus("CANCELLED")).toBe(true);
    expect(isTerminalTripStatus("ASSIGNED")).toBe(false);
  });
});
