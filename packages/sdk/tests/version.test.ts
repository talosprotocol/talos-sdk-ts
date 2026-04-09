import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { canonicalize } from "../src/encoding/canonical_json.js";
import {
  CONTRACT_MANIFEST_HASH,
  SDK_VERSION,
  SUPPORTED_PROTOCOL_RANGE,
} from "../src/index.js";

function expectedContractManifestHash(): string {
  const manifestUrl = new URL(
    "../../../../../contracts/sdk/contract_manifest.json",
    import.meta.url,
  );
  const manifestPath = fileURLToPath(manifestUrl);
  const payload = JSON.parse(readFileSync(manifestPath, "utf-8")) as unknown;
  const digest = createHash("sha256").update(canonicalize(payload)).digest("base64url");
  return digest;
}

describe("version exports", () => {
  it("exports pinned SDK version metadata", () => {
    expect(SDK_VERSION).toBe("1.0.0");
    expect(SUPPORTED_PROTOCOL_RANGE).toEqual(["1.0", "1.x"]);
  });

  it("pins the canonical contracts manifest hash", () => {
    expect(CONTRACT_MANIFEST_HASH).toBe(expectedContractManifestHash());
    expect(CONTRACT_MANIFEST_HASH).not.toContain(":");
  });
});
