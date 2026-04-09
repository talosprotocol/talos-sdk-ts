import { afterEach, describe, expect, it, vi } from "vitest";

import {
  A2AJsonRpcClient,
  A2AJsonRpcError,
  TALOS_ATTESTATION_EXTENSION,
  TALOS_COMPAT_JSONRPC_EXTENSION,
  TALOS_SECURE_CHANNELS_EXTENSION,
} from "../src/index.js";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("A2AJsonRpcClient", () => {
  it("discovers supported interfaces and Talos extension URIs", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        name: "Talos",
        supportedInterfaces: [
          {
            protocolBinding: "JSONRPC",
            protocolVersion: "1.0",
            url: "http://testserver/rpc",
          },
        ],
        capabilities: {
          extensions: [
            { uri: TALOS_ATTESTATION_EXTENSION },
            { uri: TALOS_SECURE_CHANNELS_EXTENSION },
            { uri: TALOS_COMPAT_JSONRPC_EXTENSION },
          ],
        },
      }),
    );

    const client = new A2AJsonRpcClient("http://testserver", {
      fetchImpl: fetchMock,
    });

    const card = await client.getAgentCard();

    expect(await client.supportedInterfaces(card)).toEqual([
      {
        protocolBinding: "JSONRPC",
        protocolVersion: "1.0",
        url: "http://testserver/rpc",
      },
    ]);
    expect(await client.supportsTalosAttestation(card)).toBe(true);
    expect(await client.supportsTalosSecureChannels(card)).toBe(true);
    expect(await client.supportsTalosCompatJsonrpc(card)).toBe(true);
    expect(await client.supportsExtension("https://example.com/ext", card)).toBe(false);
  });

  it("formats SendMessage JSON-RPC requests with auth headers", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        jsonrpc: "2.0",
        id: "rpc-1",
        result: {
          task: { id: "task-1" },
          message: { parts: [{ text: "Hello from gateway" }] },
        },
      }),
    );

    const client = new A2AJsonRpcClient("http://testserver", {
      apiToken: "sk-test",
      fetchImpl: fetchMock,
    });

    const result = await client.sendMessage("Hello", {
      messageId: "msg-1",
      taskId: "task-1",
      contextId: "ctx-1",
      metadata: { traceId: "trace-1" },
      configuration: { historyLength: 1 },
    });

    expect(result).toEqual({
      task: { id: "task-1" },
      message: { parts: [{ text: "Hello from gateway" }] },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://testserver/rpc");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");

    const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(payload.jsonrpc).toBe("2.0");
    expect(payload.method).toBe("SendMessage");
    expect(payload.params).toEqual({
      configuration: { historyLength: 1 },
      message: {
        messageId: "msg-1",
        taskId: "task-1",
        contextId: "ctx-1",
        role: "user",
        parts: [{ text: "Hello" }],
        metadata: { traceId: "trace-1" },
      },
    });
  });

  it("supports upstream_v0_3 compat profile", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = String(input);
      if (!init || init.method === "GET") {
        expect(url).toBe("http://127.0.0.1:9999/.well-known/agent-card.json");
        return jsonResponse({
          name: "Legacy Agent",
          protocolVersion: "0.3.0",
          preferredTransport: "JSONRPC",
          url: "http://localhost:9999/",
        });
      }

      const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
      expect(url).toBe("http://127.0.0.1:9999/");

      if (payload.method === "agent/getAuthenticatedExtendedCard") {
        return jsonResponse({
          jsonrpc: "2.0",
          id: payload.id,
          result: {
            name: "Legacy Agent",
            protocolVersion: "0.3.0",
          },
        });
      }

      if (payload.method === "message/send") {
        return jsonResponse({
          jsonrpc: "2.0",
          id: payload.id,
          result: {
            task: { id: "legacy-task-1" },
            message: { parts: (payload.params as Record<string, unknown>).message.parts },
          },
        });
      }

      if (payload.method === "tasks/list") {
        return jsonResponse({
          jsonrpc: "2.0",
          id: payload.id,
          result: {
            tasks: [{ id: "legacy-task-1" }],
            totalSize: 1,
          },
        });
      }

      if (payload.method === "message/stream") {
        return sseResponse([
          'data: {"jsonrpc":"2.0","id":"stream-1","result":{"delta":"legacy-one"}}\n',
          'data: {"jsonrpc":"2.0","id":"stream-1","result":{"delta":"legacy-two"}}\n',
        ]);
      }

      if (payload.method === "tasks/resubscribe") {
        return sseResponse([
          'data: {"jsonrpc":"2.0","id":"stream-2","result":{"task":{"id":"legacy-task-1"}}}\n',
          'data: {"jsonrpc":"2.0","id":"stream-2","result":{"statusUpdate":{"taskId":"legacy-task-1"}}}\n',
        ]);
      }

      throw new Error(`Unexpected method: ${String(payload.method)}`);
    });

    const client = new A2AJsonRpcClient("http://127.0.0.1:9999", {
      fetchImpl: fetchMock,
      interopProfile: "upstream_v0_3",
    });

    const card = await client.getAgentCard();
    const interfaces = await client.supportedInterfaces(card);
    const extended = await client.getExtendedAgentCard();
    const sent = await client.sendMessage("legacy hello");
    const listed = await client.listTasks({ pageSize: 5 });

    const streamed: Array<Record<string, unknown>> = [];
    for await (const event of client.sendStreamingMessage("legacy hello")) {
      streamed.push(event);
    }

    const subscribed: Array<Record<string, unknown>> = [];
    for await (const event of client.subscribeToTask("legacy-task-1")) {
      subscribed.push(event);
    }

    expect(interfaces).toEqual([
      {
        url: "http://127.0.0.1:9999/",
        protocolBinding: "JSONRPC",
        protocolVersion: "0.3.0",
      },
    ]);
    expect(extended).toEqual({
      name: "Legacy Agent",
      protocolVersion: "0.3.0",
    });
    expect(sent).toEqual({
      task: { id: "legacy-task-1" },
      message: { parts: [{ kind: "text", text: "legacy hello" }] },
    });
    expect(listed.totalSize).toBe(1);
    expect(streamed).toEqual([{ delta: "legacy-one" }, { delta: "legacy-two" }]);
    expect(subscribed[1]).toEqual({ statusUpdate: { taskId: "legacy-task-1" } });
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/extendedAgentCard"))).toBe(false);
  });

  it("supports upstream_java_hybrid profile", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = String(input);
      if (!init || init.method === "GET") {
        expect(url).toBe("http://127.0.0.1:9999/.well-known/agent-card.json");
        return jsonResponse({
          name: "Java Hybrid Agent",
          supportedInterfaces: [
            {
              protocolBinding: "JSONRPC",
              protocolVersion: "1.0",
              url: "http://localhost:9999/",
            },
          ],
          capabilities: {
            extendedAgentCard: false,
            streaming: true,
          },
        });
      }

      const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
      expect(url).toBe("http://127.0.0.1:9999/");

      if (payload.method === "SendMessage") {
        expect((payload.params as Record<string, unknown>).message).toEqual({
          messageId: expect.stringMatching(/^msg-/),
          role: "ROLE_USER",
          parts: [{ text: "java hello" }],
        });
        return jsonResponse({
          jsonrpc: "2.0",
          id: payload.id,
          result: {
            message: { parts: [{ text: "hello from java" }] },
          },
        });
      }

      if (payload.method === "SendStreamingMessage") {
        return sseResponse([
          'data: {"jsonrpc":"2.0","id":"stream-1","result":{"delta":"java-one"}}\n',
          'data: {"jsonrpc":"2.0","id":"stream-1","result":{"delta":"java-two"}}\n',
        ]);
      }

      throw new Error(`Unexpected method: ${String(payload.method)}`);
    });

    const client = new A2AJsonRpcClient("http://127.0.0.1:9999", {
      fetchImpl: fetchMock,
      interopProfile: "upstream_java_hybrid",
    });

    const card = await client.getAgentCard();
    const interfaces = await client.supportedInterfaces(card);
    const sent = await client.sendMessage("java hello");

    const streamed: Array<Record<string, unknown>> = [];
    for await (const event of client.sendStreamingMessage("java hello")) {
      streamed.push(event);
    }

    expect(interfaces).toEqual([
      {
        protocolBinding: "JSONRPC",
        protocolVersion: "1.0",
        url: "http://localhost:9999/",
      },
    ]);
    expect(sent).toEqual({
      message: { parts: [{ text: "hello from java" }] },
    });
    expect(streamed).toEqual([{ delta: "java-one" }, { delta: "java-two" }]);
  });

  it("raises typed JSON-RPC errors", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        jsonrpc: "2.0",
        id: "rpc-1",
        error: {
          code: -32000,
          message: "Permission denied",
          data: { talos_code: "RBAC_DENIED" },
        },
      }),
    );

    const client = new A2AJsonRpcClient("http://testserver", {
      fetchImpl: fetchMock,
    });

    await expect(client.getAuthenticatedExtendedAgentCard()).rejects.toEqual(
      expect.objectContaining<A2AJsonRpcError>({
        code: -32000,
        message: "Permission denied",
        data: { talos_code: "RBAC_DENIED" },
      }),
    );

    const [, init] = fetchMock.mock.calls[0];
    const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(payload.method).toBe("GetExtendedAgentCard");
  });

  it("parses SSE stream events from SendStreamingMessage", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      sseResponse([
        'data: {"jsonrpc":"2.0","id":"stream-1","result":{"delta":"one"}}\n',
        "\n",
        'data: {"jsonrpc":"2.0","id":"stream-1","result":{"delta":"two"}}\n',
      ]),
    );

    const client = new A2AJsonRpcClient("http://testserver", {
      fetchImpl: fetchMock,
    });

    const events: Array<Record<string, unknown>> = [];
    for await (const event of client.sendStreamingMessage("Hello")) {
      events.push(event);
    }

    expect(events).toEqual([{ delta: "one" }, { delta: "two" }]);

    const [, init] = fetchMock.mock.calls[0];
    const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(payload.method).toBe("SendStreamingMessage");
  });
});
