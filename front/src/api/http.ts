import ky, { HTTPError } from "ky";
import type { Options } from "ky";
import { z } from "zod";
import { clearAuthSession, loadAuthSession } from "../auth/session";
import { appConfig } from "../config/runtimeConfig";

const errorResponseSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(message: string, details: { readonly code: string; readonly status: number | null }) {
    super(message);
    this.name = "ApiClientError";
    this.code = details.code;
    this.status = details.status;
  }
}

type ApiClientErrorLike = {
  readonly code: string;
  readonly message: string;
  readonly name: string;
  readonly status: number | null;
};

export function isApiClientError(error: unknown): error is ApiClientErrorLike {
  if (error instanceof ApiClientError) {
    return true;
  }

  if (typeof error !== "object" || error === null) {
    return false;
  }

  if (!("code" in error) || !("message" in error) || !("name" in error) || !("status" in error)) {
    return false;
  }

  return (
    error.name === "ApiClientError" &&
    typeof error.code === "string" &&
    typeof error.message === "string" &&
    (typeof error.status === "number" || error.status === null)
  );
}

const api = ky.create({
  prefix: appConfig.apiBaseUrl,
  hooks: {
    beforeRequest: [
      ({ request }) => {
        const session = loadAuthSession();

        if (session !== null) {
          request.headers.set("Authorization", `Bearer ${session.accessToken}`);
        }
      },
    ],
    afterResponse: [
      ({ response }) => {
        if (response.status === 401) {
          clearAuthSession();
        }
      },
    ],
  },
});

export async function apiJson(path: string, options?: Options): Promise<unknown> {
  try {
    const response = await api(path, options);
    return await response.json();
  } catch (error) {
    if (error instanceof HTTPError || isHttpErrorLike(error)) {
      throw await apiErrorFromHttpErrorResponse(error.response);
    }

    throw error;
  }
}

function isHttpErrorLike(error: unknown): error is { readonly name: "HTTPError"; readonly response: Response } {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  if (!("name" in error) || !("response" in error)) {
    return false;
  }

  return error.name === "HTTPError" && error.response instanceof Response;
}

async function apiErrorFromResponse(response: Response): Promise<ApiClientError> {
  const parsed = await safeJson(response);
  const errorResponse = errorResponseSchema.safeParse(parsed);

  if (errorResponse.success) {
    return new ApiClientError(errorResponse.data.message, {
      code: errorResponse.data.code,
      status: response.status,
    });
  }

  return new ApiClientError("API request failed.", {
    code: "API_REQUEST_FAILED",
    status: response.status,
  });
}

async function apiErrorFromHttpErrorResponse(response: Response): Promise<ApiClientError> {
  try {
    return await apiErrorFromResponse(response.clone());
  } catch (error) {
    if (error instanceof TypeError) {
      return new ApiClientError("API request failed.", {
        code: "API_REQUEST_FAILED",
        status: response.status,
      });
    }

    throw error;
  }
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return undefined;
    }

    throw error;
  }
}
