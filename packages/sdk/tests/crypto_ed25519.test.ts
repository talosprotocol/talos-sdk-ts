import { describe, it, expect } from "vitest";
import {
  generateKeyPair,
  sign,
  verify,
  getPublicKey,
} from "../src/crypto/ed25519.js";

describe("Ed25519", () => {
  it("should generate keypairs and verify signatures", async () => {
    const { publicKey, privateKey } = generateKeyPair();
    expect(publicKey.length).toBe(32);
    expect(privateKey.length).toBe(32);

    const message = new TextEncoder().encode("test message");
    const signature = await sign(message, privateKey);
    expect(signature.length).toBe(64);

    const isValid = await verify(signature, message, publicKey);
    expect(isValid).toBe(true);

    const isInvalid = await verify(signature, new Uint8Array([0]), publicKey);
    expect(isInvalid).toBe(false);
  });

  it("should derive public key from private key", async () => {
    const { publicKey, privateKey } = generateKeyPair();
    const derivedPub = await getPublicKey(privateKey);
    expect(derivedPub).toEqual(publicKey);
  });
});
