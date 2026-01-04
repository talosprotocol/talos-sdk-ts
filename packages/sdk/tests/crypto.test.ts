import { describe, it, expect } from "vitest";
import * as ed from "../src/crypto/ed25519.js";
import * as x25519 from "../src/crypto/x25519.js";

describe("Crypto Support", () => {
  describe("Ed25519", () => {
    it("should generate valid keypair", () => {
      const kp = ed.generateKeyPair();
      expect(kp.publicKey.length).toBe(32);
      expect(kp.privateKey.length).toBe(32);
    });

    it("should generate deterministic keypair from seed", () => {
      const seed = new Uint8Array(32).fill(1);
      const kp1 = ed.fromSeed(seed);
      const kp2 = ed.fromSeed(seed);
      expect(kp1.publicKey).toEqual(kp2.publicKey);
      expect(kp1.privateKey).toEqual(kp2.privateKey);
    });

    it("should throw on invalid seed length", () => {
      expect(() => ed.fromSeed(new Uint8Array(31))).toThrow();
    });

    it("should sign and verify", async () => {
      const kp = ed.generateKeyPair();
      const msg = new TextEncoder().encode("hello");
      const sig = await ed.sign(msg, kp.privateKey);
      expect(sig.length).toBe(64);
      const valid = await ed.verify(sig, msg, kp.publicKey);
      expect(valid).toBe(true);
    });
  });

  describe("X25519", () => {
    it("should generate valid keypair", () => {
      const kp = x25519.generateKeyPair();
      expect(kp.publicKey.length).toBe(32);
      expect(kp.privateKey.length).toBe(32);
    });

    it("should generate deterministic keypair from seed", () => {
      const seed = new Uint8Array(32).fill(2);
      const kp1 = x25519.fromSeed(seed);
      const kp2 = x25519.fromSeed(seed);
      expect(kp1.publicKey).toEqual(kp2.publicKey);
    });

    it("should throw on invalid seed length", () => {
      expect(() => x25519.fromSeed(new Uint8Array(31))).toThrow();
    });

    it("should perform DH exchange", () => {
      const alice = x25519.generateKeyPair();
      const bob = x25519.generateKeyPair();

      const s1 = x25519.getSharedSecret(alice.privateKey, bob.publicKey);
      const s2 = x25519.getSharedSecret(bob.privateKey, alice.publicKey);

      expect(s1).toEqual(s2);
    });
  });
});
