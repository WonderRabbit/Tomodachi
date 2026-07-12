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
    return await api(path, options).json<unknown>();
  } catch (error) {
    if (error instanceof HTTPError) {
      throw await apiErrorFromResponse(error.response);
    }

    throw error;
  }
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
