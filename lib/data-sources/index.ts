// ─── Data Source Registry ─────────────────────────────────────────────────────
//
// Singleton registry for all pluggable data sources.
// To add a new source:
//   1. Create lib/data-sources/my-source.ts implementing DataSource
//   2. Import and register it here
//   3. It will automatically appear in the UI node config panel

import type { DataSource } from "./types";
import { GitHubTrendingSource } from "./github-trending";
import { SweJobsSource } from "./swe-jobs";
import { SscExamsSource } from "./ssc-exams";
import { SocialIdeasSource } from "./social-ideas";
import { WeatherSource } from "./weather";

class DataSourceRegistry {
    private sources = new Map<string, DataSource>();

    register(source: DataSource): void {
        this.sources.set(source.id, source);
    }

    get(id: string): DataSource | undefined {
        return this.sources.get(id);
    }

    has(id: string): boolean {
        return this.sources.has(id);
    }

    /** All registered sources (for UI dropdowns) */
    all(): DataSource[] {
        return Array.from(this.sources.values());
    }

    /** Returns UI-friendly option list */
    toOptions(): { value: string; label: string; description: string }[] {
        return this.all().map((s) => ({
            value: s.id,
            label: s.label,
            description: s.description,
        }));
    }
}

const dataSourceRegistry = new DataSourceRegistry();

// ─── Register built-in sources ───────────────────────────────────────────────
dataSourceRegistry.register(new GitHubTrendingSource());
dataSourceRegistry.register(new SweJobsSource());
dataSourceRegistry.register(new SscExamsSource());
dataSourceRegistry.register(new SocialIdeasSource());
dataSourceRegistry.register(new WeatherSource());

export { dataSourceRegistry };
export type { DataSource, DataSourceResult, DataSourceItem, DataSourceFieldDef } from "./types";
