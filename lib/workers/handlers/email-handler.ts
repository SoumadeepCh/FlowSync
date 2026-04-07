// ─── Send Email Handler ───────────────────────────────────────────────────────
//
// Handles "send_email" nodes using Nodemailer + Gmail App Password.
// This works on Vercel because it uses SMTP over port 465 (SSL).
//
// Required env vars:
//   GMAIL_USER      — your Gmail address (e.g. you@gmail.com)
//   GMAIL_APP_PASS  — 16-char App Password from Google Account > Security
//
// Security: The recipient is ALWAYS the workflow owner's email from Clerk.
// The config.to field is intentionally ignored to prevent spam abuse.
//
// Body template supports simple handlebars-style injection from previousResults:
//   {{nodeId.fieldName}} → replaced with value from previousResults
//   {{nodeId.items}}     → renders as HTML list of items
//
// HTML formatting: if bodyTemplate starts with "<", treated as HTML.
// Otherwise, auto-wrapped in a clean HTML email template.

import nodemailer from "nodemailer";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "../../prisma";
import type { ActionHandler, WorkerJob, WorkerResult } from "../worker-types";
import type { DataSourceItem } from "../../data-sources";

export class SendEmailHandler implements ActionHandler {
    readonly type = "send_email";

    /**
     * Resolves the email of the user who owns this execution.
     * Looks up the execution's userId, then fetches their primary email from Clerk.
     * Returns null only if the execution has no userId or Clerk has no email for them.
     */
    private async resolveOwnerEmail(executionId: string): Promise<string | null> {
        try {
            const execution = await prisma.execution.findUnique({
                where: { id: executionId },
                select: { userId: true },
            });
            if (!execution?.userId) return null;

            const clerk = await clerkClient();
            const user = await clerk.users.getUser(execution.userId);
            const primary = user.emailAddresses.find(
                (e) => e.id === user.primaryEmailAddressId
            );
            return primary?.emailAddress ?? null;
        } catch {
            return null;
        }
    }

    async execute(job: WorkerJob): Promise<WorkerResult> {
        const start = Date.now();
        const { node } = job;
        const config = node.config || {};

        const subject = (config.subject as string | undefined) || "FlowSync Digest";
        const bodyTemplate = (config.bodyTemplate as string | undefined) || "";

        // ── Resolve recipient — ALWAYS the workflow owner's email ────────────
        // config.to is intentionally ignored to prevent spamming arbitrary addresses.
        const to = await this.resolveOwnerEmail(job.executionId);
        if (!to) {
            return {
                jobId: job.id,
                stepId: job.stepId,
                executionId: job.executionId,
                status: "failed",
                error: "Could not resolve workflow owner email. Make sure you are signed in with a verified email.",
                durationMs: Date.now() - start,
            };
        }

        const gmailUser = process.env.GMAIL_USER;
        const gmailPass = process.env.GMAIL_APP_PASS;

        if (!gmailUser || !gmailPass) {
            return {
                jobId: job.id,
                stepId: job.stepId,
                executionId: job.executionId,
                status: "failed",
                error: "Missing GMAIL_USER or GMAIL_APP_PASS environment variables. Set them in .env",
                durationMs: Date.now() - start,
            };
        }

        try {
            // Resolve template against previousResults
            const resolvedBody = this.resolveTemplate(bodyTemplate, job.previousResults, config);
            const htmlBody = this.toHtml(resolvedBody, subject, job.previousResults, config);

            const transporter = nodemailer.createTransport({
                host: "smtp.gmail.com",
                port: 465,
                secure: true,
                auth: {
                    user: gmailUser,
                    pass: gmailPass,
                },
            });

            const info = await transporter.sendMail({
                from: `"FlowSync" <${gmailUser}>`,
                to,
                subject,
                html: htmlBody,
            });

            return {
                jobId: job.id,
                stepId: job.stepId,
                executionId: job.executionId,
                status: "completed",
                result: {
                    sent: true,
                    messageId: info.messageId,
                    recipient: to,
                    subject,
                    sentAt: new Date().toISOString(),
                },
                durationMs: Date.now() - start,
            };
        } catch (err) {
            return {
                jobId: job.id,
                stepId: job.stepId,
                executionId: job.executionId,
                status: "failed",
                error: err instanceof Error ? err.message : String(err),
                durationMs: Date.now() - start,
                retryable: true,
            };
        }
    }

    /**
     * Replace {{nodeId.field}} tokens from previousResults.
     * Also supports {{nodeId.items}} which becomes an HTML item list.
     */
    private resolveTemplate(
        template: string,
        previousResults: Record<string, unknown>,
        config: Record<string, unknown>
    ): string {
        if (!template) return this.buildAutoBody(previousResults, config);

        return template.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
            const parts = path.trim().split(".");
            let value: unknown = previousResults;
            for (const part of parts) {
                if (value == null || typeof value !== "object") return "";
                value = (value as Record<string, unknown>)[part];
            }
            if (Array.isArray(value)) {
                return this.itemsToHtmlList(value as DataSourceItem[]);
            }
            return value != null ? String(value) : "";
        });
    }

    /**
     * Auto-generates a body when no template is provided:
     * renders each fetch_data result as a nicely formatted section.
     */
    private buildAutoBody(
        previousResults: Record<string, unknown>,
        config: Record<string, unknown>
    ): string {
        const sections: string[] = [];

        for (const [nodeId, result] of Object.entries(previousResults)) {
            if (!result || typeof result !== "object") continue;
            const r = result as Record<string, unknown>;
            if (!Array.isArray(r.items)) continue;

            const sourceName = String(r.source || nodeId);
            const list = this.itemsToHtmlList(r.items as DataSourceItem[]);
            sections.push(`
                <div style="margin-bottom:32px">
                    <h2 style="color:#818cf8;font-size:18px;margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid #1e1e2e;">
                        ${sourceName}
                    </h2>
                    ${list}
                    <p style="color:#6b7280;font-size:12px;margin:8px 0 0">
                        Fetched at: ${String(r.fetchedAt || "")}
                    </p>
                </div>
            `);
        }

        if (sections.length === 0) {
            const customBody = config.body as string | undefined;
            return customBody || "Your FlowSync workflow ran successfully.";
        }

        return sections.join("");
    }

    /** Convert DataSourceItem[] to a styled HTML list */
    private itemsToHtmlList(items: DataSourceItem[]): string {
        if (!items || items.length === 0) return "<p style='color:#6b7280'>No items found.</p>";

        return `<ul style="list-style:none;padding:0;margin:0">` +
            items.map((item) => {
                const title = item.url
                    ? `<a href="${String(item.url)}" style="color:#818cf8;text-decoration:none;font-weight:600">${item.title}</a>`
                    : `<strong>${item.title}</strong>`;

                const meta: string[] = [];
                if (item.company) meta.push(`🏢 ${item.company}`);
                if (item.location) meta.push(`📍 ${item.location}`);
                if (item.language && item.language !== "Unknown") meta.push(`💻 ${item.language}`);
                if (item.stars && item.stars !== "0" && item.stars !== "N/A") meta.push(`⭐ ${item.stars}`);
                if (item.starsToday && item.starsToday !== "0") meta.push(`📈 +${item.starsToday} today`);
                if (item.reactions) meta.push(`❤️ ${item.reactions}`);
                if (item.postIdea) {
                    return `
                        <li style="margin-bottom:16px;padding:12px;background:#12121a;border-radius:8px;border:1px solid #1e1e2e">
                            ${title}
                            <p style="color:#9ca3af;font-size:13px;margin:4px 0 8px">${item.description || ""}</p>
                            <pre style="background:#0a0a12;border:1px solid #2a2a3f;border-radius:6px;padding:10px;color:#a5b4fc;font-size:12px;white-space:pre-wrap;font-family:inherit">${item.postIdea}</pre>
                        </li>`;
                }

                return `
                    <li style="margin-bottom:14px;padding:12px;background:#12121a;border-radius:8px;border:1px solid #1e1e2e">
                        ${title}
                        <p style="color:#9ca3af;font-size:13px;margin:4px 0 0">${item.description || ""}${meta.length ? ` &nbsp;·&nbsp; ${meta.join(" &nbsp;·&nbsp; ")}` : ""}</p>
                    </li>`;
            }).join("") +
            `</ul>`;
    }

    /** Wrap plain text or partial HTML in a full styled email template */
    private toHtml(body: string, subject: string, _prev: Record<string, unknown>, _cfg: Record<string, unknown>): string {
        if (body.trimStart().startsWith("<")) {
            // Already HTML — wrap in base template only
            return this.emailTemplate(subject, body);
        }
        // Plain text — convert to HTML paragraphs
        const htmlBody = body
            .split(/\n\n+/)
            .map((p) => `<p style="color:#c9d1d9;line-height:1.6;margin:0 0 16px">${p.replace(/\n/g, "<br>")}</p>`)
            .join("");
        return this.emailTemplate(subject, htmlBody);
    }

    private emailTemplate(subject: string, body: string): string {
        const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#08080f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#08080f;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="600" style="max-width:600px;width:100%">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:12px 12px 0 0;padding:24px 32px;border-bottom:1px solid #1e1e2e">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td><span style="font-size:20px;font-weight:700;color:#e8e8ed">⚡ FlowSync</span></td>
              <td align="right"><span style="font-size:12px;color:#6b7280">${now} IST</span></td>
            </tr>
          </table>
          <h1 style="margin:12px 0 0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">${subject}</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="background:#0d0d1a;padding:32px;border-left:1px solid #1e1e2e;border-right:1px solid #1e1e2e">
          ${body}
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#0a0a12;border-radius:0 0 12px 12px;padding:20px 32px;border:1px solid #1e1e2e;border-top:none">
          <p style="margin:0;color:#4b5563;font-size:12px;text-align:center">
            Automated by <strong style="color:#6b7280">FlowSync</strong> — your workflow orchestration engine.
            <br>You're receiving this because a cron workflow sent it to you.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
    }
}
