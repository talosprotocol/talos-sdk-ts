import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import { A2AJsonRpcClient } from "../src/index.js";

const testDir = dirname(fileURLToPath(import.meta.url));
const pythonSdkRoot = resolve(testDir, "../../../../python");
const pythonSourceRoot = resolve(pythonSdkRoot, "src");

const serverProcesses = new Set<ChildProcessWithoutNullStreams>();

afterEach(async () => {
  await Promise.all(Array.from(serverProcesses, stopReferenceServer));
  serverProcesses.clear();
});

describe("A2AJsonRpcClient live interop", () => {
  it("talks to the Python reference fixture over real HTTP", async () => {
    const port = await freePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const server = spawnReferenceServer(port);
    serverProcesses.add(server);

    try {
      await waitForReady(baseUrl, server);

      const client = new A2AJsonRpcClient(baseUrl, { apiToken: "sdk-token" });
      const card = await client.getAgentCard();
      const extended = await client.getExtendedAgentCard();
      const rpcExtended = await client.getAuthenticatedExtendedAgentCard();
      const listed = await client.listTasks({ pageSize: 5 });
      const sent = await client.sendMessage("hello from typescript");
      const taskId = String((sent.task as Record<string, unknown>).id);

      const streamed: Array<Record<string, unknown>> = [];
      for await (const event of client.sendStreamingMessage("hello from typescript")) {
        streamed.push(event);
      }

      const subscribed: Array<Record<string, unknown>> = [];
      for await (const event of client.subscribeToTask(taskId)) {
        subscribed.push(event);
      }

      expect(await client.supportedInterfaces(card)).toHaveLength(1);
      expect((extended.skills as Array<Record<string, unknown>>)[0]?.id).toBe("reference-echo");
      expect((rpcExtended.skills as Array<Record<string, unknown>>)[0]?.id).toBe("reference-echo");
      expect((listed.tasks as Array<Record<string, unknown>>).length).toBeGreaterThanOrEqual(1);
      expect((sent.message as Record<string, unknown>).parts).toEqual([
        { text: "reference echo: hello from typescript" },
      ]);
      expect(streamed).toHaveLength(3);
      expect((streamed[2].message as Record<string, unknown>).parts).toEqual([
        { text: "reference echo: hello from typescript" },
      ]);
      expect(subscribed).toHaveLength(2);
      expect(
        ((subscribed[1].statusUpdate as Record<string, unknown>).metadata as Record<string, unknown>).final,
      ).toBe(true);
    } finally {
      serverProcesses.delete(server);
      await stopReferenceServer(server);
    }
  }, 15_000);
});

async function freePort(): Promise<number> {
  return await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Unable to determine free port")));
        return;
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolvePort(address.port);
      });
    });
  });
}

function spawnReferenceServer(port: number): ChildProcessWithoutNullStreams {
  return spawn(
    "python3",
    [
      "examples/a2a_v1_reference_server.py",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--api-token",
      "sdk-token",
    ],
    {
      cwd: pythonSdkRoot,
      env: {
        ...process.env,
        PYTHONPATH: pythonSourceRoot,
      },
      stdio: "pipe",
    },
  );
}

async function waitForReady(url: string, proc: ChildProcessWithoutNullStreams, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) {
      throw new Error(await processOutput(proc));
    }

    try {
      const response = await fetch(`${url}/.well-known/agent-card.json`);
      if (response.ok) {
        return;
      }
    } catch {
      // Server is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Timed out waiting for reference server at ${url}`);
}

async function stopReferenceServer(proc: ChildProcessWithoutNullStreams): Promise<void> {
  if (proc.exitCode !== null) {
    return;
  }

  proc.kill("SIGTERM");
  await new Promise<void>((resolveStop) => {
    const timer = setTimeout(() => {
      if (proc.exitCode === null) {
        proc.kill("SIGKILL");
      }
    }, 5_000);
    proc.once("exit", () => {
      clearTimeout(timer);
      resolveStop();
    });
  });
}

async function processOutput(proc: ChildProcessWithoutNullStreams): Promise<string> {
  const stdout = await streamToString(proc.stdout);
  const stderr = await streamToString(proc.stderr);
  return `Reference server exited early.\nstdout:\n${stdout}\nstderr:\n${stderr}`;
}

async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf-8");
}
