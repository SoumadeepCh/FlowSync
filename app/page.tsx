import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { GitBranch, Clock, BarChart3, Shield } from "lucide-react";

export default function Home() {
  return (
    <main className="hero">
      <div className="hero-badge">🚀 Phase 10 — Production Ready</div>
      <h1 className="hero-title">
        Build <span>Durable Workflows</span> with Confidence
      </h1>
      <p className="hero-subtitle">
        FlowSync is an event-driven orchestration engine for modeling,
        executing, and monitoring DAG-based workflows at scale.
      </p>
      <div className="hero-actions">
        <SignedIn>
          <Link href="/dashboard" className="btn btn-primary">
            ⚡ Open Dashboard
          </Link>
        </SignedIn>
        <SignedOut>
          <Link href="/sign-in" className="btn btn-primary">
            ⚡ Sign In to Get Started
          </Link>
          <Link href="/sign-up" className="btn btn-ghost">
            Create Account →
          </Link>
        </SignedOut>
      </div>

      {/* Feature Highlights */}
      <div className="feature-grid">
        <div className="feature-card">
          <div className="feature-icon"><GitBranch size={28} color="var(--primary)" /></div>
          <h3 className="feature-title">DAG Workflows</h3>
          <p className="feature-desc">
            Model complex workflows as directed acyclic graphs with conditional branching and parallel execution.
          </p>
        </div>
        <div className="feature-card">
          <div className="feature-icon"><Clock size={28} color="var(--accent)" /></div>
          <h3 className="feature-title">Scheduling</h3>
          <p className="feature-desc">
            Trigger workflows via webhooks, cron schedules, or manual execution with full retry support.
          </p>
        </div>
        <div className="feature-card">
          <div className="feature-icon"><BarChart3 size={28} color="var(--success)" /></div>
          <h3 className="feature-title">Observability</h3>
          <p className="feature-desc">
            Real-time metrics, structured logging, audit trail, and execution timelines for full visibility.
          </p>
        </div>
        <div className="feature-card">
          <div className="feature-icon"><Shield size={28} color="var(--warning)" /></div>
          <h3 className="feature-title">Production Ready</h3>
          <p className="feature-desc">
            Rate limiting, backpressure, worker heartbeats, graceful shutdown, and per-user data isolation.
          </p>
        </div>
      </div>
    </main>
  );
}
