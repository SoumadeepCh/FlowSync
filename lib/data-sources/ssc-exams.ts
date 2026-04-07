// ─── Sarkari Exams Data Source ────────────────────────────────────────────────
//
// Scrapes sarkariresult.com for latest government exam notifications.
// Also pulls from ssc.gov.in for SSC-specific notices.
// No API key required — HTML scraping with graceful fallbacks.

import type { DataSource, DataSourceResult, DataSourceFieldDef, DataSourceItem } from "./types";

export class SscExamsSource implements DataSource {
    readonly id = "ssc_exams";
    readonly label = "Sarkari / Govt Exams";
    readonly description = "Fetch latest government exam notifications (SSC, UPSC, Banking etc.)";

    readonly configFields: DataSourceFieldDef[] = [
        {
            key: "category",
            label: "Category Filter",
            type: "select",
            defaultValue: "all",
            options: [
                { value: "all", label: "All Notifications" },
                { value: "ssc", label: "SSC" },
                { value: "upsc", label: "UPSC" },
                { value: "banking", label: "Banking" },
                { value: "railway", label: "Railway" },
                { value: "state", label: "State PSC" },
            ],
            required: false,
        },
        {
            key: "limit",
            label: "Max Results",
            type: "number",
            defaultValue: 10,
            placeholder: "10",
            required: false,
        },
    ];

    async fetch(config: Record<string, unknown>): Promise<DataSourceResult> {
        const category = (config.category as string | undefined) || "all";
        const limit = Math.min(Number(config.limit) || 10, 25);

        const [sarkari, ssc] = await Promise.allSettled([
            this.fetchSarkariResult(category),
            category === "ssc" || category === "all" ? this.fetchSSCGov() : Promise.resolve([]),
        ]);

        const items: DataSourceItem[] = [];
        if (sarkari.status === "fulfilled") items.push(...sarkari.value);
        if (ssc.status === "fulfilled") items.push(...ssc.value);

        // Deduplicate by title
        const seen = new Set<string>();
        const unique = items.filter((item) => {
            const key = String(item.title).toLowerCase().slice(0, 50);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        return {
            source: this.label,
            fetchedAt: new Date().toISOString(),
            items: unique.slice(0, limit),
            meta: { category, totalFound: unique.length },
        };
    }

    private async fetchSarkariResult(category: string): Promise<DataSourceItem[]> {
        const url = "https://www.sarkariresult.com/";
        const res = await fetch(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                Accept: "text/html",
            },
            signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) throw new Error(`sarkariresult.com returned ${res.status}`);
        const html = await res.text();

        // Extract notification links from the main announcement boxes
        const items: DataSourceItem[] = [];

        // Match <a href="...">...</a> within the notification sections
        const linkRegex = /<a\s+href="(https?:\/\/[^"]+)"[^>]*>\s*([^<]{10,200})\s*<\/a>/gi;
        let m;

        const categoryKeywords = this.getCategoryKeywords(category);

        while ((m = linkRegex.exec(html)) !== null) {
            const href = m[1];
            const title = m[2].replace(/\s+/g, " ").trim();

            // Skip navigation/ad links
            if (!href.includes("sarkariresult") && !href.includes("ssc") && !href.includes("gov.in")) continue;
            if (title.length < 10) continue;
            if (title.toLowerCase().includes("advertisement")) continue;

            // Filter by category if specified
            if (category !== "all" && categoryKeywords.length > 0) {
                const titleLower = title.toLowerCase();
                if (!categoryKeywords.some((kw) => titleLower.includes(kw))) continue;
            }

            items.push({
                title,
                url: href,
                description: "Latest notification from SarkariResult",
                source: "SarkariResult",
                category: this.detectCategory(title),
            });

            if (items.length >= 20) break;
        }

        return items;
    }

    private async fetchSSCGov(): Promise<DataSourceItem[]> {
        const url = "https://ssc.gov.in/";
        try {
            const res = await fetch(url, {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    Accept: "text/html",
                },
                signal: AbortSignal.timeout(8000),
            });

            if (!res.ok) return [];
            const html = await res.text();

            const items: DataSourceItem[] = [];
            // SSC site has a notice board section
            const noticeLinkRegex = /<a\s+href="([^"]+)"[^>]*>\s*([^<]{15,200})\s*<\/a>/gi;
            let m;

            while ((m = noticeLinkRegex.exec(html)) !== null) {
                const href = m[1];
                const title = m[2].replace(/\s+/g, " ").trim();

                if (title.length < 15) continue;
                const titleLower = title.toLowerCase();
                if (
                    !titleLower.includes("recruitment") &&
                    !titleLower.includes("notification") &&
                    !titleLower.includes("exam") &&
                    !titleLower.includes("result") &&
                    !titleLower.includes("admit")
                ) continue;

                const fullUrl = href.startsWith("http") ? href : `https://ssc.gov.in${href}`;
                items.push({
                    title,
                    url: fullUrl,
                    description: "Official SSC notification",
                    source: "SSC.gov.in",
                    category: "SSC",
                });

                if (items.length >= 10) break;
            }

            return items;
        } catch {
            return []; // SSC site is often slow — silent fallback
        }
    }

    private getCategoryKeywords(category: string): string[] {
        const map: Record<string, string[]> = {
            ssc: ["ssc", "staff selection", "cgl", "chsl", "cpo", "gd constable", "stenographer", "mts", "je"],
            upsc: ["upsc", "ias", "ips", "civil services", "ifs", "capf", "nda", "cds", "ese"],
            banking: ["bank", "ibps", "sbi", "rbi", "nabard", "clerk", "po", "rrb", "gramin"],
            railway: ["railway", "rrb", "rlb", "ntpc", "group d", "alp", "je railway"],
            state: ["psc", "state", "mpsc", "bpsc", "rpsc", "uppsc", "appsc", "kpsc", "tnpsc"],
            all: [],
        };
        return map[category] || [];
    }

    private detectCategory(title: string): string {
        const lower = title.toLowerCase();
        if (lower.includes("ssc") || lower.includes("staff selection")) return "SSC";
        if (lower.includes("upsc") || lower.includes("civil service")) return "UPSC";
        if (lower.includes("bank") || lower.includes("ibps") || lower.includes("sbi")) return "Banking";
        if (lower.includes("railway") || lower.includes("rrb")) return "Railway";
        if (lower.includes("psc")) return "State PSC";
        return "General";
    }
}
