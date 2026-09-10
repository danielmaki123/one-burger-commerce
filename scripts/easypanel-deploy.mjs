import { randomBytes } from "node:crypto";

const PROJECT_NAME = process.env.EASYPANEL_PROJECT_NAME || "oneburguer";
const APP_SERVICE_NAME = process.env.EASYPANEL_APP_SERVICE_NAME || "web";
const POSTGRES_SERVICE_NAME = process.env.EASYPANEL_POSTGRES_SERVICE_NAME || "postgres";
const POSTGRES_DB = process.env.EASYPANEL_POSTGRES_DB || "oneburguer";
const POSTGRES_USER = process.env.EASYPANEL_POSTGRES_USER || "oneburguer";
const GITHUB_OWNER = process.env.EASYPANEL_GITHUB_OWNER || "danielmaki123";
const GITHUB_REPO = process.env.EASYPANEL_GITHUB_REPO || "one-burger-commerce";
const GITHUB_REF = process.env.EASYPANEL_GITHUB_REF || "main";
const GITHUB_PATH = process.env.EASYPANEL_GITHUB_PATH || "/";
const DATABASE_HOST = process.env.EASYPANEL_DATABASE_HOST || `${PROJECT_NAME}_${POSTGRES_SERVICE_NAME}`;
const CREATE_DOMAIN = process.env.EASYPANEL_CREATE_DOMAIN === "true";
const DOMAIN_HOST = process.env.EASYPANEL_DOMAIN_HOST?.trim();
const ALLOW_EXISTING_PROJECT = process.env.EASYPANEL_ALLOW_EXISTING_PROJECT === "true";

const dryRun = process.argv.includes("--dry-run");
const preflight = process.argv.includes("--preflight");

function requiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function secretEnv(name, { fallbackBytes = 24, minLength = 16 } = {}) {
  const value = process.env[name]?.trim();

  if (value) {
    if (!dryRun && value.length < minLength) {
      throw new Error(`Environment variable ${name} must be at least ${minLength} characters for live deploy.`);
    }

    return value;
  }

  if (!dryRun) {
    throw new Error(`Missing required environment variable for live deploy: ${name}`);
  }

  return randomBytes(fallbackBytes).toString("base64url");
}

function normalizePanelUrl(raw) {
  return raw.replace(/\/+$/, "");
}

function redact(value) {
  return value
    .replace(/(Bearer )[^"'\s]+/g, "$1<redacted>")
    .replace(/("password"\s*:\s*")[^"]+(")/g, "$1<redacted>$2")
    .replace(/(password=)[^@\n]+/g, "$1<redacted>")
    .replace(/(:\/\/[^:\n]+:)[^@\n]+@/g, "$1<redacted>@")
    .replace(/(NEXTAUTH_SECRET=)[^\\\r\n"]+/g, "$1<redacted>");
}

async function request(baseUrl, token, method, path, body) {
  const url = `${baseUrl}${path}`;
  const payload = body === undefined ? undefined : JSON.stringify(body);

  if (dryRun) {
    console.log(redact(`${method} ${url}\n${payload || ""}`));
    return {};
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: payload,
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${method} ${path} failed: HTTP ${response.status} ${redact(text)}`);
  }

  return text ? JSON.parse(text) : {};
}

async function detectApiBase(panelUrl, token) {
  const configuredBaseUrl = process.env.EASYPANEL_API_BASE?.trim();

  if (configuredBaseUrl) {
    return normalizePanelUrl(configuredBaseUrl);
  }

  const candidates = [
    { baseUrl: panelUrl, listProjectsPath: "/api/rpc/projects/listProjects", wrap: true },
    { baseUrl: `${panelUrl}/api/trpc`, listProjectsPath: "/listProjects", wrap: false },
    { baseUrl: panelUrl, listProjectsPath: "/listProjects", wrap: false },
  ];

  for (const candidate of candidates) {
    try {
      await request(candidate.baseUrl, token, "GET", candidate.listProjectsPath);
      return candidate;
    } catch (error) {
      if (dryRun) {
        return candidate;
      }

      console.warn(`API base check failed for ${candidate.baseUrl}${candidate.listProjectsPath}: ${redact(error.message)}`);
    }
  }

  throw new Error("Could not detect Easypanel API base URL.");
}

async function rpc(api, token, path, input) {
  const method = input === undefined ? "GET" : "POST";
  const body = api.wrap ? { json: input } : input;
  const result = await request(api.baseUrl, token, method, path, method === "GET" ? undefined : body);

  return api.wrap && result && Object.hasOwn(result, "json") ? result.json : result;
}

async function projectExists(api, token, projectName) {
  const projects = await rpc(api, token, "/api/rpc/projects/listProjects", undefined);
  return Array.isArray(projects) && projects.some((project) => project.name === projectName);
}

async function canCreateProject(api, token) {
  return Boolean(await rpc(api, token, "/api/rpc/projects/canCreateProject", undefined));
}

function assertProjectTarget() {
  if (PROJECT_NAME !== "oneburguer" && !ALLOW_EXISTING_PROJECT) {
    throw new Error(
      `Refusing to deploy into existing/shared project "${PROJECT_NAME}". Use project "oneburguer", or set EASYPANEL_ALLOW_EXISTING_PROJECT=true only after explicitly accepting that shared-project risk.`,
    );
  }
}

async function serviceExists(api, token, path, projectName, serviceName) {
  return Boolean(await inspectService(api, token, path, projectName, serviceName));
}

async function inspectService(api, token, path, projectName, serviceName) {
  try {
    return await rpc(api, token, path, { projectName, serviceName });
  } catch (error) {
    if (/HTTP 404|not found/i.test(error.message)) {
      return null;
    }

    throw error;
  }
}

/**
 * Builds the service env without clobbering values the operator set by hand
 * (Telegram, n8n, outbox processor, rate limits, ...). Only `managedEntries`
 * are overwritten; `defaultEntries` are written exclusively when the key is
 * still absent.
 */
function buildAppEnv(existingEnv, managedEntries, defaultEntries = []) {
  const existingLines = (existingEnv ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const keyOf = (line) => line.split("=")[0]?.trim();
  const managedKeys = new Set(managedEntries.map(([key]) => key));
  const existingKeys = new Set(existingLines.map(keyOf).filter(Boolean));
  const preservedLines = existingLines.filter((line) => {
    const key = keyOf(line);
    return key && !managedKeys.has(key);
  });
  const defaultLines = defaultEntries
    .filter(([key]) => !existingKeys.has(key) && !managedKeys.has(key))
    .map(([key, value]) => `${key}=${value}`);

  return [
    ...preservedLines,
    ...defaultLines,
    ...managedEntries.map(([key, value]) => `${key}=${value}`),
  ].join("\n");
}

function resolveServiceDomain(value) {
  if (typeof value === "string") {
    return value;
  }

  if (value?.customServiceDomain) {
    return value.customServiceDomain;
  }

  if (value?.defaultServiceDomain) {
    return value.defaultServiceDomain;
  }

  throw new Error("Easypanel did not return a service domain.");
}

async function createDomainIfRequested(api, token) {
  if (!CREATE_DOMAIN) {
    return;
  }

  const serviceDomain = DOMAIN_HOST
    ? undefined
    : resolveServiceDomain(await rpc(api, token, "/api/rpc/settings/getServiceDomain", undefined));
  const host = DOMAIN_HOST || `${PROJECT_NAME}-${APP_SERVICE_NAME}.${serviceDomain}`;

  await rpc(api, token, "/api/rpc/domains/createDomain", {
    certificateResolver: "letsencrypt",
    destinationType: "service",
    host,
    https: true,
    id: randomBytes(10).toString("hex"),
    middlewares: [],
    path: "/",
    serviceDestination: {
      path: "/",
      port: 3000,
      projectName: PROJECT_NAME,
      protocol: "http",
      serviceName: APP_SERVICE_NAME,
    },
    wildcard: false,
  });

  console.log(`Easypanel domain requested for ${host}.`);
}

async function runPreflight(api, token) {
  const projects = await rpc(api, token, "/api/rpc/projects/listProjects", undefined);
  const exists = Array.isArray(projects) && projects.some((project) => project.name === PROJECT_NAME);
  const canCreate = exists ? true : await canCreateProject(api, token);
  const appExists = exists
    ? await serviceExists(api, token, "/api/rpc/services/app/inspectService", PROJECT_NAME, APP_SERVICE_NAME)
    : false;
  const postgresExists = exists
    ? await serviceExists(api, token, "/api/rpc/services/postgres/inspectService", PROJECT_NAME, POSTGRES_SERVICE_NAME)
    : false;

  console.log(`Easypanel API: ${api.wrap ? "rpc" : "legacy"}`);
  console.log(`Target project: ${PROJECT_NAME}`);
  console.log(`Project exists: ${exists ? "yes" : "no"}`);
  console.log(`Can create project: ${canCreate ? "yes" : "no"}`);
  console.log(`App service exists: ${appExists ? "yes" : "no"}`);
  console.log(`Postgres service exists: ${postgresExists ? "yes" : "no"}`);

  if (!exists && !canCreate) {
    throw new Error(`Preflight failed: Easypanel cannot create project "${PROJECT_NAME}" right now.`);
  }

  assertProjectTarget();
}

async function main() {
  if (dryRun && preflight) {
    throw new Error("Use either --dry-run or --preflight, not both.");
  }

  const panelUrl = normalizePanelUrl(requiredEnv("EASYPANEL_URL"));
  const token = requiredEnv("EASYPANEL_TOKEN");

  if (preflight) {
    const api = await detectApiBase(panelUrl, token);
    await runPreflight(api, token);
    return;
  }

  let postgresPassword = process.env.EASYPANEL_POSTGRES_PASSWORD?.trim();

  if (dryRun) {
    postgresPassword = postgresPassword || secretEnv("EASYPANEL_POSTGRES_PASSWORD", { minLength: 16 });
  }

  const api = await detectApiBase(panelUrl, token);

  if (api.wrap) {
    const exists = await projectExists(api, token, PROJECT_NAME);
    assertProjectTarget();

    if (!exists) {
      if (!(await canCreateProject(api, token))) {
        throw new Error(
          `Easypanel cannot create project "${PROJECT_NAME}" right now. The panel reports the project limit is reached; create space, upgrade the license, or set EASYPANEL_PROJECT_NAME to an existing project you explicitly want to use.`,
        );
      }

      await rpc(api, token, "/api/rpc/projects/createProject", { name: PROJECT_NAME });
    }

    const postgresService = await inspectService(
      api,
      token,
      "/api/rpc/services/postgres/inspectService",
      PROJECT_NAME,
      POSTGRES_SERVICE_NAME,
    );

    if (!postgresService) {
      postgresPassword = postgresPassword || secretEnv("EASYPANEL_POSTGRES_PASSWORD", { minLength: 16 });

      await rpc(api, token, "/api/rpc/services/postgres/createService", {
        projectName: PROJECT_NAME,
        serviceName: POSTGRES_SERVICE_NAME,
        databaseName: POSTGRES_DB,
        user: POSTGRES_USER,
        password: postgresPassword,
        image: "postgres:17",
      });
    } else if (postgresService.password) {
      postgresPassword = postgresService.password;
    }

    if (!postgresPassword) {
      throw new Error(`Postgres service "${POSTGRES_SERVICE_NAME}" exists, but Easypanel did not return a password.`);
    }

    const appService = await inspectService(api, token, "/api/rpc/services/app/inspectService", PROJECT_NAME, APP_SERVICE_NAME);

    if (!appService) {
      await rpc(api, token, "/api/rpc/services/app/createService", {
        projectName: PROJECT_NAME,
        serviceName: APP_SERVICE_NAME,
      });
    }

    const databaseUrl = `postgresql://${POSTGRES_USER}:${postgresPassword}@${DATABASE_HOST}:5432/${POSTGRES_DB}?schema=public`;
    const appEnv = buildAppEnv(
      appService?.env,
      [
        ["APP_ENV", "production"],
        ["NODE_ENV", "production"],
        ["PORT", "3000"],
        ["DATABASE_URL", databaseUrl],
        ["DIRECT_URL", databaseUrl],
      ],
      [
        ["NOTIFICATIONS_DRIVER", "dummy"],
        ["TELEGRAM_NOTIFICATIONS_ENABLED", "false"],
      ],
    );

    await rpc(api, token, "/api/rpc/services/app/updateSourceGithub", {
      projectName: PROJECT_NAME,
      serviceName: APP_SERVICE_NAME,
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      ref: GITHUB_REF,
      path: GITHUB_PATH,
    });

    await rpc(api, token, "/api/rpc/services/app/updateBuild", {
      projectName: PROJECT_NAME,
      serviceName: APP_SERVICE_NAME,
      build: {
        type: "dockerfile",
        file: "Dockerfile",
      },
    });

    await rpc(api, token, "/api/rpc/services/app/updateEnv", {
      projectName: PROJECT_NAME,
      serviceName: APP_SERVICE_NAME,
      env: appEnv,
    });

    await rpc(api, token, "/api/rpc/services/app/updateDeploy", {
      projectName: PROJECT_NAME,
      serviceName: APP_SERVICE_NAME,
      deploy: {
        replicas: 1,
        zeroDowntime: true,
      },
    });

    await rpc(api, token, "/api/rpc/services/app/deployService", {
      projectName: PROJECT_NAME,
      serviceName: APP_SERVICE_NAME,
      forceRebuild: true,
    });

    await createDomainIfRequested(api, token);

    console.log(`Easypanel deployment requested for ${PROJECT_NAME}/${APP_SERVICE_NAME}.`);
    return;
  }

  await request(api.baseUrl, token, "POST", "/createProject", {
    name: PROJECT_NAME,
  });

  await request(api.baseUrl, token, "POST", "/createPostgresService", {
    projectName: PROJECT_NAME,
    serviceName: POSTGRES_SERVICE_NAME,
    databaseName: POSTGRES_DB,
    user: POSTGRES_USER,
    password: postgresPassword,
  });

  await request(api.baseUrl, token, "POST", "/createAppService", {
    projectName: PROJECT_NAME,
    serviceName: APP_SERVICE_NAME,
  });

  postgresPassword = postgresPassword || secretEnv("EASYPANEL_POSTGRES_PASSWORD", { minLength: 16 });

  const legacyDatabaseUrl = `postgresql://${POSTGRES_USER}:${postgresPassword}@${DATABASE_HOST}:5432/${POSTGRES_DB}?schema=public`;
  const legacyAppEnv = buildAppEnv(
    null,
    [
      ["APP_ENV", "production"],
      ["NODE_ENV", "production"],
      ["PORT", "3000"],
      ["DATABASE_URL", legacyDatabaseUrl],
      ["DIRECT_URL", legacyDatabaseUrl],
    ],
    [
      ["NOTIFICATIONS_DRIVER", "dummy"],
      ["TELEGRAM_NOTIFICATIONS_ENABLED", "false"],
    ],
  );

  await request(api.baseUrl, token, "POST", "/updateAppSourceGithub", {
    projectName: PROJECT_NAME,
    serviceName: APP_SERVICE_NAME,
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    ref: GITHUB_REF,
    path: GITHUB_PATH,
  });

  await request(api.baseUrl, token, "POST", "/updateAppEnv", {
    projectName: PROJECT_NAME,
    serviceName: APP_SERVICE_NAME,
    env: legacyAppEnv,
  });

  await request(api.baseUrl, token, "POST", "/deployAppService", {
    projectName: PROJECT_NAME,
    serviceName: APP_SERVICE_NAME,
    forceRebuild: true,
  });

  console.log(`Easypanel deployment requested for ${PROJECT_NAME}/${APP_SERVICE_NAME}.`);
}

main().catch((error) => {
  console.error(redact(error.message));
  process.exitCode = 1;
});
