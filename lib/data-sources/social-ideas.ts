// ─── Social Media Post Ideas Data Source ─────────────────────────────────────
//
// Fetches trending SWE/tech articles from dev.to API (free, no auth).
// Items can be used as inspiration for social media posts.
// Future: slot in Gemini/OpenAI to generate actual post copy.

import type { DataSource, DataSourceResult, DataSourceFieldDef, DataSourceItem } from "./types";

interface DevToArticle {
    id: number;
    title: string;
    url: string;
    description: string;
    tags: string[];
    reactions_count: number;
    comments_count: number;
    user: { name: string; username: string };
    published_at: string;
}

export class SocialIdeasSource implements DataSource {
    readonly id = "social_ideas";
    readonly label = "Social Media Post Ideas";
    readonly description = "Get trending SWE articles from dev.to to inspire your posts";

    readonly configFields: DataSourceFieldDef[] = [
        {
            key: "tag",
            label: "Topic Tag",
            type: "select",
            defaultValue: "webdev",
            options: [
                { value: "webdev", label: "Web Development" },
                { value: "programming", label: "Programming" },
                { value: "javascript", label: "JavaScript" },
                { value: "python", label: "Python" },
                { value: "career", label: "Career / Job Tips" },
                { value: "opensource", label: "Open Source" },
                { value: "devops", label: "DevOps" },
                { value: "ai", label: "AI / ML" },
                { value: "beginners", label: "For Beginners" },
            ],
            required: false,
        },
        {
            key: "limit",
            label: "Max Results",
            type: "number",
            defaultValue: 5,
            placeholder: "5",
            required: false,
        },
    ];

    async fetch(config: Record<string, unknown>): Promise<DataSourceResult> {
        const tag = (config.tag as string | undefined) || "webdev";
        const limit = Math.min(Number(config.limit) || 5, 20);

        const url = `https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&top=7&per_page=${limit}`;

        const res = await fetch(url, {
            headers: {
                Accept: "application/json",
                "api-key": "", // no key needed for public articles
            },
            signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) throw new Error(`dev.to API error: ${res.status}`);

        const articles = await res.json() as DevToArticle[];

        const items: DataSourceItem[] = articles.map((article) => ({
            title: article.title,
            url: article.url,
            description: article.description || "Read the article for post inspiration",
            author: article.user.name,
            tags: article.tags?.slice(0, 5) || [],
            reactions: article.reactions_count,
            comments: article.comments_count,
            publishedAt: article.published_at,
            // Ready-made post copy idea
            postIdea: `💡 "${article.title}" by ${article.user.name} — ${article.description || ""} #${tag} #SWE #Tech\n\n🔗 ${article.url}`,
        }));

        return {
            source: this.label,
            fetchedAt: new Date().toISOString(),
            items,
            meta: { tag, totalFetched: items.length },
        };
    }
}
