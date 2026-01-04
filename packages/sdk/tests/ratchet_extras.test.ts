import { describe, it, expect } from "vitest";
import { RatchetSession, RatchetState } from "../src/core/ratchet.js";
import * as x25519 from "../src/crypto/x25519.js";

describe("Ratchet Extras", () => {
  it("should initialize as responder", async () => {
    const alice = x25519.generateKeyPair();
    const bob = x25519.generateKeyPair();
    const bobSpk = x25519.generateKeyPair();

    const session = new RatchetSession();
    session.initializeAsResponder(
      bob,
      bobSpk,
      null,
      alice.publicKey, // peer_ik
      alice.publicKey, // peer_eph (simulated)
    );
    expect(session).toBeDefined();
  });

  it("should load from state", () => {
    const state: RatchetState = {
      DHs: x25519.generateKeyPair(),
      DHr: null,
      RK: new Uint8Array(32),
      CKs: new Uint8Array(32),
      CKr: new Uint8Array(32),
      Ns: 0,
      Nr: 0,
      PN: 0,
      MKSIPPED: new Map(),
    };
    const s = RatchetSession.fromState(state);
    expect(s).toBeInstanceOf(RatchetSession);
  });
});
