import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import { Toaster } from "sonner";
import ScrollToTop from "./components/ScrollToTop";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FlowSync — Workflow Orchestration Engine",
  description:
    "Event-driven orchestration engine for durable workflow execution with DAG-based workflow modeling.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <nav className="nav">
            <div className="nav-inner">
              <Link href="/" className="nav-logo">
                <div className="nav-logo-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="5" cy="12" r="2.5" fill="white" opacity="0.9" />
                    <circle cx="14" cy="5" r="2.5" fill="white" opacity="0.9" />
                    <circle cx="14" cy="19" r="2.5" fill="white" opacity="0.9" />
                    <circle cx="22" cy="12" r="2" fill="white" opacity="0.6" />
                    <path d="M7.5 11L11.5 6.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
                    <path d="M7.5 13L11.5 17.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
                    <path d="M16.5 5.5L20 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
                    <path d="M16.5 18.5L20 13" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
                  </svg>
                </div>
                FlowSync
              </Link>
              <div className="nav-links">
                <SignedIn>
                  <Link href="/dashboard" className="nav-link">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
                    Dashboard
                  </Link>
                  <Link href="/executions" className="nav-link">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 3 20 12 6 21 6 3" /></svg>
                    Executions
                  </Link>
                  <Link href="/triggers" className="nav-link">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                    Triggers
                  </Link>

                  <div className="nav-divider" />

                  <Link href="/health" className="nav-link">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>
                    Health
                  </Link>
                  <Link href="/observability" className="nav-link">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
                    Metrics
                  </Link>
                  <Link href="/audit" className="nav-link">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" /></svg>
                    Audit
                  </Link>
                  <Link href="/queue" className="nav-link">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="14" y="3" rx="1" /><path d="M10 3H7a1 1 0 0 0-1 1v3" /><rect width="7" height="7" x="3" y="14" rx="1" /><path d="M14 21h3a1 1 0 0 0 1-1v-3" /></svg>
                    Queue
                  </Link>

                  <div className="nav-divider" />

                  <Link href="/profile" className="nav-link">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    Profile
                  </Link>

                  <UserButton afterSignOutUrl="/" />
                </SignedIn>
                <SignedOut>
                  <Link href="/sign-in" className="nav-link">
                    Sign In
                  </Link>
                  <Link href="/sign-up" className="btn btn-primary btn-sm">
                    Sign Up
                  </Link>
                </SignedOut>
              </div>
            </div>
          </nav>
          {children}
          <ScrollToTop />
          <Toaster
            position="bottom-right"
            theme="dark"
            toastOptions={{
              style: {
                background: "#12121a",
                border: "1px solid #1e1e2e",
                color: "#e8e8ed",
              },
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
