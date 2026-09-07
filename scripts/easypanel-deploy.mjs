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

const dryRun = process.argv.includes("--dry-run");

function requiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function secretEnv(name, fallbackBytes = 24) {
  return process.env[name]?.trim() || randomBytes(fallbackBytes).toString("base64url");
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
  const payload = body ? JSON.stringify(body) : undefined;

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

  const candidates = [`${panelUrl}/api/trpc`, `${panelUrl}`];

  for (const baseUrl of candidates) {
    try {
      await request(baseUrl, token, "GET", "/listProjects");
      return baseUrl;
    } catch (error) {
      if (dryRun) {
        return baseUrl;
      }

      console.warn(`API base check failed for ${baseUrl}: ${redact(error.message)}`);
    }
  }

  throw new Error("Could not detect Easypanel API base URL.");
}

async function main() {
  const panelUrl = normalizePanelUrl(requiredEnv("EASYPANEL_URL"));
  const token = requiredEnv("EASYPANEL_TOKEN");
  const postgresPassword = secretEnv("EASYPANEL_POSTGRES_PASSWORD");
  const nextAuthSecret = secretEnv("NEXTAUTH_SECRET", 32);
  const baseUrl = await detectApiBase(panelUrl, token);
  const databaseUrl = `postgresql://${POSTGRES_USER}:${postgresPassword}@${POSTGRES_SERVICE_NAME}:5432/${POSTGRES_DB}?schema=public`;
  const appEnv = [
    "APP_ENV=production",
    "NODE_ENV=production",
    "PORT=3000",
    `DATABASE_URL=${databaseUrl}`,
    `DIRECT_URL=${databaseUrl}`,
    `NEXTAUTH_SECRET=${nextAuthSecret}`,
    "NOTIFICATIONS_DRIVER=dummy",
    "TELEGRAM_NOTIFICATIONS_ENABLED=false",
  ].join("\n");

  await request(baseUrl, token, "POST", "/createProject", {
    name: PROJECT_NAME,
  });

  await request(baseUrl, token, "POST", "/createPostgresService", {
    projectName: PROJECT_NAME,
    serviceName: POSTGRES_SERVICE_NAME,
    databaseName: POSTGRES_DB,
    user: POSTGRES_USER,
    password: postgresPassword,
  });

  await request(baseUrl, token, "POST", "/createAppService", {
    projectName: PROJECT_NAME,
    serviceName: APP_SERVICE_NAME,
  });

  await request(baseUrl, token, "POST", "/updateAppSourceGithub", {
    projectName: PROJECT_NAME,
    serviceName: APP_SERVICE_NAME,
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    ref: GITHUB_REF,
    path: GITHUB_PATH,
  });

  await request(baseUrl, token, "POST", "/updateAppEnv", {
    projectName: PROJECT_NAME,
    serviceName: APP_SERVICE_NAME,
    env: appEnv,
  });

  await request(baseUrl, token, "POST", "/deployAppService", {
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
