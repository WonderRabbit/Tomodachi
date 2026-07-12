import assert from "node:assert/strict";
import { createServer } from "vite";

async function loadViteModule(modulePath, env) {
  const previousEnv = {
    MODE: process.env.MODE,
    VITE_TOMODACHI_API_BASE_URL: process.env.VITE_TOMODACHI_API_BASE_URL,
    VITE_TOMODACHI_ENV: process.env.VITE_TOMODACHI_ENV,
  };

  applyEnv(env);

  const server = await createServer({
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });

  try {
    return await server.ssrLoadModule(modulePath);
  } finally {
    await server.close();
    applyEnv(previousEnv);
  }
}

function applyEnv(env) {
  setProcessEnv("MODE", env.MODE);
  setProcessEnv("VITE_TOMODACHI_API_BASE_URL", env.VITE_TOMODACHI_API_BASE_URL);
  setProcessEnv("VITE_TOMODACHI_ENV", env.VITE_TOMODACHI_ENV);
}

function setProcessEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function assertConfig(actual, expected) {
  assert.deepEqual(actual, {
    apiBaseUrl: expected.apiBaseUrl,
    backendIntegrationEnabled: true,
    dataSource: "hybrid",
    environment: expected.environment,
  });
}

function assertConfigError(error, expectedVariableName) {
  assert.equal(error.name, "FrontendConfigError");
  assert.equal(error.variableName, expectedVariableName);
}

const appConfigModule = await loadViteModule("/src/config/appConfig.ts", {});

assertConfig(appConfigModule.resolveAppConfig({}), {
  apiBaseUrl: "http://127.0.0.1:8080",
  environment: "local",
});
assertConfig(
  appConfigModule.resolveAppConfig({
    MODE: "production",
    VITE_TOMODACHI_API_BASE_URL: " https://api.tomodachi.example/ ",
  }),
  {
    apiBaseUrl: "https://api.tomodachi.example",
    environment: "prod",
  },
);
assertConfig(
  appConfigModule.resolveAppConfig({
    MODE: "dev",
    VITE_TOMODACHI_API_BASE_URL: "   ",
    VITE_TOMODACHI_ENV: "   ",
  }),
  {
    apiBaseUrl: "https://dev-api.tomodachi.example",
    environment: "dev",
  },
);

assert.throws(
  () => appConfigModule.resolveAppConfig({ VITE_TOMODACHI_ENV: "qa" }),
  (error) => {
    assertConfigError(error, "VITE_TOMODACHI_ENV");
    return true;
  },
);
assert.throws(
  () =>
    appConfigModule.resolveAppConfig({
      VITE_TOMODACHI_API_BASE_URL: "ftp://api.tomodachi.example",
    }),
  (error) => {
    assertConfigError(error, "VITE_TOMODACHI_API_BASE_URL");
    return true;
  },
);
assert.throws(
  () =>
    appConfigModule.resolveAppConfig({
      VITE_TOMODACHI_API_BASE_URL: "api.tomodachi.example",
    }),
  (error) => {
    assertConfigError(error, "VITE_TOMODACHI_API_BASE_URL");
    return true;
  },
);

const runtimeConfigModule = await loadViteModule("/src/config/runtimeConfig.ts", {
  VITE_TOMODACHI_API_BASE_URL: "https://dev-api.tomodachi.example/",
  VITE_TOMODACHI_ENV: "dev",
});

assertConfig(runtimeConfigModule.appConfig, {
  apiBaseUrl: "https://dev-api.tomodachi.example",
  environment: "dev",
});

await assert.rejects(
  () =>
    loadViteModule("/src/config/runtimeConfig.ts", {
      VITE_TOMODACHI_ENV: "qa",
    }),
  (error) => {
    assertConfigError(error, "VITE_TOMODACHI_ENV");
    return true;
  },
);

console.log(
  JSON.stringify(
    {
      ok: true,
      scenarios: [
        "missing_env_defaults_to_local",
        "prod_mode_trailing_slash_normalized",
        "blank_values_fall_back_to_mode_default",
        "invalid_environment_rejected",
        "non_http_url_rejected",
        "relative_url_rejected",
        "runtime_config_module_valid_env_loads",
        "runtime_config_module_invalid_env_fails",
      ],
    },
    null,
    2,
  ),
);
