// ─── Phase 9.5: Centralized Error Handler ───────────────────────────────────
//
// Typed error classes and a helper to map them to HTTP responses.
// Standardizes error handling across all API routes.

import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types";

// ─── Error Classes ──────────────────────────────────────────────────────────

export class AppError extends Error {
    readonly statusCode: number;
    readonly code: string;

    constructor(message: string, statusCode = 500, code = "INTERNAL_ERROR") {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
        this.code = code;
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string, id?: string) {
        const message = id ? `${resource} "${id}" not found` : `${resource} not found`;
        super(message, 404, "NOT_FOUND");
        this.name = "NotFoundError";
    }
}

export class ValidationError extends AppError {
    readonly fieldErrors: string[];

    constructor(message: string, fieldErrors: string[] = []) {
        super(message, 400, "VALIDATION_ERROR");
        this.name = "ValidationError";
        this.fieldErrors = fieldErrors;
    }
}

export class RateLimitError extends AppError {
    readonly retryAfterMs: number;

    constructor(retryAfterMs: number) {
        super("Too many requests", 429, "RATE_LIMIT_EXCEEDED");
        this.name = "RateLimitError";
        this.retryAfterMs = retryAfterMs;
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super(message, 409, "CONFLICT");
        this.name = "ConflictError";
    }
}

// ─── Helper ─────────────────────────────────────────────────────────────────

/**
 * Map any error to a proper NextResponse with correct status code.
 */
export function handleApiError(error: unknown): NextResponse<ApiResponse> {
    if (error instanceof ValidationError) {
        return NextResponse.json<ApiResponse>(
            {
                success: false,
                error: error.message,
                errors: error.fieldErrors.length > 0 ? error.fieldErrors : undefined,
            },
            { status: error.statusCode }
        );
    }

    if (error instanceof RateLimitError) {
        return NextResponse.json<ApiResponse>(
            { success: false, error: error.message },
            {
                status: error.statusCode,
                headers: {
                    "Retry-After": String(Math.ceil(error.retryAfterMs / 1000)),
                },
            }
        );
    }

    if (error instanceof AppError) {
        return NextResponse.json<ApiResponse>(
            { success: false, error: error.message },
            { status: error.statusCode }
        );
    }

    // Unknown error
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Unhandled API error:", error);

    return NextResponse.json<ApiResponse>(
        { success: false, error: message },
        { status: 500 }
    );
}
