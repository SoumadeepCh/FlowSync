"use client";

import { useEffect } from "react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Application error:", error);
    }, [error]);

    return (
        <div className="error-page">
            <div className="error-page-content">
                <div className="error-page-icon error-page-icon--danger">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.3" />
                        <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        <circle cx="12" cy="17" r="1" fill="currentColor" />
                    </svg>
                </div>

                <h1 className="error-page-code">Error</h1>
                <h2 className="error-page-title">Something went wrong</h2>
                <p className="error-page-description">
                    An unexpected error occurred while loading this page.
                    {error.digest && (
                        <span className="error-page-digest">
                            Reference: {error.digest}
                        </span>
                    )}
                </p>

                <div className="error-page-actions">
                    <button onClick={reset} className="btn btn-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56" /><polyline points="22 2 22 8 16 8" />
                        </svg>
                        Try Again
                    </button>
                    <a href="/dashboard" className="btn btn-ghost">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                        </svg>
                        Go to Dashboard
                    </a>
                </div>
            </div>
        </div>
    );
}
