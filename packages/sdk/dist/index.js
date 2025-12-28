// src/encoding/base64url.ts
var ENC = {
  "+": "-",
  "/": "_",
  "=": ""
};
var DEC = {
  "-": "+",
  "_": "/"
};
function encodeBase64Url(input) {
  let base64 = "";
  const len = input.length;
  for (let i = 0; i < len; i += 3) {
    const b1 = input[i];
    const b2 = i + 1 < len ? input[i + 1] : 0;
    const b3 = i + 2 < len ? input[i + 2] : 0;
    const triplet = b1 << 16 | b2 << 8 | b3;
    base64 += btoaString(triplet >> 18 & 63);
    base64 += btoaString(triplet >> 12 & 63);
    if (i + 1 < len) base64 += btoaString(triplet >> 6 & 63);
    if (i + 2 < len) base64 += btoaString(triplet & 63);
  }
  return base64.replace(/[+/=]/g, (m) => ENC[m] || "");
}
function btoaString(index) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  return chars[index];
}
function decodeBase64Url(input) {
  let base64 = input.replace(/[-_]/g, (m) => DEC[m] || "");
  while (base64.length % 4) {
    base64 += "=";
  }
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  const len = base64.length;
  let bufferLength = len * 0.75;
  if (base64[len - 1] === "=") {
    bufferLength--;
    if (base64[len - 2] === "=") bufferLength--;
  }
  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  let encoded1, encoded2, encoded3, encoded4;
  for (let i = 0; i < len; i += 4) {
    encoded1 = lookup[base64.charCodeAt(i)];
    encoded2 = lookup[base64.charCodeAt(i + 1)];
    encoded3 = lookup[base64.charCodeAt(i + 2)];
    encoded4 = lookup[base64.charCodeAt(i + 3)];
    bytes[p++] = encoded1 << 2 | encoded2 >> 4;
    if (encoded3 !== 64) bytes[p++] = (encoded2 & 15) << 4 | encoded3 >> 2;
    if (encoded4 !== 64) bytes[p++] = (encoded3 & 3) << 6 | encoded4 & 63;
  }
  return bytes;
}

// src/encoding/canonical_json.ts
function canonicalize(value) {
  const jsonStr = stringify(value);
  return new TextEncoder().encode(jsonStr);
}
function stringify(value) {
  if (value === null) {
    throw new Error("Canonical JSON v1: Null values not permitted (omit field instead)");
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Canonical JSON v1: Number must be finite, got ${value}`);
    }
    if (!Number.isInteger(value)) {
      throw new Error(`Canonical JSON v1: Floats not permitted, got ${value}`);
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    let res = "[";
    for (let i = 0; i < value.length; i++) {
      if (i > 0) res += ",";
      res += stringify(value[i]);
    }
    res += "]";
    return res;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    let res = "{";
    let first = true;
    for (const key of keys) {
      const val = value[key];
      if (val === void 0) continue;
      if (!first) res += ",";
      first = false;
      res += JSON.stringify(key);
      res += ":";
      res += stringify(val);
    }
    res += "}";
    return res;
  }
  throw new Error(`Canonical JSON v1: Unsupported type ${typeof value}`);
}

// src/encoding/bytes.ts
function utf8ToBytes(str) {
  return new TextEncoder().encode(str);
}
function bytesToUtf8(bytes) {
  return new TextDecoder().decode(bytes);
}
function concatBytes(...arrays) {
  let totalLength = 0;
  for (const arr of arrays) {
    totalLength += arr.length;
  }
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// src/crypto/sha256.ts
import { sha256 as nobleSha256 } from "@noble/hashes/sha256";
async function sha256(data) {
  if (globalThis.crypto?.subtle) {
    try {
      const buffer = await globalThis.crypto.subtle.digest("SHA-256", data);
      return new Uint8Array(buffer);
    } catch {
    }
  }
  return nobleSha256(data);
}

// src/crypto/ed25519.ts
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));
function generateKeyPair() {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = ed.getPublicKey(privateKey);
  return { publicKey, privateKey };
}
function fromSeed(seed) {
  if (seed.length !== 32) {
    throw new Error(`Seed must be 32 bytes, got ${seed.length}`);
  }
  const privateKey = seed;
  const publicKey = ed.getPublicKey(privateKey);
  return { publicKey, privateKey };
}
async function sign(message, privateKey) {
  return ed.signAsync(message, privateKey);
}
async function verify(signature, message, publicKey) {
  return ed.verifyAsync(signature, message, publicKey);
}

// src/core/capability.ts
async function computeCapabilityHash(cap) {
  const canon = canonicalize(cap);
  const hash = await sha256(canon);
  const hashHex = Array.from(hash).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}
async function signCapability(cap, privateKey) {
  const contentCanonical = canonicalize(cap);
  const sigBytes = await sign(contentCanonical, privateKey);
  const sig = encodeBase64Url(sigBytes);
  return { ...cap, sig };
}
async function verifyCapability(cap, publicKey) {
  if (!cap.sig) return false;
  const content = { ...cap };
  delete content.sig;
  const contentCanonical = canonicalize(content);
  const sigBytes = decodeBase64Url(cap.sig);
  return verify(sigBytes, contentCanonical, publicKey);
}

// src/core/mcp.ts
async function computeRequestHash(request) {
  const canon = canonicalize(request);
  const hash = await sha256(canon);
  return Array.from(hash).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function computeResponseHash(response) {
  const canon = canonicalize(response);
  const hash = await sha256(canon);
  return Array.from(hash).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function canonicalizeMcpRequest(request) {
  return canonicalize(request);
}

// src/core/frames.ts
var MCP_MESSAGE_FIELDS = /* @__PURE__ */ new Set([
  "type",
  "protocol_version",
  "session_id",
  "correlation_id",
  "peer_id",
  "issued_at",
  "request_hash",
  "tool",
  "method",
  "capability_hash",
  "capability",
  "sig"
]);
var MCP_RESPONSE_FIELDS = /* @__PURE__ */ new Set([
  "type",
  "protocol_version",
  "session_id",
  "correlation_id",
  "peer_id",
  "issued_at",
  "response_hash",
  "tool",
  "method",
  "result_code",
  "denial_reason",
  "mcp_id",
  "sig"
]);
function validateFrameStrict(frame) {
  const type = frame["type"];
  if (type === "MCP_MESSAGE") {
    for (const key of Object.keys(frame)) {
      if (!MCP_MESSAGE_FIELDS.has(key)) {
        throw new Error(`MCP_MESSAGE Frame Strictness: Unknown field '${key}' rejected`);
      }
    }
  } else if (type === "MCP_RESPONSE") {
    for (const key of Object.keys(frame)) {
      if (!MCP_RESPONSE_FIELDS.has(key)) {
        throw new Error(`MCP_RESPONSE Frame Strictness: Unknown field '${key}' rejected`);
      }
    }
  } else {
    throw new Error(`Unknown frame type: ${type}`);
  }
}
async function signFrame(frame, privateKey) {
  const contentCanonical = canonicalize(frame);
  const sigBytes = await sign(contentCanonical, privateKey);
  const sig = encodeBase64Url(sigBytes);
  return { ...frame, sig };
}
async function verifyFrame(frame, publicKey) {
  validateFrameStrict(frame);
  if (!frame.sig) return false;
  const content = { ...frame };
  delete content.sig;
  const contentCanonical = canonicalize(content);
  const sigBytes = decodeBase64Url(frame.sig);
  return verify(sigBytes, contentCanonical, publicKey);
}

// src/core/envelope.ts
var createEnvelope = signFrame;
var verifyEnvelope = verifyFrame;
function createEnvelopeContent(sessionId, correlationId, peerId, requestHash, tool, method, capabilityHash, capability) {
  return {
    type: "MCP_MESSAGE",
    protocol_version: "1",
    session_id: sessionId,
    correlation_id: correlationId,
    peer_id: peerId,
    issued_at: Math.floor(Date.now() / 1e3),
    request_hash: requestHash,
    tool,
    method,
    capability_hash: capabilityHash,
    capability
  };
}
export {
  bytesToUtf8,
  canonicalize,
  canonicalizeMcpRequest,
  computeCapabilityHash,
  computeRequestHash,
  computeResponseHash,
  concatBytes,
  createEnvelope,
  createEnvelopeContent,
  decodeBase64Url,
  encodeBase64Url,
  fromSeed,
  generateKeyPair,
  sha256,
  sign,
  signCapability,
  signFrame,
  utf8ToBytes,
  validateFrameStrict,
  verify,
  verifyCapability,
  verifyEnvelope,
  verifyFrame
};
