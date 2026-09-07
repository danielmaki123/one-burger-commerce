# Easypanel production runbook

This project deploys as one Easypanel app service plus one Easypanel PostgreSQL service.

## Services

- Project: `oneburguer`
- App service: `web`
- PostgreSQL service: `postgres`
- GitHub repository: `danielmaki123/one-burger-commerce`
- Git ref: `main`
- App port: `3000`

## API sequence

Use the Easypanel API with `Authorization: Bearer <token>`.

The repo includes a guarded API script:

```bash
EASYPANEL_URL="https://<panel-domain>" \
EASYPANEL_TOKEN="<api-token>" \
npm run deploy:easypanel
```

If the panel exposes the API somewhere other than `/api/trpc`, set the exact API base:

```bash
EASYPANEL_API_BASE="https://<panel-domain>/<api-base>" \
EASYPANEL_URL="https://<panel-domain>" \
EASYPANEL_TOKEN="<api-token>" \
npm run deploy:easypanel
```

Preview the API calls without creating services:

```bash
EASYPANEL_URL="https://<panel-domain>" \
EASYPANEL_TOKEN="<api-token>" \
npm run deploy:easypanel -- --dry-run
```

1. Create the project:

```http
POST /createProject
```

Body:

```json
{
  "name": "oneburguer"
}
```

2. Create PostgreSQL:

```http
POST /createPostgresService
```

Body:

```json
{
  "projectName": "oneburguer",
  "serviceName": "postgres",
  "databaseName": "oneburguer",
  "user": "oneburguer",
  "password": "<generated-password>"
}
```

3. Create the app service:

```http
POST /createAppService
```

Body:

```json
{
  "projectName": "oneburguer",
  "serviceName": "web"
}
```

4. Point the app to GitHub:

```http
POST /updateAppSourceGithub
```

Body:

```json
{
  "projectName": "oneburguer",
  "serviceName": "web",
  "owner": "danielmaki123",
  "repo": "one-burger-commerce",
  "ref": "main",
  "path": "/"
}
```

5. Configure app environment:

```http
POST /updateAppEnv
```

Body:

```json
{
  "projectName": "oneburguer",
  "serviceName": "web",
  "env": "APP_ENV=production\nNODE_ENV=production\nPORT=3000\nDATABASE_URL=postgresql://oneburguer:<generated-password>@postgres:5432/oneburguer?schema=public\nDIRECT_URL=postgresql://oneburguer:<generated-password>@postgres:5432/oneburguer?schema=public\nNEXTAUTH_SECRET=<generated-secret>\nNOTIFICATIONS_DRIVER=dummy\nTELEGRAM_NOTIFICATIONS_ENABLED=false"
}
```

6. Deploy the app:

```http
POST /deployAppService
```

Body:

```json
{
  "projectName": "oneburguer",
  "serviceName": "web",
  "forceRebuild": true
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
