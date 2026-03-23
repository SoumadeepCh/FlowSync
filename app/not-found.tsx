import Link from "next/link";

export default function NotFound() {
    return (
        <div className="error-page">
            <div className="error-page-content">
                <div className="error-page-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
                        <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </div>

                <h1 className="error-page-code">404</h1>
                <h2 className="error-page-title">Page not found</h2>
                <p className="error-page-description">
                    The page you&apos;re looking for doesn&apos;t exist or has been moved.
                </p>

                <div className="error-page-actions">
                    <Link href="/dashboard" className="btn btn-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                        </svg>
                        Go to Dashboard
                    </Link>
                    <Link href="/" className="btn btn-ghost">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                        Return Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
