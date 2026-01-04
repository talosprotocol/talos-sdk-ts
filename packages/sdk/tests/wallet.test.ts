import { describe, it, expect } from "vitest";
import { Wallet } from "../src/core/wallet.js";

describe("Wallet", () => {
  it("should generate a wallet with keypair", () => {
    const w = Wallet.generate("Test");
    expect(w.publicKey.length).toBe(32);
    expect(w.name).toBe("Test");
  });

  it("should be deterministic from seed", () => {
    const seed = new Uint8Array(32).fill(1);
    const w1 = Wallet.fromSeed(seed);
    const w2 = Wallet.fromSeed(seed);

    expect(w1.publicKey).toEqual(w2.publicKey);
    expect(w1.toDid()).toEqual(w2.toDid());
  });

  it("should fail with invalid seed", () => {
    expect(() => Wallet.fromSeed(new Uint8Array(31))).toThrow();
  });

  it("should format DID correctly", () => {
    const seed = new Uint8Array(32).fill(0);
    const w = Wallet.fromSeed(seed);
    // Known DID for seed of all zeros (Ed25519)
    // Check prefix
    expect(w.toDid().startsWith("did:key:z")).toBe(true);
  });

  it("should sign and verify", async () => {
    const w = Wallet.generate();
    const msg = new TextEncoder().encode("message");
    const sig = await w.sign(msg);

    expect(sig.length).toBe(64);

    const valid = await Wallet.verify(msg, sig, w.publicKey);
    expect(valid).toBe(true);

    const invalid = await Wallet.verify(msg, new Uint8Array(64), w.publicKey);
    expect(invalid).toBe(false);
  });

  it("should compute address", async () => {
    const w = Wallet.generate();
    const addr = await w.getAddress();
    expect(addr.length).toBe(64); // SHA-256 hex
  });
});
