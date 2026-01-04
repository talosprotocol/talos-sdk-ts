/**
 * Talos MCP Signing
 *
 * Implements MCP request signing as defined in SDK_CONTRACT.md.
 */

import { canonicalize } from "../encoding/canonical_json.js";
import type { Wallet } from "./wallet.js";

export interface SignedFrame {
  payload: Uint8Array;
  signature: Uint8Array;
  signerDid: string;
  correlationId: string;
}

/**
 * Sign an MCP request with audit bindings.
 * Deterministic - same inputs produce identical signature.
 */
export async function signMcpRequest(
  wallet: Wallet,
  request: Record<string, unknown>,
  sessionId: string,
  correlationId: string,
  tool: string,
  action: string,
  timestamp?: number,
): Promise<SignedFrame> {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);

  const payload = {
    action,
    correlation_id: correlationId,
    request,
    session_id: sessionId,
    timestamp: ts,
    tool,
  };

  const payloadBytes = canonicalize(payload);
  const signature = await wallet.sign(payloadBytes);

  return {
    payload: payloadBytes,
    signature,
    signerDid: wallet.toDid(),
    correlationId,
  };
}

/**
 * Verify a signed MCP response.
 */
export async function verifyMcpResponse(
  frame: SignedFrame,
  expectedCorrelationId: string,
  signerPublicKey: Uint8Array,
): Promise<boolean> {
  if (frame.correlationId !== expectedCorrelationId) {
    return false;
  }

  const { Wallet } = await import("./wallet.js");
  return Wallet.verify(frame.payload, frame.signature, signerPublicKey);
}
