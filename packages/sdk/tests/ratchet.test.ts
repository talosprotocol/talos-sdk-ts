import { describe, it, expect } from "vitest";
import { RatchetSession } from "../src/core/ratchet.js";
import * as x25519 from "../src/crypto/x25519.js";

describe("RatchetSession", () => {
  it("should perform full X3DH and ping-pong", () => {
    // 1. Setup Identities
    const aliceIdentity = x25519.generateKeyPair();
    const bobIdentity = x25519.generateKeyPair();
    const bobSignedPrekey = x25519.generateKeyPair(); // "Signed" prekey

    // 2. Bob publishes keys (Bob's SPK public part)
    // Alice fetches Bob's SPK

    // 3. Alice Initiates (X3DH)
    const aliceSession = new RatchetSession();
    // Alice generates ephemeral locally inside initializeAsInitiator, or we pass one
    const aliceBaseEphemeral = x25519.generateKeyPair();

    aliceSession.initializeAsInitiator(
      aliceIdentity.privateKey,
      bobIdentity.publicKey,
      bobSignedPrekey.publicKey,
      null,
      aliceBaseEphemeral,
    );

    // 4. Bob Responds (X3DH)
    const bobSession = new RatchetSession();
    bobSession.initializeAsResponder(
      bobIdentity,
      bobSignedPrekey,
      null,
      aliceIdentity.publicKey,
      aliceBaseEphemeral.publicKey,
    );

    // 5. Alice sends "Hello Bob"
    const msg1Plain = new TextEncoder().encode("Hello Bob");
    const msg1Wire = aliceSession.encrypt(msg1Plain);

    // 6. Bob decrypts
    const msg1Decrypted = bobSession.decrypt(msg1Wire);
    expect(msg1Decrypted).toEqual(msg1Plain);

    // 7. Bob replies "Hello Alice"
    const msg2Plain = new TextEncoder().encode("Hello Alice");
    const msg2Wire = bobSession.encrypt(msg2Plain);

    // 8. Alice decrypts
    const msg2Decrypted = aliceSession.decrypt(msg2Wire);
    expect(msg2Decrypted).toEqual(msg2Plain);
  });

  it("should handle out-of-order messages", () => {
    // Setup simple session pair
    const alice = new RatchetSession();
    const bob = new RatchetSession();

    // Manual X3DH mock setup for speed
    const eph = x25519.generateKeyPair();
    const spk = x25519.generateKeyPair();

    alice.initializeAsInitiator(
      new Uint8Array(32),
      new Uint8Array(32),
      spk.publicKey,
      null,
      eph,
    );
    bob.initializeAsResponder(
      { publicKey: new Uint8Array(32), privateKey: new Uint8Array(32) }, // identity ignored in simple init logic
      spk,
      null,
      new Uint8Array(32),
      eph.publicKey,
    );

    const m1 = alice.encrypt(new TextEncoder().encode("M1"));
    const m2 = alice.encrypt(new TextEncoder().encode("M2"));
    const m3 = alice.encrypt(new TextEncoder().encode("M3"));

    // Receive out of order
    // Receive M3 first (skips M1, M2)
    const d3 = bob.decrypt(m3);
    expect(d3).toEqual(new TextEncoder().encode("M3"));

    // Receive M1 (from skipped keys)
    const d1 = bob.decrypt(m1);
    expect(d1).toEqual(new TextEncoder().encode("M1"));

    // Receive M2 (from skipped keys)
    const d2 = bob.decrypt(m2);
    expect(d2).toEqual(new TextEncoder().encode("M2"));
  });
});
