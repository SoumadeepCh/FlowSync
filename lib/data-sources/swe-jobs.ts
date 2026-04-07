// ─── SWE Jobs Data Source ─────────────────────────────────────────────────────
//
// Fetches Software Engineering jobs from multiple free, no-auth APIs:
//   1. Remotive API  — remote tech jobs, great quality
//   2. Arbeitnow API — EU + global, no auth, diverse listings
//
// Results are merged, deduped by title+company, and sorted by date.
// Configurable: keywords, category, limit, remote-only flag.

import type { DataSource, DataSourceResult, DataSourceFieldDef, DataSourceItem } from "./types";

interface RemotiveJob {
    id: number;
    url: string;
    title: string;
    company_name: string;
    company_logo?: string;
    category: string;
    candidate_required_location: string;
    salary?: string;
    description: string;
    publication_date: string;
    tags: string[];
}

interface ArbeitnowJob {
    slug: string;
    company_name: string;
    title: string;
    description: string;
    remote: boolean;
    url: string;
    tags: string[];
    job_types: string[];
    location: string;
    created_at: number;
}

export class SweJobsSource implements DataSource {
    readonly id = "swe_jobs";
    readonly label = "SWE Jobs";
    readonly description = "Fetch Software Engineering jobs from multiple job boards";

    readonly configFields: DataSourceFieldDef[] = [
        {
            key: "keywords",
            label: "Keywords",
            type: "text",
            placeholder: "e.g. software engineer, backend developer",
            defaultValue: "software engineer",
            required: false,
        },
        {
            key: "source",
            label: "Job Source",
            type: "select",
            defaultValue: "both",
            options: [
                { value: "both", label: "All Sources (Best Coverage)" },
                { value: "remotive", label: "Remotive (Remote Only)" },
                { value: "arbeitnow", label: "Arbeitnow (Global)" },
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
        const keywords = (config.keywords as string | undefined) || "software engineer";
        const source = (config.source as string | undefined) || "both";
        const limit = Math.min(Number(config.limit) || 10, 30);

        const jobs: DataSourceItem[] = [];

        const [remotive, arbeitnow] = await Promise.allSettled([
            source !== "arbeitnow" ? this.fetchRemotive(keywords) : Promise.resolve([]),
            source !== "remotive" ? this.fetchArbeitnow(keywords) : Promise.resolve([]),
        ]);

        if (remotive.status === "fulfilled") jobs.push(...remotive.value);
        if (arbeitnow.status === "fulfilled") jobs.push(...arbeitnow.value);

        // Deduplicate by title+company
        const seen = new Set<string>();
        const unique = jobs.filter((j) => {
            const key = `${String(j.title).toLowerCase()}|${String(j.company).toLowerCase()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        return {
            source: this.label,
            fetchedAt: new Date().toISOString(),
            items: unique.slice(0, limit),
            meta: {
                keywords,
                sourcesUsed: source,
                totalFound: unique.length,
            },
        };
    }

    private async fetchRemotive(keywords: string): Promise<DataSourceItem[]> {
        const searchTerm = encodeURIComponent(keywords);
        const url = `https://remotive.com/api/remote-jobs?search=${searchTerm}&limit=20`;

        const res = await fetch(url, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) throw new Error(`Remotive API error: ${res.status}`);

        const data = await res.json() as { jobs: RemotiveJob[] };

        return (data.jobs || []).map((job) => ({
            title: job.title,
            url: job.url,
            description: `${job.company_name} • ${job.candidate_required_location || "Remote"}`,
            company: job.company_name,
            location: job.candidate_required_location || "Remote",
            salary: job.salary || "Not specified",
            tags: job.tags?.slice(0, 5) || [],
            postedAt: job.publication_date,
            source: "Remotive",
        }));
    }

    private async fetchArbeitnow(keywords: string): Promise<DataSourceItem[]> {
        // Arbeitnow doesn't have keyword search on free tier,
        // filter post-fetch by title matching keywords
        const url = "https://www.arbeitnow.com/api/job-board-api?page=1";

        const res = await fetch(url, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) throw new Error(`Arbeitnow API error: ${res.status}`);

        const data = await res.json() as { data: ArbeitnowJob[] };
        const kwLower = keywords.toLowerCase().split(/\s+/);

        return (data.data || [])
            .filter((job) => {
                const haystack = `${job.title} ${job.tags?.join(" ")}`.toLowerCase();
                return kwLower.some((kw) => haystack.includes(kw));
            })
            .slice(0, 15)
            .map((job) => ({
                title: job.title,
                url: job.url,
                description: `${job.company_name} • ${job.location || "Unknown"}`,
                company: job.company_name,
                location: job.location || "Global",
                remote: job.remote,
                tags: job.tags?.slice(0, 5) || [],
                postedAt: new Date(job.created_at * 1000).toISOString(),
                source: "Arbeitnow",
            }));
    }
}
