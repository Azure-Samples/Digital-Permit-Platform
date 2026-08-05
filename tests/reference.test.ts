import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateReferenceNumber } from "../src/lib/reference";

describe("application references", () => {
  it("uses a generic platform prefix, module initials, date, and padded sequence", () => {
    const now = new Date("2026-03-15T12:00:00Z");

    assert.equal(generateReferenceNumber("taxi_driver_new", 42, now),
      "DP-TDN-202603-00042",
    );
    assert.equal(generateReferenceNumber("private_hire_vehicle_standard_new", 7, now),
      "DP-PHVS-202603-00007",
    );
  });
});