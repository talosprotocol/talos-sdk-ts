/**
 * Talos Client
 *
 * High-level TalosClient facade as defined in SDK_CONTRACT.md.
 */

import { Wallet } from "./wallet.js";
import { signMcpRequest, type SignedFrame } from "./mcp_signing.js";
import { TalosTransportError } from "./errors.js";

// Protocol version supported by this SDK
export const PROTOCOL_VERSION = "1.0";
export const PROTOCOL_MIN = "1.0";
export const PROTOCOL_MAX = "1.x";

export class TalosClient {
  private readonly gatewayUrl: string;
  readonly wallet: Wallet;
  private connected = false;
  private sessionId?: string;
  private correlationCounter = 0;

  /**
   * Create a new TalosClient.
   */
  constructor(gatewayUrl: string, wallet: Wallet) {
    this.gatewayUrl = gatewayUrl;
    this.wallet = wallet;
  }

  /**
   * Get the negotiated protocol version.
   */
  protocolVersion(): string {
    return PROTOCOL_VERSION;
  }

  /**
   * Get the SDK's supported protocol range.
   */
  supportedProtocolRange(): [string, string] {
    return [PROTOCOL_MIN, PROTOCOL_MAX];
  }

  /**
   * Connect to the gateway.
   */
  async connect(): Promise<void> {
    // TODO: Implement actual WebSocket connection
    this.connected = true;
    this.sessionId = `session-${Date.now()}`;
  }

  /**
   * Gracefully close the connection.
   */
  async close(): Promise<void> {
    this.connected = false;
    this.sessionId = undefined;
  }

  private nextCorrelationId(): string {
    this.correlationCounter++;
    return `corr-${this.correlationCounter}`;
  }

  /**
   * Sign an MCP request.
   */
  async signMcpRequest(
    request: Record<string, unknown>,
    tool: string,
    action: string,
  ): Promise<SignedFrame> {
    if (!this.sessionId) {
      throw new TalosTransportError("Not connected - call connect() first");
    }

    const correlationId = this.nextCorrelationId();
    return signMcpRequest(
      this.wallet,
      request,
      this.sessionId,
      correlationId,
      tool,
      action,
    );
  }

  /**
   * Sign and send an MCP request, returning the response.
   */
  async signAndSendMcp(
    request: Record<string, unknown>,
    tool: string,
    action: string,
  ): Promise<Record<string, unknown>> {
    if (!this.connected) {
      throw new TalosTransportError("Not connected - call connect() first");
    }

    const frame = await this.signMcpRequest(request, tool, action);

    // TODO: Implement actual send/receive over WebSocket
    return {
      status: "ok",
      correlationId: frame.correlationId,
    };
  }
}
