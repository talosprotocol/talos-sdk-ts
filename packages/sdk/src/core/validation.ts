import Ajv from "ajv/dist/2019.js";
import addFormats from "ajv-formats";
import { TalosInvalidInputError } from "./errors.js";

// @ts-ignore
const ajv = new Ajv({ strict: "log", allErrors: true });
(addFormats as any)(ajv);

// Add meta-schema mocks for offline testing
ajv.addSchema({ $id: "https://json-schema.org/draft/2020-12/schema" }, "https://json-schema.org/draft/2020-12/schema");
ajv.addSchema({ $id: "http://json-schema.org/draft-07/schema" }, "http://json-schema.org/draft-07/schema"); // For wide compat

/**
 * Validates an identity object against normative Draft 2020-12 schemas.
 */
export function validateIdentity(identity: any, schema: any, typeName: string): void {
  // If schema has not been added to ajv, add it
  const schemaId = schema.$id;
  if (!ajv.getSchema(schemaId)) {
    ajv.addSchema(schema);
  }

  const validate = ajv.getSchema(schemaId);
  if (!validate) {
    throw new TalosInvalidInputError(`Schema for ${typeName} not found or invalid`);
  }

  const valid = validate(identity);
  if (!valid) {
    const errors = validate.errors?.map((e: any) => `${e.instancePath} ${e.message}`).join(", ");
    throw new TalosInvalidInputError(`Identity validation failed for ${typeName}: ${errors}`);
  }
}
