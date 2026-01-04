import { describe, it, expect } from "vitest";
import { hkdfSha256 } from "../src/crypto/hkdf.js";

describe("HKDF", () => {
  it("should derive keys", () => {
    const ikm = new Uint8Array(32).fill(1);
    const salt = new Uint8Array(32).fill(2);
    const info = new Uint8Array(10).fill(3);

    const okm = hkdfSha256(ikm, salt, info, 32);
    expect(okm).toBeDefined();
    expect(okm.length).toBe(32);
  });
});
