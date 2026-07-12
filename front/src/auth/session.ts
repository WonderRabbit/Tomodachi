export type AuthSession = {
  readonly accessToken: string;
  readonly createdAt: string;
  readonly email: string;
  readonly tokenType: "Bearer";
};

const STORAGE_KEY = "tomodachi.auth.session.v1";

export function saveAuthSession(session: AuthSession): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function loadAuthSession(): AuthSession | null {
  const rawSession = window.localStorage.getItem(STORAGE_KEY);

  if (rawSession === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(rawSession);
    return isAuthSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearAuthSession(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value["accessToken"] === "string" &&
    value["accessToken"].length > 0 &&
    typeof value["createdAt"] === "string" &&
    value["createdAt"].length > 0 &&
    typeof value["email"] === "string" &&
    value["email"].length > 0 &&
    value["tokenType"] === "Bearer"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
