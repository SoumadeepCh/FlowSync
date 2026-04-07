"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check, ExternalLink, Mail, Briefcase, FileText, Lightbulb, Settings as SettingsIcon } from "lucide-react";

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button onClick={handleCopy} style={{
            padding: "0.25rem 0.5rem", background: "rgba(255,255,255,0.05)",
            border: "1px solid #2a2a3f", borderRadius: 5,
            color: "#9ca3af", fontSize: "0.75rem", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "0.3rem",
        }}>
            {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
        </button>
    );
}

function EnvBlock({ vars }: { vars: { key: string; desc: string; example?: string }[] }) {
    return (
        <div style={{ background: "#0a0a12", border: "1px solid #1e1e2e", borderRadius: 8, overflow: "hidden", marginTop: 12 }}>
            {vars.map((v, i) => (
                <div key={v.key} style={{
                    padding: "0.75rem 1rem",
                    borderBottom: i < vars.length - 1 ? "1px solid #1a1a2e" : "none",
                    display: "flex", alignItems: "flex-start", gap: "0.75rem",
                }}>
                    <div style={{ flex: 1 }}>
                        <code style={{ color: "#60a5fa", fontSize: "0.875rem", fontWeight: 600 }}>{v.key}</code>
                        <p style={{ color: "#6b7280", fontSize: "0.8rem", margin: "2px 0 0" }}>{v.desc}</p>
                        {v.example && (
                            <code style={{ color: "#4b5563", fontSize: "0.75rem" }}>e.g. {v.example}</code>
                        )}
                    </div>
                    <CopyButton text={`${v.key}=`} />
                </div>
            ))}
        </div>
    );
}

function StepList({ steps }: { steps: string[] }) {
    return (
        <ol style={{ paddingLeft: "1.25rem", margin: 0 }}>
            {steps.map((s, i) => (
                <li key={i} style={{ color: "#9ca3af", fontSize: "0.875rem", lineHeight: 1.7, marginBottom: "0.25rem" }}
                    dangerouslySetInnerHTML={{ __html: s }} />
            ))}
        </ol>
    );
}

const card: React.CSSProperties = {
    background: "#0d0d1a",
    border: "1px solid #1e1e2e",
    borderRadius: 12,
    padding: "1.5rem",
    marginBottom: "1.5rem",
};

const sectionTitle: React.CSSProperties = {
    fontSize: "1rem",
    fontWeight: 700,
    color: "#e8e8ed",
    marginBottom: "0.5rem",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
};

const sectionSubtitle: React.CSSProperties = {
    fontSize: "0.875rem",
    color: "#6b7280",
    marginBottom: "0.75rem",
    lineHeight: 1.6,
};

export default function SettingsPage() {
    return (
        <div className="container">
            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <SettingsIcon size={22} style={{ color: "#818cf8" }} /> Settings & Setup
                    </h1>
                    <p className="page-subtitle">Configure integrations and API keys for your automation workflows</p>
                </div>
            </div>

            {/* Status Banner */}
            <div style={{ ...card, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", marginBottom: "2rem" }}>
                <p style={{ color: "#a5b4fc", fontSize: "0.9rem", margin: 0, lineHeight: 1.7 }}>
                    ⚡ FlowSync reads all secrets from your <code style={{ color: "#818cf8" }}>.env</code> file (or Vercel environment variables for production).
                    No secrets are stored in the database. Add the keys below to enable each integration.
                </p>
            </div>

            {/* ── Email via Gmail ──────────────────────────────────────────── */}
            <div style={card}>
                <div style={sectionTitle}><Mail size={16} style={{ color: "#f472b6" }} /> Email via Gmail (send_email node)</div>
                <p style={sectionSubtitle}>
                    Uses Nodemailer + Gmail App Password over port 465 (TLS). Works on Vercel serverless — no domain required.
                    You just need a Google account.
                </p>

                <div style={{ marginBottom: "1rem" }}>
                    <p style={{ color: "#9ca3af", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem" }}>Setup Steps:</p>
                    <StepList steps={[
                        "Go to <a href='https://myaccount.google.com/security' target='_blank' rel='noreferrer' style='color:#818cf8'>myaccount.google.com/security</a>",
                        "Enable <strong style='color:#e8e8ed'>2-Step Verification</strong> (required for App Passwords)",
                        "Search for <strong style='color:#e8e8ed'>App Passwords</strong> in the search bar",
                        "Create a new App Password → name it \"FlowSync\" → copy the 16-character password",
                        "Add it to your <code>.env</code> as shown below",
                    ]} />
                </div>

                <EnvBlock vars={[
                    { key: "GMAIL_USER", desc: "Your Gmail address", example: "yourname@gmail.com" },
                    { key: "GMAIL_APP_PASS", desc: "16-char App Password from Google Account settings", example: "abcd efgh ijkl mnop" },
                ]} />

                <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "#0a0a12", borderRadius: 8, border: "1px solid #2a2a3f" }}>
                    <p style={{ color: "#6b7280", fontSize: "0.8rem", margin: 0 }}>
                        <strong style={{ color: "#9ca3af" }}>Note:</strong> Gmail allows 500 emails/day for personal accounts, 2,000/day for Google Workspace.
                        Make sure Less Secure App Access is <em>off</em> — App Passwords are the secure alternative.
                    </p>
                </div>
            </div>

            {/* ── GitHub Trending ──────────────────────────────────────────── */}
            <div style={card}>
                <div style={sectionTitle}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/></svg>
                    GitHub Trending (fetch_data node)
                </div>
                <p style={sectionSubtitle}>
                    Scrapes <code>github.com/trending</code> — no API key required. Works out of the box.
                    Optional: add a GitHub token to avoid rate limiting.
                </p>
                <EnvBlock vars={[
                    { key: "GITHUB_TOKEN", desc: "Optional — Personal Access Token. Increases rate limits from 60 to 5,000 req/hr.", example: "ghp_xxxxxxxxxxxx" },
                ]} />
                <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "#0a0a12", borderRadius: 8, border: "1px solid #2a2a3f" }}>
                    <p style={{ color: "#6b7280", fontSize: "0.8rem", margin: 0 }}>
                        To get a token: <a href="https://github.com/settings/tokens/new?scopes=read:user&description=FlowSync" target="_blank" rel="noreferrer" style={{ color: "#818cf8" }}>github.com/settings/tokens</a> → Generate (no scopes needed for trending).
                    </p>
                </div>
            </div>

            {/* ── SWE Jobs ──────────────────────────────────────────────────── */}
            <div style={card}>
                <div style={sectionTitle}><Briefcase size={16} style={{ color: "#34d399" }} /> SWE Jobs (fetch_data node)</div>
                <p style={sectionSubtitle}>
                    Uses <strong style={{ color: "#e8e8ed" }}>Remotive API</strong> + <strong style={{ color: "#e8e8ed" }}>Arbeitnow API</strong> — both free, no API key, no account required.
                    Results are merged and deduplicated. Configure keywords per workflow in the node editor.
                </p>
                <div style={{ padding: "0.75rem", background: "#0a0a12", borderRadius: 8, border: "1px solid #2a2a3f" }}>
                    <p style={{ color: "#34d399", fontSize: "0.8rem", margin: 0 }}>✅ No setup required — just add a <code>fetch_data</code> node with source <code>swe_jobs</code>.</p>
                </div>
            </div>

            {/* ── Govt Exams ──────────────────────────────────────────────── */}
            <div style={card}>
                <div style={sectionTitle}><FileText size={16} style={{ color: "#fbbf24" }} /> Sarkari / Govt Exams (fetch_data node)</div>
                <p style={sectionSubtitle}>
                    Scrapes <code>sarkariresult.com</code> and <code>ssc.gov.in</code> for latest notifications.
                    No API key required. Supports category filtering: SSC, UPSC, Banking, Railway, State PSC.
                </p>
                <div style={{ padding: "0.75rem", background: "#0a0a12", borderRadius: 8, border: "1px solid #2a2a3f" }}>
                    <p style={{ color: "#34d399", fontSize: "0.8rem", margin: 0 }}>✅ No setup required — just add a <code>fetch_data</code> node with source <code>ssc_exams</code>.</p>
                </div>
            </div>

            {/* ── Social Post Ideas ────────────────────────────────────────── */}
            <div style={card}>
                <div style={sectionTitle}><Lightbulb size={16} style={{ color: "#a78bfa" }} /> Social Media Post Ideas (fetch_data node)</div>
                <p style={sectionSubtitle}>
                    Fetches trending SWE/tech articles from <code>dev.to</code> API — free, no auth needed.
                    Articles include ready-made post copy with hashtags. Future: wire in Gemini API for AI-generated posts.
                </p>
                <EnvBlock vars={[
                    { key: "GEMINI_API_KEY", desc: "Optional — for future AI-generated post copy. Leave blank to use dev.to articles.", example: "AIza..." },
                ]} />
            </div>

            {/* ── How to Use ────────────────────────────── */}
            <div style={card}>
                <div style={sectionTitle}>🔧 How to Build Your First Automated Email Workflow</div>
                <StepList steps={[
                    "Add your <code>GMAIL_USER</code> and <code>GMAIL_APP_PASS</code> to <code>.env</code>",
                    "Go to <strong>Workflows</strong> → create a new workflow",
                    "In the DAG editor, add: <code>Start → fetch_data → send_email → End</code>",
                    "Click the <strong>fetch_data</strong> node → select your source (e.g. GitHub Trending)",
                    "Click the <strong>send_email</strong> node → fill in your email address and subject. Leave body blank for auto-render.",
                    "Click <strong>Save</strong> → go to the workflow list → set it to <strong>Active</strong>",
                    "Go to <strong>Triggers</strong> → create a new CRON trigger → select your workflow → pick a schedule",
                    "The scheduler will fire it automatically at the configured time 🎉",
                ]} />
            </div>

            {/* ── Vercel Env Vars ────────────────────────────────────────── */}
            <div style={{ ...card, border: "1px solid rgba(251,191,36,0.2)", background: "rgba(251,191,36,0.04)" }}>
                <div style={{ ...sectionTitle, color: "#fbbf24" }}>
                    <ExternalLink size={16} /> Deploying to Vercel
                </div>
                <p style={sectionSubtitle}>
                    On Vercel, environment variables go in <strong>Project Settings → Environment Variables</strong>.
                    Add the same <code>GMAIL_USER</code> and <code>GMAIL_APP_PASS</code> values there instead of in <code>.env</code>.
                </p>
                <div style={{ padding: "0.75rem", background: "rgba(0,0,0,0.3)", borderRadius: 8, border: "1px solid rgba(251,191,36,0.15)" }}>
                    <p style={{ color: "#fbbf24", fontSize: "0.8rem", margin: 0 }}>
                        ⚠️ The scheduler only runs when the server is live. On Vercel hobby plans (serverless), the scheduler &amp; job queue run
                        per-request. For reliable CRON on Vercel, use a cron job from <strong>vercel.json</strong> that hits your <code>/api/scheduler/status</code> endpoint,
                        or upgrade to a platform with persistent servers.
                    </p>
                </div>
            </div>
        </div>
    );
}
