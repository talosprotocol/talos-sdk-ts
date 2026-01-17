import { describe, test, expect } from "vitest";
import { validateIdentity } from "../src/core/validation.js";
import { TalosInvalidInputError } from "../src/core/errors.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VECTORS_PATH = path.resolve(__dirname, "../../../../../contracts/test_vectors/sdk/identity_vectors.json");
const SCHEMAS_DIR = path.resolve(__dirname, "../../../../../contracts/schemas/rbac");

function readJson(p: string) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

const matrix = readJson(VECTORS_PATH);

describe("Identity Hardening Validation (SDK)", () => {
  for (const [schemaType, categories] of Object.entries(matrix)) {
    const schema = readJson(path.join(SCHEMAS_DIR, `${schemaType}.schema.json`));

    describe(`Schema: ${schemaType}`, () => {
      // @ts-expect-error -- implicit any from json matrix
      for (const [category, vectors] of Object.entries(categories)) {
        const isValidExpected = category === "valid";
        
        // @ts-expect-error -- implicit any from json vectors
        for (const vector of vectors) {
          test(`[${category}] ${vector.name}`, () => {
            if (isValidExpected) {
              expect(() => validateIdentity(vector.data, schema, schemaType)).not.toThrow();
            } else {
              expect(() => validateIdentity(vector.data, schema, schemaType)).toThrow(TalosInvalidInputError);
            }
          });
        }
      }
    });
  }
});
