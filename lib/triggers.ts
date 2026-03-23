type TriggerWithConfig = {
    config: Record<string, unknown> | null;
};

function redactWebhookSecret(
    config: Record<string, unknown> | null
): Record<string, unknown> | null {
    if (!config || typeof config !== "object") return config;

    const rest = { ...config };
    delete rest.webhookSecret;
    return rest;
}

export function sanitizeTrigger<T extends TriggerWithConfig>(trigger: T): T {
    return {
        ...trigger,
        config: redactWebhookSecret(trigger.config),
    };
}

export function sanitizeTriggers<T extends TriggerWithConfig>(triggers: T[]): T[] {
    return triggers.map((trigger) => sanitizeTrigger(trigger));
}
