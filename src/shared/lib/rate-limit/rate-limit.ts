import { NextResponse } from "next/server";

type FixedWindowRateLimiterConfig = {
  limit: number;
  windowMs: number;
  prefix: string;
  now?: () => number;
};

type RateLimitWindowEntry = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
};

const limiterStores = new Map<string, Map<string, RateLimitWindowEntry>>();

function getStore(prefix: string) {
  let store = limiterStores.get(prefix);
  if (!store) {
    store = new Map<string, RateLimitWindowEntry>();
    limiterStores.set(prefix, store);
  }
  return store;
}

export class FixedWindowRateLimiter {
  private readonly store: Map<string, RateLimitWindowEntry>;
  private readonly now: () => number;

  constructor(private readonly config: FixedWindowRateLimiterConfig) {
    this.store = getStore(config.prefix);
    this.now = config.now ?? Date.now;
  }

  consume(key: string): RateLimitResult {
    const now = this.now();
    const scopedKey = `${this.config.prefix}:${key}`;
    const current = this.store.get(scopedKey);

    if (!current || now >= current.resetAt) {
      this.store.set(scopedKey, {
        count: 1,
        resetAt: now + this.config.windowMs,
      });

      return {
        allowed: true,
        retryAfterSeconds: 0,
        remaining: Math.max(this.config.limit - 1, 0),
      };
    }

    if (current.count >= this.config.limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(Math.ceil((current.resetAt - now) / 1000), 1),
        remaining: 0,
      };
    }

    current.count += 1;
    this.store.set(scopedKey, current);

    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: Math.max(this.config.limit - current.count, 0),
    };
  }

  reset() {
    this.store.clear();
  }
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}

export function createRateLimitResponse(message: string, retryAfterSeconds: number) {
  return NextResponse.json(
    {
      error: {
        code: "TOO_MANY_REQUESTS",
        message,
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

export function resetAllRateLimiters() {
  limiterStores.forEach((store) => store.clear());
}
