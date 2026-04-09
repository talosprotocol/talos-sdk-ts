export const TALOS_ATTESTATION_EXTENSION =
  "https://talosprotocol.com/extensions/a2a/attestation/v1";
export const TALOS_SECURE_CHANNELS_EXTENSION =
  "https://talosprotocol.com/extensions/a2a/secure-channels/v1";
export const TALOS_COMPAT_JSONRPC_EXTENSION =
  "https://talosprotocol.com/extensions/a2a/compat-jsonrpc/v0";

type JsonObject = Record<string, unknown>;

export type A2AInteropProfile = "canonical" | "upstream_v0_3" | "upstream_java_hybrid";

const UPSTREAM_V0_3_METHOD_ALIASES: Record<string, string> = {
  GetExtendedAgentCard: "agent/getAuthenticatedExtendedCard",
  SendMessage: "message/send",
  SendStreamingMessage: "message/stream",
  GetTask: "tasks/get",
  CancelTask: "tasks/cancel",
  ListTasks: "tasks/list",
  SubscribeToTask: "tasks/resubscribe",
  CreateTaskPushNotificationConfig: "tasks/pushNotificationConfig/set",
  GetTaskPushNotificationConfig: "tasks/pushNotificationConfig/get",
  ListTaskPushNotificationConfigs: "tasks/pushNotificationConfig/list",
  DeleteTaskPushNotificationConfig: "tasks/pushNotificationConfig/delete",
};

export interface A2AJsonRpcClientOptions {
  apiToken?: string;
  fetchImpl?: typeof fetch;
  interopProfile?: A2AInteropProfile;
}

export interface A2AMessageOptions {
  messageId?: string;
  taskId?: string;
  contextId?: string;
  configuration?: JsonObject;
  metadata?: JsonObject;
}

export interface A2ATaskOptions {
  historyLength?: number;
  includeArtifacts?: boolean;
}

export interface A2AListTasksOptions extends A2ATaskOptions {
  contextId?: string;
  status?: string;
  pageSize?: number;
  pageToken?: string;
}

export interface A2APushNotificationConfigOptions {
  url: string;
  token?: string;
  authentication?: JsonObject;
  configId?: string;
}

export class A2AJsonRpcError extends Error {
  readonly code: number;
  readonly data: JsonObject;

  constructor(code: number, message: string, data: JsonObject = {}) {
    super(message);
    this.name = "A2AJsonRpcError";
    this.code = code;
    this.data = data;
  }
}

export class A2AHttpError extends Error {
  readonly statusCode: number;
  readonly payload: unknown;

  constructor(statusCode: number, payload: unknown) {
    super(`HTTP ${statusCode}: ${stringifyUnknown(payload)}`);
    this.name = "A2AHttpError";
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

export class A2AJsonRpcClient {
  readonly baseUrl: string;
  readonly apiToken?: string;
  readonly interopProfile: A2AInteropProfile;
  private readonly fetchImpl: typeof fetch;
  private agentCardCache?: JsonObject;

  constructor(baseUrl: string, options: A2AJsonRpcClientOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiToken = options.apiToken;
    this.interopProfile = options.interopProfile ?? "canonical";
    if (
      this.interopProfile !== "canonical" &&
      this.interopProfile !== "upstream_v0_3" &&
      this.interopProfile !== "upstream_java_hybrid"
    ) {
      throw new Error(`Unsupported interop profile: ${String(this.interopProfile)}`);
    }
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getAgentCard(): Promise<JsonObject> {
    const payload = await this.requestJson(`${this.baseUrl}/.well-known/agent-card.json`, {
      method: "GET",
    });
    this.agentCardCache = payload;
    return payload;
  }

  async getExtendedAgentCard(): Promise<JsonObject> {
    if (this.usesUpstreamV03Profile()) {
      return this.getAuthenticatedExtendedAgentCard();
    }
    return this.requestJson(`${this.baseUrl}/extendedAgentCard`, {
      method: "GET",
    });
  }

  async getAuthenticatedExtendedAgentCard(): Promise<JsonObject> {
    return this.rpc("GetExtendedAgentCard");
  }

  async supportedInterfaces(card?: JsonObject): Promise<JsonObject[]> {
    const payload = card ?? (await this.getAgentCard());
    const interfaces = payload.supportedInterfaces;
    if (Array.isArray(interfaces)) {
      return interfaces.filter(isRecord);
    }
    const compatInterface = this.compatSupportedInterface(payload);
    return compatInterface ? [compatInterface] : [];
  }

  async extensionUris(card?: JsonObject): Promise<string[]> {
    const payload = card ?? (await this.getAgentCard());
    const capabilities = payload.capabilities;
    if (!isRecord(capabilities)) {
      return [];
    }

    const extensions = capabilities.extensions;
    if (!Array.isArray(extensions)) {
      return [];
    }

    return extensions
      .filter(isRecord)
      .map((item) => item.uri)
      .filter((uri): uri is string => typeof uri === "string");
  }

  async supportsExtension(uri: string, card?: JsonObject): Promise<boolean> {
    return (await this.extensionUris(card)).includes(uri);
  }

  async supportsTalosSecureChannels(card?: JsonObject): Promise<boolean> {
    return this.supportsExtension(TALOS_SECURE_CHANNELS_EXTENSION, card);
  }

  async supportsTalosAttestation(card?: JsonObject): Promise<boolean> {
    return this.supportsExtension(TALOS_ATTESTATION_EXTENSION, card);
  }

  async supportsTalosCompatJsonrpc(card?: JsonObject): Promise<boolean> {
    return this.supportsExtension(TALOS_COMPAT_JSONRPC_EXTENSION, card);
  }

  async sendMessage(text: string, options: A2AMessageOptions = {}): Promise<JsonObject> {
    const params: JsonObject = {
      message: this.message(text, options),
    };
    if (options.configuration) {
      params.configuration = options.configuration;
    }
    return this.rpc("SendMessage", params);
  }

  sendStreamingMessage(
    text: string,
    options: A2AMessageOptions = {},
  ): AsyncGenerator<JsonObject, void, void> {
    const params: JsonObject = {
      message: this.message(text, options),
    };
    if (options.configuration) {
      params.configuration = options.configuration;
    }
    return this.stream("SendStreamingMessage", params);
  }

  async getTask(taskId: string, options: A2ATaskOptions = {}): Promise<JsonObject> {
    return this.rpc("GetTask", this.taskParams(taskId, options));
  }

  async cancelTask(taskId: string, options: A2ATaskOptions = {}): Promise<JsonObject> {
    return this.rpc("CancelTask", this.taskParams(taskId, options));
  }

  async listTasks(options: A2AListTasksOptions = {}): Promise<JsonObject> {
    const params: JsonObject = {
      includeArtifacts: options.includeArtifacts ?? false,
    };
    if (options.contextId !== undefined) {
      params.contextId = options.contextId;
    }
    if (options.status !== undefined) {
      params.status = options.status;
    }
    if (options.pageSize !== undefined) {
      params.pageSize = options.pageSize;
    }
    if (options.pageToken !== undefined) {
      params.pageToken = options.pageToken;
    }
    if (options.historyLength !== undefined) {
      params.historyLength = options.historyLength;
    }
    return this.rpc("ListTasks", params);
  }

  subscribeToTask(
    taskId: string,
    options: A2ATaskOptions = {},
  ): AsyncGenerator<JsonObject, void, void> {
    return this.stream("SubscribeToTask", this.taskParams(taskId, options));
  }

  async setTaskPushNotificationConfig(
    taskId: string,
    options: A2APushNotificationConfigOptions,
  ): Promise<JsonObject> {
    const params: JsonObject = {
      taskId,
      id: options.configId ?? this.newId("push"),
      url: options.url,
    };
    if (options.token !== undefined) {
      params.token = options.token;
    }
    if (options.authentication !== undefined) {
      params.authentication = options.authentication;
    }
    return this.rpc("CreateTaskPushNotificationConfig", params);
  }

  async getTaskPushNotificationConfig(
    taskId: string,
    configId: string,
  ): Promise<JsonObject> {
    return this.rpc("GetTaskPushNotificationConfig", { taskId, id: configId });
  }

  async listTaskPushNotificationConfigs(taskId: string): Promise<JsonObject> {
    return this.rpc("ListTaskPushNotificationConfigs", { taskId });
  }

  async deleteTaskPushNotificationConfig(
    taskId: string,
    configId: string,
  ): Promise<JsonObject> {
    return this.rpc("DeleteTaskPushNotificationConfig", { taskId, id: configId });
  }

  async rpc(method: string, params: JsonObject = {}): Promise<JsonObject> {
    const payload = await this.requestJson(await this.rpcUrl(), {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: this.newId("rpc"),
        method: this.rpcMethod(method),
        params,
      }),
    });
    return this.extractResult(payload);
  }

  async *stream(
    method: string,
    params: JsonObject = {},
  ): AsyncGenerator<JsonObject, void, void> {
    const response = await this.fetchImpl(await this.rpcUrl(), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: this.newId("stream"),
        method: this.rpcMethod(method),
        params,
      }),
    });

    await this.ensureOk(response);

    if (!response.body) {
      throw new Error("Streaming response body unavailable");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) {
          break;
        }

        buffer += decoder.decode(chunk.value, { stream: true });
        yield* this.parseSseBuffer(buffer, (remaining) => {
          buffer = remaining;
        });
      }

      buffer += decoder.decode();
      yield* this.parseSseBuffer(buffer, () => {
        buffer = "";
      }, true);
    } finally {
      reader.releaseLock();
    }
  }

  private async requestJson(url: string, init: RequestInit): Promise<JsonObject> {
    const response = await this.fetchImpl(url, {
      ...init,
      headers: this.headers(),
    });
    await this.ensureOk(response);

    const payload: unknown = await response.json();
    if (!isRecord(payload)) {
      throw new Error(`Unexpected A2A response body: ${stringifyUnknown(payload)}`);
    }
    return payload;
  }

  private async ensureOk(response: Response): Promise<void> {
    if (response.ok) {
      return;
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = await response.text();
    }
    throw new A2AHttpError(response.status, payload);
  }

  private extractResult(payload: JsonObject): JsonObject {
    const error = payload.error;
    if (isRecord(error)) {
      throw new A2AJsonRpcError(
        typeof error.code === "number" ? error.code : -32603,
        typeof error.message === "string" ? error.message : "JSON-RPC error",
        isRecord(error.data) ? error.data : {},
      );
    }

    const result = payload.result;
    if (!isRecord(result)) {
      throw new Error(`Unexpected A2A response: ${stringifyUnknown(payload)}`);
    }
    return result;
  }

  private headers(): HeadersInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiToken) {
      headers.Authorization = `Bearer ${this.apiToken}`;
    }
    return headers;
  }

  private message(text: string, options: A2AMessageOptions): JsonObject {
    const message: JsonObject = {
      messageId: options.messageId ?? this.newId("msg"),
      role: this.messageRole(),
      parts: [this.messagePart(text)],
    };
    if (options.taskId !== undefined) {
      message.taskId = options.taskId;
    }
    if (options.contextId !== undefined) {
      message.contextId = options.contextId;
    }
    if (options.metadata !== undefined) {
      message.metadata = options.metadata;
    }
    return message;
  }

  private taskParams(taskId: string, options: A2ATaskOptions): JsonObject {
    const params: JsonObject = {
      id: taskId,
      includeArtifacts: options.includeArtifacts ?? false,
    };
    if (options.historyLength !== undefined) {
      params.historyLength = options.historyLength;
    }
    return params;
  }

  private usesUpstreamV03Profile(): boolean {
    return this.interopProfile === "upstream_v0_3";
  }

  private usesUpstreamJavaHybridProfile(): boolean {
    return this.interopProfile === "upstream_java_hybrid";
  }

  private rpcMethod(method: string): string {
    if (!this.usesUpstreamV03Profile()) {
      return method;
    }
    return UPSTREAM_V0_3_METHOD_ALIASES[method] ?? method;
  }

  private async rpcUrl(): Promise<string> {
    if (this.interopProfile === "canonical") {
      return `${this.baseUrl}/rpc`;
    }
    const card = this.agentCardCache ?? (await this.getAgentCard());
    const rawUrl = this.profileRpcUrl(card);
    return this.normalizeLocalhostUrl(new URL(rawUrl, `${this.baseUrl}/`).toString());
  }

  private compatSupportedInterface(payload: JsonObject): JsonObject | undefined {
    if (!this.usesUpstreamV03Profile() || typeof payload.protocolVersion !== "string") {
      return undefined;
    }
    const rawUrl = typeof payload.url === "string" ? payload.url : "/";
    return {
      url: this.normalizeLocalhostUrl(new URL(rawUrl, `${this.baseUrl}/`).toString()),
      protocolBinding:
        typeof payload.preferredTransport === "string" ? payload.preferredTransport : "JSONRPC",
      protocolVersion: payload.protocolVersion,
    };
  }

  private messagePart(text: string): JsonObject {
    if (this.usesUpstreamV03Profile()) {
      return { kind: "text", text };
    }
    return { text };
  }

  private messageRole(): string {
    if (this.usesUpstreamJavaHybridProfile()) {
      return "ROLE_USER";
    }
    return "user";
  }

  private profileRpcUrl(payload: JsonObject): string {
    if (this.usesUpstreamJavaHybridProfile() && Array.isArray(payload.supportedInterfaces)) {
      for (const item of payload.supportedInterfaces) {
        if (isRecord(item) && typeof item.url === "string") {
          return item.url;
        }
      }
    }
    return typeof payload.url === "string" ? payload.url : "/";
  }

  private normalizeLocalhostUrl(value: string): string {
    const base = new URL(`${this.baseUrl}/`);
    const target = new URL(value, `${this.baseUrl}/`);
    if (isLocalAlias(base.hostname) && isLocalAlias(target.hostname) && base.port === target.port) {
      target.hostname = base.hostname;
    }
    return target.toString();
  }

  private newId(prefix: string): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  private *parseSseBuffer(
    buffer: string,
    setRemaining: (remaining: string) => void,
    flush = false,
  ): Generator<JsonObject, void, void> {
    let remaining = buffer;

    while (true) {
      const newlineIndex = remaining.indexOf("\n");
      if (newlineIndex === -1) {
        break;
      }

      const rawLine = remaining.slice(0, newlineIndex).replace(/\r$/, "");
      remaining = remaining.slice(newlineIndex + 1);
      const line = rawLine.trim();
      if (!line.startsWith("data: ")) {
        continue;
      }

      const payload = JSON.parse(line.slice(6)) as unknown;
      if (!isRecord(payload)) {
        throw new Error(`Unexpected A2A stream event: ${stringifyUnknown(payload)}`);
      }
      yield this.extractResult(payload);
    }

    if (flush) {
      const line = remaining.trim();
      if (line.startsWith("data: ")) {
        const payload = JSON.parse(line.slice(6)) as unknown;
        if (!isRecord(payload)) {
          throw new Error(`Unexpected A2A stream event: ${stringifyUnknown(payload)}`);
        }
        yield this.extractResult(payload);
        remaining = "";
      }
    }

    setRemaining(remaining);
  }
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLocalAlias(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
