@echo off
if "%DATABASE_URL%"=="" (
  echo DATABASE_URL=present_empty
) else (
  echo DATABASE_URL=present_nonempty
)

if "%DIRECT_URL%"=="" (
  echo DIRECT_URL=present_empty
) else (
  echo DIRECT_URL=present_nonempty
)

if "%NEXTAUTH_SECRET%"=="" (
  echo NEXTAUTH_SECRET=present_empty
) else (
  echo NEXTAUTH_SECRET=present_nonempty
)

if "%APP_ENV%"=="" (
  echo APP_ENV=present_empty
) else (
  echo APP_ENV=present_nonempty
)

if "%NODE_ENV%"=="" (
  echo NODE_ENV=present_empty
) else (
  echo NODE_ENV=present_nonempty
)

if "%NOTIFICATIONS_DRIVER%"=="" (
  echo NOTIFICATIONS_DRIVER=present_empty
) else (
  echo NOTIFICATIONS_DRIVER=present_nonempty
)
