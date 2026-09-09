# Easypanel production runbook

This project deploys as one Easypanel app service plus one Easypanel PostgreSQL service.

## Services

- Project: `oneburguer`
- App service: `web`
- PostgreSQL service: `postgres`
- GitHub repository: `danielmaki123/one-burger-commerce`
- Git ref: `main`
- App port: `3000`

Do not deploy One Burger into an existing Easypanel project such as `brunobot`. Treat that as the server/panel context only; the production project name for this app is `oneburguer`.

## API sequence

Use the Easypanel API with `Authorization: Bearer <token>`.

The repo includes a guarded API script:

```bash
EASYPANEL_URL="https://<panel-domain>" \
EASYPANEL_TOKEN="<api-token>" \
EASYPANEL_POSTGRES_PASSWORD="<strong-db-password>" \
NEXTAUTH_SECRET="<strong-nextauth-secret>" \
npm run deploy:easypanel
```

The tested panel exposes its API at `/api/rpc`. The script detects that API automatically. If a future panel exposes a different API base, set it explicitly:

```bash
EASYPANEL_API_BASE="https://<panel-domain>/<api-base>" \
EASYPANEL_URL="https://<panel-domain>" \
EASYPANEL_TOKEN="<api-token>" \
EASYPANEL_POSTGRES_PASSWORD="<strong-db-password>" \
NEXTAUTH_SECRET="<strong-nextauth-secret>" \
npm run deploy:easypanel
```

Preview the API calls without creating services:

```bash
EASYPANEL_URL="https://<panel-domain>" \
EASYPANEL_TOKEN="<api-token>" \
npm run deploy:easypanel:dry-run
```

Check whether the panel is ready for deployment without creating or changing anything:

```bash
EASYPANEL_URL="https://<panel-domain>" \
EASYPANEL_TOKEN="<api-token>" \
npm run deploy:easypanel:preflight
```

Do not combine `--preflight` with `--dry-run`: preflight needs a real token so it can read the current Easypanel state.

The script stops before any service creation if project `oneburguer` does not exist and Easypanel reports that the project limit has been reached. In that case, free/upgrade the panel so the project can be created. Do not point `EASYPANEL_PROJECT_NAME` at `brunobot` unless the owner explicitly accepts deploying into that shared existing project.

Optional service domain:

```bash
EASYPANEL_CREATE_DOMAIN="true" \
EASYPANEL_DOMAIN_HOST="oneburguer.example.com" \
EASYPANEL_URL="https://<panel-domain>" \
EASYPANEL_TOKEN="<api-token>" \
EASYPANEL_POSTGRES_PASSWORD="<strong-db-password>" \
NEXTAUTH_SECRET="<strong-nextauth-secret>" \
npm run deploy:easypanel
```

If `EASYPANEL_CREATE_DOMAIN=true` and `EASYPANEL_DOMAIN_HOST` is omitted, the script uses Easypanel's configured service domain and creates:

```text
oneburguer-web.<service-domain>
```

1. Create the project, when missing and allowed:

```http
POST /api/rpc/projects/createProject
```

Body:

```json
{
  "json": {
    "name": "oneburguer"
  }
}
```

2. Create PostgreSQL:

```http
POST /api/rpc/services/postgres/createService
```

Body:

```json
{
  "json": {
    "projectName": "oneburguer",
    "serviceName": "postgres",
    "databaseName": "oneburguer",
    "user": "oneburguer",
    "password": "<strong-db-password>",
    "image": "postgres:17"
  }
}
```

3. Create the app service:

```http
POST /api/rpc/services/app/createService
```

Body:

```json
{
  "json": {
    "projectName": "oneburguer",
    "serviceName": "web"
  }
}
```

4. Point the app to GitHub:

```http
POST /api/rpc/services/app/updateSourceGithub
```

Body:

```json
{
  "json": {
    "projectName": "oneburguer",
    "serviceName": "web",
    "owner": "danielmaki123",
    "repo": "one-burger-commerce",
    "ref": "main",
    "path": "/"
  }
}
```

5. Configure app environment:

```http
POST /api/rpc/services/app/updateEnv
```

Body:

```json
{
  "json": {
    "projectName": "oneburguer",
    "serviceName": "web",
    "env": "APP_ENV=production\nNODE_ENV=production\nPORT=3000\nDATABASE_URL=postgresql://oneburguer:<strong-db-password>@oneburguer_postgres:5432/oneburguer?schema=public\nDIRECT_URL=postgresql://oneburguer:<strong-db-password>@oneburguer_postgres:5432/oneburguer?schema=public\nNEXTAUTH_SECRET=<strong-nextauth-secret>\nNOTIFICATIONS_DRIVER=dummy\nTELEGRAM_NOTIFICATIONS_ENABLED=false"
  }
}
```

6. Configure deploy settings:

```http
POST /api/rpc/services/app/updateDeploy
```

Body:

```json
{
  "json": {
    "projectName": "oneburguer",
    "serviceName": "web",
    "deploy": {
      "replicas": 1,
      "zeroDowntime": true
    }
  }
}
```

7. Deploy the app:

```http
POST /api/rpc/services/app/deployService
```

Body:

```json
{
  "json": {
    "projectName": "oneburguer",
    "serviceName": "web",
    "forceRebuild": true
  }
}
```

## Startup behavior

Easypanel builds and runs the app service from this repository. No local Docker workflow is required.

The production container command runs `npm run start:production`.

That command runs:

1. `prisma migrate deploy` with retries.
2. `next start` only after migrations pass.

This keeps a fresh PostgreSQL service from serving broken menu/order routes before the schema exists.

## First admin user

Do not run `npm run db:seed` in production because it creates demo credentials.

Create the first production admin with:

```bash
BOOTSTRAP_ADMIN_EMAIL="owner@example.com" \
BOOTSTRAP_ADMIN_PASSWORD="<strong-password>" \
BOOTSTRAP_ADMIN_NAME="Owner" \
BOOTSTRAP_ADMIN_ROLE="owner" \
npm run admin:bootstrap
```

The script requires a password of at least 12 characters and writes only the hashed password.

## Production smoke test

After Easypanel returns the public app URL:

```bash
BASE_URL="https://<public-app-domain>" npm run test:e2e:prod
```

The production smoke suite is non-mutating. It checks health, public menu, cart, checkout, the reservation redirect, and admin login.

Run the full production E2E suite after creating the first admin:

```bash
BASE_URL="https://<public-app-domain>" \
E2E_ADMIN_EMAIL="owner@example.com" \
E2E_ADMIN_PASSWORD="<strong-password>" \
npm run test:e2e:prod:full
```

By default, the full production suite still skips tests that create orders or users. To verify real pickup ordering, user creation, and role restrictions against production, opt into mutations explicitly:

```bash
BASE_URL="https://<public-app-domain>" \
E2E_ADMIN_EMAIL="owner@example.com" \
E2E_ADMIN_PASSWORD="<strong-password>" \
E2E_ALLOW_MUTATIONS="true" \
npm run test:e2e:prod:full
```
