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
  private socket?: WebSocket;
  private connected = false;
  private sessionId?: string;
  private correlationCounter = 0;
  private pendingRequests = new Map<string, { resolve: (val: any) => void, reject: (err: Error) => void, timeout: any }>();

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
    if (this.connected) return;

    return new Promise((resolve, reject) => {
      try {
        const wsUrl = this.gatewayUrl.replace(/^http/, 'ws');
        this.socket = new (globalThis.WebSocket as any)(wsUrl, ["talos.1.0"]);
        
        const timeout = setTimeout(() => {
          this.socket?.close();
          reject(new TalosTransportError("Connection timeout"));
        }, 5000);

        this.socket!.onopen = () => {
          // Send an initialization frame as part of the handshake
          this.socket!.send(JSON.stringify({ type: "init", did: this.wallet.did }));
        };

        this.socket!.onerror = (event: any) => {
          clearTimeout(timeout);
          reject(new TalosTransportError(`WebSocket error: ${event.message || 'Unknown error'}`));
        };

        this.socket!.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data.toString());
            
            // Handle initialization response
            if (!this.connected && message.type === "init_ack") {
              clearTimeout(timeout);
              this.connected = true;
              this.sessionId = message.session_id || `session-${Date.now()}`;
              resolve();
              return;
            }

            // Handle normal responses
            const correlationId = message.correlationId;
            if (correlationId && this.pendingRequests.has(correlationId)) {
              const { resolve, timeout: reqTimeout } = this.pendingRequests.get(correlationId)!;
              clearTimeout(reqTimeout);
              this.pendingRequests.delete(correlationId);
              resolve(message);
            }
          } catch (err) {
            console.error("Failed to handle WebSocket message:", err);
          }
        };

        this.socket!.onclose = () => {
          this.connected = false;
          this.sessionId = undefined;
          this.cleanupPending(new TalosTransportError("Connection closed"));
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  private handleMessage(data: any) {
    try {
      const message = JSON.parse(data.toString());
      const correlationId = message.correlationId;
      if (correlationId && this.pendingRequests.has(correlationId)) {
        const { resolve, timeout } = this.pendingRequests.get(correlationId)!;
        clearTimeout(timeout);
        this.pendingRequests.delete(correlationId);
        resolve(message);
      }
    } catch (err) {
      console.error("Failed to handle WebSocket message:", err);
    }
  }

  private cleanupPending(error: Error) {
    for (const { reject, timeout } of this.pendingRequests.values()) {
      clearTimeout(timeout);
      reject(error);
    }
    this.pendingRequests.clear();
  }

  /**
   * Gracefully close the connection.
   */
  async close(): Promise<void> {
    if (this.socket) {
      this.socket.close();
    }
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
    if (!this.connected || !this.socket) {
      throw new TalosTransportError("Not connected - call connect() first");
    }

    const frame = await this.signMcpRequest(request, tool, action);
    
    return new Promise((resolve, reject) => {
      const correlationId = frame.correlationId;
      
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new TalosTransportError(`Request ${correlationId} timed out`));
      }, 30000);

      this.pendingRequests.set(correlationId, { resolve, reject, timeout });

      try {
        this.socket!.send(JSON.stringify(frame));
      } catch (err) {
        clearTimeout(timeout);
        this.pendingRequests.delete(correlationId);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }
}
