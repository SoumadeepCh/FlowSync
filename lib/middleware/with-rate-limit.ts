import { NextRequest, NextResponse } from "next/server";
import { rateLimiter } from "./rate-limiter";
import { RateLimitError, handleApiError } from "./error-handler";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (
  req: NextRequest,
  context: any
) => Promise<NextResponse> | NextResponse;

function getClientIp(req: NextRequest): string {
  const vercelIp = req.headers.get("x-vercel-forwarded-for")?.trim();
  if (vercelIp) return vercelIp;

  const cloudflareIp = req.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) return cloudflareIp;

  const flyIp = req.headers.get("fly-client-ip")?.trim();
  if (flyIp) return flyIp;

  const hasTrustedProxyHint =
    req.headers.has("x-vercel-id") ||
    req.headers.has("cf-ray") ||
    req.headers.has("fly-region");

  if (hasTrustedProxyHint) {
    const forwardedIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwardedIp) return forwardedIp;
  }

  return req.headers.get("x-real-ip")?.trim() || "anonymous";
}

export function withRateLimit(handler: RouteHandler): RouteHandler {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (req: NextRequest, context: any) => {
    try {
      const ip = getClientIp(req);

      const { allowed, retryAfterMs } = rateLimiter.consume(ip);

      if (!allowed) {
        throw new RateLimitError(retryAfterMs || 1000);
      }

      return await handler(req, context);
    } catch (error) {
      return handleApiError(error);
    }
  };
}
