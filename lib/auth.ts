// ─── Auth Helper ────────────────────────────────────────────────────────────
//
// Centralized auth check for API routes.
// Extracts userId from Clerk's auth() and returns it,
// or returns a 401 response if not authenticated.

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { ApiResponse } from "./types";

/**
 * Require authentication. Returns the userId if authenticated.
 * Throws an object with a `response` field if not.
 *
 * Usage:
 *   const userId = await requireAuth();
 */
export async function requireAuth(): Promise<string> {
    const { userId } = await auth();
    if (!userId) {
        throw {
            response: NextResponse.json<ApiResponse>(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            ),
        };
    }
    return userId;
}

/**
 * Type guard for auth error thrown by requireAuth.
 */
export function isAuthError(err: unknown): err is { response: NextResponse } {
    return (
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        err.response instanceof NextResponse
    );
}
