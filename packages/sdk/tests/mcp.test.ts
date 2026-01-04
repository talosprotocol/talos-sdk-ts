import { describe, it, expect } from "vitest";
import * as mcp from "../src/core/mcp.js";

describe("MCP Framing", () => {
  it("should compute request hash", async () => {
    const req = { method: "tool/call", params: { foo: "bar" } };
    const hash = await mcp.computeRequestHash(req);
    expect(hash).toBeDefined();
    expect(typeof hash).toBe("string");
    expect(hash.length).toBe(64); // SHA256 hex
  });

  it("should compute response hash", async () => {
    const res = { result: { status: "ok" } };
    const hash = await mcp.computeResponseHash(res);
    expect(hash).toBeDefined();
    expect(typeof hash).toBe("string");
    expect(hash.length).toBe(64);
  });

  it("should canonicalize requests", () => {
    const req = { b: 2, a: 1 };
    const canon = mcp.canonicalizeMcpRequest(req);
    const str = new TextDecoder().decode(canon);
    // Canonical JSON sorts keys: {"a":1,"b":2}
    expect(str).toContain('"a":1');
    expect(str.indexOf('"a":1')).toBeLessThan(str.indexOf('"b":2'));
  });
});
