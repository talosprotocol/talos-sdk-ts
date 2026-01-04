import {
  KeyPairX25519,
  generateKeyPair,
  getSharedSecret,
  getPublicKey,
} from "../crypto/x25519.js";
import {
  encrypt as aeadEncrypt,
  decrypt as aeadDecrypt,
} from "../crypto/aead.js";
import { hkdfSha256 } from "../crypto/hkdf.js";
import { encodeBase64Url, decodeBase64Url } from "../encoding/base64url.js";
import { canonicalize } from "../encoding/canonical_json.js";

const MAX_SKIP = 1000;
const INFO_ROOT = utf8ToBytes("talos-double-ratchet-root");
const INFO_CHAIN = utf8ToBytes("talos-double-ratchet-chain");
const INFO_MESSAGE = utf8ToBytes("talos-double-ratchet-message");
const INFO_X3DH = utf8ToBytes("x3dh-init");

function utf8ToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export type RatchetState = {
  DHs: KeyPairX25519;
  DHr: Uint8Array | null;
  RK: Uint8Array;
  CKs: Uint8Array | null;
  CKr: Uint8Array | null;
  Ns: number;
  Nr: number;
  PN: number;
  MKSIPPED: Map<string, Uint8Array>; // key: header.dh + "_" + header.n
};

export class RatchetSession {
  public state: RatchetState;
  public _test_next_ratchet_key: Uint8Array | null = null;

  constructor() {
    this.state = {
      DHs: generateKeyPair(), // Temporary default
      DHr: null,
      RK: new Uint8Array(32),
      CKs: null,
      CKr: null,
      Ns: 0,
      Nr: 0,
      PN: 0,
      MKSIPPED: new Map(),
    };
  }

  /**
   * Initialize as ALICE (Initiator)
   * Simplified X3DH: DH(Alice_Ephem, Bob_SignedPrekey)
   */
  public initializeAsInitiator(
    _sk: Uint8Array,
    _peer_ik: Uint8Array,
    peer_spk: Uint8Array,
    _peer_opk: Uint8Array | null,
    ephemeralKeyPair?: KeyPairX25519,
  ) {
    this.state.DHs = ephemeralKeyPair || generateKeyPair();

    // Simplified X3DH (Talos v1): DH(AliceEph, BobSpk)
    const dh_x3dh = getSharedSecret(this.state.DHs.privateKey, peer_spk);
    const derivation = hkdfSha256(dh_x3dh, undefined, INFO_X3DH, 32);
    const rk = derivation;

    // Initialize first sending chain: DH(AliceEph, BobSpk)
    const dh_out = getSharedSecret(this.state.DHs.privateKey, peer_spk);
    const [next_rk, cks] = this.kdfRk(rk, dh_out);

    this.state.RK = next_rk;
    this.state.CKs = cks;
    this.state.DHr = peer_spk;
  }

  /**
   * Initialize as BOBS (Responder)
   * Simplified X3DH: DH(Bob_SignedPrekey, Alice_Ephem)
   */
  public initializeAsResponder(
    _ik: KeyPairX25519,
    spk: KeyPairX25519,
    _opk: KeyPairX25519 | null,
    _peer_ik_pub: Uint8Array,
    peer_ephemeral_pub: Uint8Array,
  ) {
    // Simplified X3DH (Talos v1): DH(BobSpk, AliceEph)
    const dh_x3dh = getSharedSecret(spk.privateKey, peer_ephemeral_pub);
    const derivation = hkdfSha256(dh_x3dh, undefined, INFO_X3DH, 32);
    const rk = derivation;

    // Symmetric match: DH(BobSpk, AliceEph)
    const dh_recv = getSharedSecret(spk.privateKey, peer_ephemeral_pub);
    const [next_rk, ckr] = this.kdfRk(rk, dh_recv);

    this.state.RK = next_rk;
    this.state.CKr = ckr;
    this.state.DHr = peer_ephemeral_pub;
    this.state.DHs = spk; // Bob reuses SPK as initial ratchet key
  }

  // For test vector (manual init)
  public static fromState(state: RatchetState): RatchetSession {
    const s = new RatchetSession();
    s.state = state;
    return s;
  }

  /**
   * Encrypt message
   */
  public encrypt(plaintext: Uint8Array, explicitNonce?: Uint8Array): string {
    if (this.state.CKs === null) {
      this.state.PN = this.state.Ns;
      this.state.Ns = 0;

      if (this._test_next_ratchet_key) {
        const priv = this._test_next_ratchet_key;
        this.state.DHs = { privateKey: priv, publicKey: getPublicKey(priv) };
        this._test_next_ratchet_key = null;
      } else {
        this.state.DHs = generateKeyPair();
      }

      if (!this.state.DHr) throw new Error("DHr missing in encrypt");
      const [rk, cks] = this.kdfRk(
        this.state.RK,
        getSharedSecret(this.state.DHs.privateKey, this.state.DHr),
      );
      this.state.RK = rk;
      this.state.CKs = cks;
    }

    const [mk, nextCk] = this.kdfCk(this.state.CKs);
    this.state.CKs = nextCk;

    const header = {
      dh: encodeBase64Url(this.state.DHs.publicKey),
      pn: this.state.PN,
      n: this.state.Ns,
    };

    const headerBytes = canonicalize(header);

    const nonce = explicitNonce || new Uint8Array(12);
    if (!explicitNonce) {
      crypto.getRandomValues(nonce);
    }

    const ciphertext = aeadEncrypt(mk, nonce, plaintext, headerBytes);

    // V1.1.0 Wire format (Option A): JSON envelope encoded as Base64URL
    const envelope = {
      header: header,
      nonce: encodeBase64Url(nonce),
      ciphertext: encodeBase64Url(ciphertext),
    };

    const envelopeBytes = canonicalize(envelope);
    const wire = encodeBase64Url(envelopeBytes);

    this.state.Ns++;
    return wire;
  }

  /**
   * Decrypt message
   */
  public decrypt(wire: string | Uint8Array): Uint8Array {
    let msgBytes: Uint8Array;
    if (typeof wire === "string") {
      msgBytes = decodeBase64Url(wire);
    } else {
      msgBytes = wire;
    }

    let header: { dh: string; n: number; pn: number };
    let nonce: Uint8Array;
    let ciphertext: Uint8Array;
    let headerBytes: Uint8Array;

    try {
      // Try V1.1.0 (JSON envelope)
      const envelope = JSON.parse(bytesToUtf8(msgBytes));
      header = envelope.header;
      nonce = decodeBase64Url(envelope.nonce);
      ciphertext = decodeBase64Url(envelope.ciphertext);
      headerBytes = canonicalize(header);
    } catch (e) {
      if (e instanceof SyntaxError) {
        // Fallback for V1.0.0 (Binary)
        if (msgBytes.length < 2) throw new Error("Message too short");
        const len = (msgBytes[0] << 8) | msgBytes[1];
        headerBytes = msgBytes.slice(2, 2 + len);
        nonce = msgBytes.slice(2 + len, 2 + len + 12);
        ciphertext = msgBytes.slice(2 + len + 12);
        header = JSON.parse(bytesToUtf8(headerBytes));
      } else {
        throw e; // Re-throw unexpected errors (like CryptoError or type issues)
      }
    }

    const peer_dh = decodeBase64Url(header.dh);
    const n = header.n;
    const pn = header.pn;

    // Try skipped keys
    const mk_skipped = this.trySkippedMessageKeys(peer_dh, n);
    if (mk_skipped) {
      return aeadDecrypt(mk_skipped, nonce, ciphertext, headerBytes);
    }

    // Ratchet step?
    if (this.state.DHr && !equalBytes(peer_dh, this.state.DHr)) {
      this.skipMessageKeys(pn);
      this.dhRatchet(peer_dh);
    }

    this.skipMessageKeys(n);

    if (!this.state.CKr) {
      throw new Error("Receiving chain key missing");
    }
    const [mk, next_ck] = this.kdfCk(this.state.CKr);
    this.state.CKr = next_ck;
    this.state.Nr++;

    return aeadDecrypt(mk, nonce, ciphertext, headerBytes);
  }

  private kdfRk(rk: Uint8Array, dh_out: Uint8Array): [Uint8Array, Uint8Array] {
    // Spec: HKDF(concat(rk, dh_out), salt=None, info="talos-double-ratchet-root", len=64)
    const ikm = new Uint8Array(rk.length + dh_out.length);
    ikm.set(rk);
    ikm.set(dh_out, rk.length);

    const out = hkdfSha256(ikm, undefined, INFO_ROOT, 64);
    return [out.slice(0, 32), out.slice(32, 64)];
  }

  private kdfCk(ck: Uint8Array): [Uint8Array, Uint8Array] {
    // MK = HKDF(ck, info="...message", 32)
    const mk = hkdfSha256(ck, undefined, INFO_MESSAGE, 32);
    // next_CK = HKDF(ck, info="...chain", 32)
    const next_ck = hkdfSha256(ck, undefined, INFO_CHAIN, 32);
    return [mk, next_ck];
  }

  private dhRatchet(peer_dh: Uint8Array) {
    this.state.PN = this.state.Ns;
    this.state.Ns = 0;
    this.state.Nr = 0;
    this.state.DHr = peer_dh;

    const [rk1, ckr] = this.kdfRk(
      this.state.RK,
      getSharedSecret(this.state.DHs.privateKey, this.state.DHr),
    );
    this.state.RK = rk1;
    this.state.CKr = ckr;

    if (this._test_next_ratchet_key) {
      const priv = this._test_next_ratchet_key;
      this.state.DHs = { privateKey: priv, publicKey: getPublicKey(priv) };
      this._test_next_ratchet_key = null;
    } else {
      this.state.DHs = generateKeyPair();
    }

    const [rk2, cks] = this.kdfRk(
      this.state.RK,
      getSharedSecret(this.state.DHs.privateKey, this.state.DHr),
    );
    this.state.RK = rk2;
    this.state.CKs = cks;
  }

  private trySkippedMessageKeys(
    peer_dh: Uint8Array,
    n: number,
  ): Uint8Array | null {
    const key = encodeBase64Url(peer_dh) + "_" + n;
    const mk = this.state.MKSIPPED.get(key);
    if (mk) {
      this.state.MKSIPPED.delete(key);
      return mk;
    }
    return null;
  }

  private skipMessageKeys(until: number) {
    if (this.state.Nr + MAX_SKIP < until) {
      throw new Error("Too many skipped messages");
    }

    if (this.state.CKr !== null) {
      while (this.state.Nr < until) {
        const [mk, next_ck] = this.kdfCk(this.state.CKr);
        this.state.CKr = next_ck;

        // Store mk
        const dh_key = this.state.DHr ? encodeBase64Url(this.state.DHr) : "";
        const key = dh_key + "_" + this.state.Nr;
        this.state.MKSIPPED.set(key, mk);
        this.state.Nr++;
      }
    }
  }
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
