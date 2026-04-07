// ─── GitHub Trending Data Source ─────────────────────────────────────────────
//
// Scrapes https://github.com/trending to get trending repos.
// Supports filtering by language and date range (daily/weekly/monthly).
// No API key required.

import type { DataSource, DataSourceResult, DataSourceFieldDef } from "./types";

export class GitHubTrendingSource implements DataSource {
    readonly id = "github_trending";
    readonly label = "GitHub Trending";
    readonly description = "Fetch trending repositories from GitHub";

    readonly configFields: DataSourceFieldDef[] = [
        {
            key: "language",
            label: "Language Filter",
            type: "text",
            placeholder: "e.g. python, typescript (leave blank for all)",
            defaultValue: "",
            required: false,
        },
        {
            key: "since",
            label: "Time Range",
            type: "select",
            defaultValue: "daily",
            options: [
                { value: "daily", label: "Today" },
                { value: "weekly", label: "This Week" },
                { value: "monthly", label: "This Month" },
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
        const language = (config.language as string | undefined) || "";
        const since = (config.since as string | undefined) || "daily";
        const limit = Math.min(Number(config.limit) || 10, 25);

        const url = `https://github.com/trending/${language ? encodeURIComponent(language) : ""}?since=${since}`;

        const response = await fetch(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
        });

        if (!response.ok) {
            throw new Error(`GitHub trending fetch failed: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();
        const repos = this.parseRepos(html, limit) as import("./types").DataSourceItem[];

        return {
            source: this.label,
            fetchedAt: new Date().toISOString(),
            items: repos,
            meta: { language: language || "all", since, url },
        };
    }

    private parseRepos(html: string, limit: number) {
        const repos: Array<Record<string, unknown>> = [];

        // Match article[class*="Box-row"] blocks
        const articleRegex = /<article\s[^>]*class="[^"]*Box-row[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
        let articleMatch;

        while ((articleMatch = articleRegex.exec(html)) !== null && repos.length < limit) {
            const block = articleMatch[1];

            // Repo full name (owner/repo)
            const nameMatch = block.match(/href="\/([^"]+)"\s*[^>]*>\s*[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<\/span>\s*\/\s*[\s\S]*?<strong[^>]*>([^<]+)<\/strong>/);
            
            // Simpler approach: find the h2 a[href]
            const hrefMatch = block.match(/href="(\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)"/);
            const fullName = hrefMatch ? hrefMatch[1].slice(1) : null;

            if (!fullName) continue;

            // Description
            const descMatch = block.match(/<p\s[^>]*class="[^"]*col-9[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/p>/);
            const description = descMatch
                ? descMatch[1].replace(/\s+/g, " ").trim()
                : "No description";

            // Stars
            const starsMatch = block.match(/aria-label="(\d[\d,]*)\s*(?:users starred|stars)"/i) ||
                block.match(/<svg[^>]*octicon-star[^>]*>[\s\S]*?<\/svg>\s*([\d,]+)/);
            const stars = starsMatch ? starsMatch[1].replace(/,/g, "") : "0";

            // Language
            const langMatch = block.match(/<span\s+itemprop="programmingLanguage">([^<]+)<\/span>/);
            const language = langMatch ? langMatch[1].trim() : "Unknown";

            // Stars gained today
            const gainedMatch = block.match(/([\d,]+)\s+stars\s+today/i);
            const starsToday = gainedMatch ? gainedMatch[1].replace(/,/g, "") : "0";

            repos.push({
                title: fullName,
                url: `https://github.com/${fullName}`,
                description,
                language,
                stars,
                starsToday,
            });
        }

        // Fallback: simpler regex if the above finds nothing
        if (repos.length === 0) {
            const simpleRepoRegex = /href="\/([\w.-]+\/[\w.-]+)"/g;
            const seen = new Set<string>();
            let m;
            while ((m = simpleRepoRegex.exec(html)) !== null && repos.length < limit) {
                const name = m[1];
                // Skip non-repo links
                if (name.includes("trending") || name.includes("login") || name.includes("topics")) continue;
                if (seen.has(name)) continue;
                seen.add(name);
                repos.push({
                    title: name,
                    url: `https://github.com/${name}`,
                    description: "See link for details",
                    language: "Unknown",
                    stars: "N/A",
                    starsToday: "N/A",
                });
            }
        }

        return repos;
    }
}
