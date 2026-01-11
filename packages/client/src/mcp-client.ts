import { fetch } from 'undici';

export interface McpServerRef {
  id: string;
  name: string;
  transport: string;
  metadata?: Record<string, string>;
}

export interface McpToolRef {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export class McpClient {
  private gatewayUrl: string;
  private apiToken?: string;

  constructor(gatewayUrl: string, apiToken?: string) {
    this.gatewayUrl = gatewayUrl.replace(/\/$/, '');
    this.apiToken = apiToken || process.env.TALOS_API_TOKEN;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiToken) {
      headers['Authorization'] = `Bearer ${this.apiToken}`;
    }
    return headers;
  }

  async listServers(): Promise<McpServerRef[]> {
    const url = `${this.gatewayUrl}/v1/mcp/servers`;
    const resp = await fetch(url, { headers: this.getHeaders() });
    if (!resp.ok) {
      throw new Error(`Failed to list servers: ${resp.statusText}`);
    }
    const data = (await resp.json()) as { servers: McpServerRef[] };
    return data.servers || [];
  }

  async listTools(serverId: string): Promise<McpToolRef[]> {
    const url = `${this.gatewayUrl}/v1/mcp/servers/${serverId}/tools`;
    const resp = await fetch(url, { headers: this.getHeaders() });
    if (!resp.ok) {
      throw new Error(`Failed to list tools: ${resp.statusText}`);
    }
    const data = (await resp.json()) as { tools: McpToolRef[] };
    return data.tools || [];
  }

  async getToolSchema(serverId: string, toolName: string): Promise<Record<string, unknown>> {
    const url = `${this.gatewayUrl}/v1/mcp/servers/${serverId}/tools/${toolName}/schema`;
    const resp = await fetch(url, { headers: this.getHeaders() });
    if (!resp.ok) {
      throw new Error(`Failed to get schema: ${resp.statusText}`);
    }
    const data = (await resp.json()) as { json_schema: Record<string, unknown> };
    return data.json_schema || {};
  }

  async invokeTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const url = `${this.gatewayUrl}/v1/mcp/servers/${serverId}/tools/${toolName}:call`;
    const payload = { input: args };
    
    const resp = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      throw new Error(`Failed to invoke tool: ${resp.statusText}`);
    }

    const data = (await resp.json()) as { output?: unknown; error?: unknown };
    if (data.error) {
      throw new Error(`MCP Invocation Error: ${JSON.stringify(data.error)}`);
    }

    return data.output || {};
  }
}
