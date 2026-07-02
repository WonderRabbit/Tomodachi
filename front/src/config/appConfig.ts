export type AppEnvironment = "local" | "dev" | "prod";
export type DataSourceMode = "mock";

export type FrontendRuntimeEnv = {
  readonly MODE?: string;
  readonly VITE_TOMODACHI_API_BASE_URL?: string;
  readonly VITE_TOMODACHI_ENV?: string;
};

export type AppConfig = {
  readonly apiBaseUrl: string;
  readonly backendIntegrationEnabled: false;
  readonly dataSource: DataSourceMode;
  readonly environment: AppEnvironment;
};

type ConfigErrorDetails = {
  readonly message: string;
  readonly value: string;
  readonly variableName: string;
};

export class FrontendConfigError extends Error {
  readonly value: string;
  readonly variableName: string;

  constructor(details: ConfigErrorDetails) {
    super(`${details.variableName}: ${details.message}`);
    this.name = "FrontendConfigError";
    this.value = details.value;
    this.variableName = details.variableName;
  }
}

const DEFAULT_API_BASE_URL_BY_ENV = {
  local: "http://127.0.0.1:8080",
  dev: "https://dev-api.tomodachi.example",
  prod: "https://api.tomodachi.example",
} as const satisfies Record<AppEnvironment, string>;

export function resolveAppConfig(env: FrontendRuntimeEnv): AppConfig {
  const environment = parseEnvironment(env.VITE_TOMODACHI_ENV, env.MODE);

  return {
    apiBaseUrl: parseApiBaseUrl(env.VITE_TOMODACHI_API_BASE_URL, environment),
    backendIntegrationEnabled: false,
    dataSource: "mock",
    environment,
  };
}

function parseEnvironment(
  rawEnvironment: string | undefined,
  rawMode: string | undefined,
): AppEnvironment {
  const explicitEnvironment = normalizeText(rawEnvironment);

  if (explicitEnvironment !== undefined) {
    return environmentFromValue(explicitEnvironment, "VITE_TOMODACHI_ENV");
  }

  const mode = normalizeText(rawMode)?.toLowerCase();

  switch (mode) {
    case "dev":
      return "dev";
    case "prod":
    case "production":
      return "prod";
    default:
      return "local";
  }
}

function environmentFromValue(value: string, variableName: string): AppEnvironment {
  switch (value.toLowerCase()) {
    case "local":
      return "local";
    case "dev":
      return "dev";
    case "prod":
      return "prod";
    default:
      throw new FrontendConfigError({
        message: "expected one of local, dev, or prod",
        value,
        variableName,
      });
  }
}

function parseApiBaseUrl(
  rawApiBaseUrl: string | undefined,
  environment: AppEnvironment,
): string {
  const apiBaseUrl =
    normalizeText(rawApiBaseUrl) ?? DEFAULT_API_BASE_URL_BY_ENV[environment];

  try {
    const url = new URL(apiBaseUrl);

    if (!isHttpProtocol(url.protocol)) {
      throw new FrontendConfigError({
        message: "expected an http or https URL",
        value: apiBaseUrl,
        variableName: "VITE_TOMODACHI_API_BASE_URL",
      });
    }

    return stripTrailingSlash(url.toString());
  } catch (error) {
    if (error instanceof FrontendConfigError) {
      throw error;
    }

    if (error instanceof TypeError) {
      throw new FrontendConfigError({
        message: "expected an absolute URL",
        value: apiBaseUrl,
        variableName: "VITE_TOMODACHI_API_BASE_URL",
      });
    }

    throw error;
  }
}

function isHttpProtocol(protocol: string): boolean {
  return protocol === "http:" || protocol === "https:";
}

function normalizeText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  if (trimmed === undefined || trimmed.length === 0) {
    return undefined;
  }

  return trimmed;
}

function stripTrailingSlash(value: string): string {
  if (value.endsWith("/")) {
    return value.slice(0, -1);
  }

  return value;
}
