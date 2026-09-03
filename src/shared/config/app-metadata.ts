export const APP_METADATA = {
  serviceName: "one-burger-commerce",
  version:
    process.env.NEXT_PUBLIC_APP_VERSION ??
    process.env.APP_BUILD_VERSION ??
    "dev",
} as const;
