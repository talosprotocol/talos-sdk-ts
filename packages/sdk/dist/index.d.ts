/**
 * Base64URL encoding/decoding utilities.
 * Compliant with RFC 4648 with no padding.
 */
declare function encodeBase64Url(input: Uint8Array): string;
declare function decodeBase64Url(input: string): Uint8Array;

/**
 * RFC 8785 Canonical JSON Serialization.
 * Strict v1 requirements:
 * - No floats (integers only)
 * - No NaN/Infinity
 * - No duplicates (enforced by input object nature primarily, but assumed valid)
 * - Omit nulls (validation error if null found)
 * - UTF-8
 */
declare function canonicalize(value: unknown): Uint8Array;

/**
 * Byte array utilities.
 */
declare function utf8ToBytes(str: string): Uint8Array;
declare function bytesToUtf8(bytes: Uint8Array): string;
declare function concatBytes(...arrays: Uint8Array[]): Uint8Array;

/**
 * Validates SHA-256 hash availability and computes strict SHA-256.
 * Uses WebCrypto if available (fastest), falls back to @noble/hashes (pure JS).
 */
declare function sha256(data: Uint8Array): Promise<Uint8Array>;

interface KeyPair {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
}
/**
 * Generate a random Ed25519 keypair.
 */
declare function generateKeyPair(): KeyPair;
/**
 * Generate a deterministic Ed25519 keypair from a 32-byte seed.
 * Strict compliance for vectors.
 */
declare function fromSeed(seed: Uint8Array): KeyPair;
/**
 * Sign message with Ed25519.
 */
declare function sign(message: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array>;
/**
 * Verify signature with Ed25519.
 */
declare function verify(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): Promise<boolean>;

interface Capability {
    v: string;
    iss: string;
    sub: string;
    scope: string;
    constraints?: Record<string, unknown>;
    iat: number;
    exp: number;
    delegatable?: boolean;
    delegation_chain?: string[];
    sig?: string;
}
/**
 * Compute Capability Hash (Identity).
 * hash = sha256(canonical_json(capability_with_signature))
 */
declare function computeCapabilityHash(cap: Capability): Promise<string>;
declare function signCapability(cap: Omit<Capability, 'sig'>, privateKey: Uint8Array): Promise<Capability>;
declare function verifyCapability(cap: Capability, publicKey: Uint8Array): Promise<boolean>;

/**
 * Compute MCP Request Hash.
 * hash = sha256(canonical_json(mcp_request))
 * Output: Hex string (to match strict vectors).
 */
declare function computeRequestHash(request: unknown): Promise<string>;
/**
 * Compute MCP Response Hash.
 * hash = sha256(canonical_json(mcp_response))
 * Output: Hex string.
 */
declare function computeResponseHash(response: unknown): Promise<string>;
declare function canonicalizeMcpRequest(request: unknown): Uint8Array;

type McpMessageType = 'MCP_MESSAGE';
type McpResponseType = 'MCP_RESPONSE';
interface McpMessageFrame {
    type: McpMessageType;
    protocol_version: string;
    session_id: string;
    correlation_id: string;
    peer_id: string;
    issued_at: number;
    request_hash: string;
    tool: string;
    method: string;
    capability_hash: string;
    capability?: Capability;
    sig?: string;
}
interface McpResponseFrame {
    type: McpResponseType;
    protocol_version: string;
    session_id: string;
    correlation_id: string;
    peer_id: string;
    issued_at: number;
    response_hash: string;
    tool: string;
    method: string;
    result_code: 'OK' | 'DENY' | 'ERROR';
    denial_reason?: string;
    mcp_id?: string;
    sig?: string;
}
declare function validateFrameStrict(frame: Record<string, unknown>): void;
declare function signFrame<T extends McpMessageFrame | McpResponseFrame>(frame: Omit<T, 'sig'>, privateKey: Uint8Array): Promise<T>;
declare function verifyFrame(frame: McpMessageFrame | McpResponseFrame, publicKey: Uint8Array): Promise<boolean>;

declare const createEnvelope: typeof signFrame;
declare const verifyEnvelope: typeof verifyFrame;
declare function createEnvelopeContent(sessionId: string, correlationId: string, peerId: string, requestHash: string, tool: string, method: string, capabilityHash: string, capability?: Capability): Omit<McpMessageFrame, 'sig'>;

export { type Capability, type KeyPair, type McpMessageFrame, type McpMessageType, type McpResponseFrame, type McpResponseType, bytesToUtf8, canonicalize, canonicalizeMcpRequest, computeCapabilityHash, computeRequestHash, computeResponseHash, concatBytes, createEnvelope, createEnvelopeContent, decodeBase64Url, encodeBase64Url, fromSeed, generateKeyPair, sha256, sign, signCapability, signFrame, utf8ToBytes, validateFrameStrict, verify, verifyCapability, verifyEnvelope, verifyFrame };
