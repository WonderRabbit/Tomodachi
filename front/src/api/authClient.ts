import { z } from "zod";
import { apiJson, ApiClientError } from "./http";

export type LoginCredentials = {
  readonly email: string;
  readonly password: string;
};

const loginResponseSchema = z.object({
  accessToken: z.string().min(1),
  tokenType: z.literal("Bearer"),
});

const authRoleSchema = z.enum(["ADMIN", "PRODUCT_MANAGER", "ENGINEER", "REVIEWER", "VIEWER", "AGENT_SERVICE"]);

const currentUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  role: authRoleSchema,
  scopes: z.array(z.string().min(1)),
});

export type AuthClientError = ApiClientError;
export const AuthClientError = ApiClientError;

export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type CurrentUser = z.infer<typeof currentUserSchema>;

export async function requestLogin(
  credentials: LoginCredentials,
  signal?: AbortSignal,
): Promise<LoginResponse> {
  const payload = await apiJson("api/auth/login", {
    method: "POST",
    json: credentials,
    signal,
  });

  try {
    return loginResponseSchema.parse(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AuthClientError("Login response did not match the auth contract.", {
        code: "INVALID_AUTH_RESPONSE",
        status: null,
      });
    }

    throw error;
  }
}

export async function requestCurrentUser(signal?: AbortSignal): Promise<CurrentUser> {
  const payload = await apiJson("api/auth/me", { signal });

  try {
    return currentUserSchema.parse(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AuthClientError("Current user response did not match the auth contract.", {
        code: "INVALID_AUTH_RESPONSE",
        status: null,
      });
    }

    throw error;
  }
}
