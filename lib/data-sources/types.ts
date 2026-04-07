// ─── Data Source Plugin System ───────────────────────────────────────────────
//
// Every data source implements this interface.
// Adding a new source = create a file, implement DataSource, register it.
//
// Config shape per source is defined by each source itself and is validated
// at runtime. The `config` field in a fetch_data node stores source-specific
// params (e.g. language filter for github, keywords for jobs, etc.)

export interface DataSourceResult {
    /** Human-readable source label */
    source: string;
    /** ISO timestamp of when the fetch ran */
    fetchedAt: string;
    /** Array of items returned */
    items: DataSourceItem[];
    /** Any extra metadata the source wants to return */
    meta?: Record<string, unknown>;
}

export interface DataSourceItem {
    title: string;
    url?: string;
    description?: string;
    /** Source-specific extra fields */
    [key: string]: unknown;
}

/**
 * Every pluggable data source must implement this interface.
 */
export interface DataSource {
    /** Unique key used in node config: source = "github_trending" etc. */
    readonly id: string;
    /** Human-readable display name */
    readonly label: string;
    /** Short description shown in the UI */
    readonly description: string;
    /**
     * Config schema as a list of field descriptors — drives the UI panel.
     * Each field will be rendered as an input/select in the node config panel.
     */
    readonly configFields: DataSourceFieldDef[];
    /** Fetch and return structured results */
    fetch(config: Record<string, unknown>): Promise<DataSourceResult>;
}

export interface DataSourceFieldDef {
    key: string;
    label: string;
    type: "text" | "select" | "number";
    placeholder?: string;
    defaultValue?: string | number;
    options?: { value: string; label: string }[]; // for type=select
    required?: boolean;
}
