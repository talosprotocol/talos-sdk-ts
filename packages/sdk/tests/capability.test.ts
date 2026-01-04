import { describe, it, expect } from "vitest";
import {
  computeCapabilityHash,
  signCapability,
  verifyCapability,
  Capability,
} from "../src/core/capability.js";
import { Wallet } from "../src/core/wallet.js";

describe("Capability", () => {
  const rawCap: Omit<Capability, "sig"> = {
    v: "1",
    iss: "did:key:zIssuer",
    sub: "did:key:zSubject",
    scope: "test:scope",
    iat: 123456789,
    exp: 223456789,
    constraints: { foo: "bar" },
  };

  it("should compute capability hash (hex)", async () => {
    const cap: Capability = { ...rawCap, sig: "dummy-sig" };
    const hash = await computeCapabilityHash(cap);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should sign and verify a capability", async () => {
    const wallet = Wallet.generate();
    const signedCap = await signCapability(
      rawCap,
      wallet["keyPair"].privateKey,
    );
    expect(signedCap.sig).toBeDefined();

    const isValid = await verifyCapability(signedCap, wallet.publicKey);
    expect(isValid).toBe(true);
  });

  it("should fail verification if signature is missing or wrong", async () => {
    const wallet = Wallet.generate();
    const wrongWallet = Wallet.generate();

    const signedCap = await signCapability(
      rawCap,
      wallet["keyPair"].privateKey,
    );

    const isValidWrongKey = await verifyCapability(
      signedCap,
      wrongWallet.publicKey,
    );
    expect(isValidWrongKey).toBe(false);

    const noSigCap = { ...rawCap } as unknown as Capability;
    const isValidNoSig = await verifyCapability(noSigCap, wallet.publicKey);
    expect(isValidNoSig).toBe(false);
  });
});
