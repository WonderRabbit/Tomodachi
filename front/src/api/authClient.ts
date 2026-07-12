import { appConfig } from "../config/runtimeConfig";

export type LoginCredentials = {
  readonly email: string;
  readonly password: string;
};

export type LoginResponse = {
  readonly accessToken: string;
  readonly tokenType: "Bearer";
};

type ErrorResponse = {
  readonly code: string;
  readonly message: string;
};

export class AuthClientError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(message: string, details: { code: string; status: number | null }) {
    super(message);
    this.name = "AuthClientError";
    this.code = details.code;
    this.status = details.status;
  }
}

export async function requestLogin(
  credentials: LoginCredentials,
  signal?: AbortSignal,
): Promise<LoginResponse> {
  const response = await fetch(`${appConfig.apiBaseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
    signal,
  });

  const payload = await readJson(response);

  if (!response.ok) {
    throw errorFromResponse(response.status, payload);
  }

  return parseLoginResponse(payload);
}

async function readJson(response: Response): Promise<unknown> {
  const body = await response.text();

  if (body.trim().length === 0) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(body);
    return parsed;
  } catch {
    return undefined;
  }
}

function parseLoginResponse(payload: unknown): LoginResponse {
  if (!isRecord(payload)) {
    throw new AuthClientError("Login response was not a JSON object.", {
      code: "INVALID_AUTH_RESPONSE",
      status: null,
    });
  }

  const accessToken = payload["accessToken"];
  const tokenType = payload["tokenType"];

  if (typeof accessToken !== "string" || accessToken.length === 0 || tokenType !== "Bearer") {
    throw new AuthClientError("Login response did not match the auth contract.", {
      code: "INVALID_AUTH_RESPONSE",
      status: null,
    });
  }

  return { accessToken, tokenType };
}

function errorFromResponse(status: number, payload: unknown): AuthClientError {
  const errorResponse = parseErrorResponse(payload);

  if (errorResponse !== null) {
    return new AuthClientError(errorResponse.message, { code: errorResponse.code, status });
  }

  if (status === 401) {
    return new AuthClientError("Bad credentials", { code: "UNAUTHORIZED", status });
  }

  return new AuthClientError("Authentication request failed.", {
    code: "AUTH_REQUEST_FAILED",
    status,
  });
}

function parseErrorResponse(payload: unknown): ErrorResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  const code = payload["code"];
  const message = payload["message"];

  if (typeof code !== "string" || code.length === 0 || typeof message !== "string" || message.length === 0) {
    return null;
  }

  return { code, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
