/**
 * Talos SDK Errors
 *
 * Canonical error taxonomy as defined in ERROR_TAXONOMY.md.
 */

export interface TalosErrorDetails {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
  cause?: string;
}

export class TalosError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly requestId?: string;
  readonly cause_message?: string;

  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>,
    requestId?: string,
    cause?: Error,
  ) {
    super(message);
    this.name = "TalosError";
    this.code = code;
    this.details = details ?? {};
    this.requestId = requestId;
    this.cause_message = cause?.message;
  }

  toJSON(): TalosErrorDetails {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      requestId: this.requestId,
      cause: this.cause_message,
    };
  }
}

// Authorization Errors
export class TalosDeniedError extends TalosError {
  constructor(
    message = "Authorization denied",
    details?: Record<string, unknown>,
  ) {
    super("TALOS_DENIED", message, details);
    this.name = "TalosDeniedError";
  }
}

export class TalosInvalidCapabilityError extends TalosError {
  constructor(
    message = "Invalid capability token",
    details?: Record<string, unknown>,
  ) {
    super("TALOS_INVALID_CAPABILITY", message, details);
    this.name = "TalosInvalidCapabilityError";
  }
}

// Protocol Errors
export class TalosProtocolMismatchError extends TalosError {
  constructor(
    message = "Protocol version mismatch",
    details?: Record<string, unknown>,
  ) {
    super("TALOS_PROTOCOL_MISMATCH", message, details);
    this.name = "TalosProtocolMismatchError";
  }
}

export class TalosFrameInvalidError extends TalosError {
  constructor(message = "Invalid frame", details?: Record<string, unknown>) {
    super("TALOS_FRAME_INVALID", message, details);
    this.name = "TalosFrameInvalidError";
  }
}

// Crypto Errors
export class TalosCryptoError extends TalosError {
  constructor(
    message = "Cryptographic operation failed",
    details?: Record<string, unknown>,
  ) {
    super("TALOS_CRYPTO_ERROR", message, details);
    this.name = "TalosCryptoError";
  }
}

export class TalosInvalidInputError extends TalosError {
  constructor(message = "Invalid input", details?: Record<string, unknown>) {
    super("TALOS_INVALID_INPUT", message, details);
    this.name = "TalosInvalidInputError";
  }
}

// Transport Errors
export class TalosTransportTimeoutError extends TalosError {
  constructor(
    message = "Transport timeout",
    details?: Record<string, unknown>,
  ) {
    super("TALOS_TRANSPORT_TIMEOUT", message, details);
    this.name = "TalosTransportTimeoutError";
  }
}

export class TalosTransportError extends TalosError {
  constructor(message = "Transport error", details?: Record<string, unknown>) {
    super("TALOS_TRANSPORT_ERROR", message, details);
    this.name = "TalosTransportError";
  }
}
