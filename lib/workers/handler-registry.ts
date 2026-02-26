// ─── Phase 4+7: Action Handler Registry ─────────────────────────────────────

import type { ActionHandler } from "./worker-types";

// Import all built-in handlers
import { StartHandler } from "./handlers/start-handler";
import { EndHandler } from "./handlers/end-handler";
import { ActionNodeHandler } from "./handlers/action-handler";
import { DelayHandler } from "./handlers/delay-handler";
import { ConditionHandler } from "./handlers/condition-handler";
import { ForkHandler } from "./handlers/fork-handler";
import { JoinHandler } from "./handlers/join-handler";
import { TransformHandler } from "./handlers/transform-handler";
import { WebhookResponseHandler } from "./handlers/webhook-response-handler";

class HandlerRegistry {
    private handlers = new Map<string, ActionHandler>();

    /**
     * Register an action handler for a given node type.
     * Overwrites any existing handler for the same type.
     */
    register(handler: ActionHandler): void {
        this.handlers.set(handler.type, handler);
    }

    /**
     * Look up the handler for a node type.
     */
    get(nodeType: string): ActionHandler | undefined {
        return this.handlers.get(nodeType);
    }

    /**
     * Check if a handler exists for the given type.
     */
    has(nodeType: string): boolean {
        return this.handlers.has(nodeType);
    }

    /**
     * List all registered handler types.
     */
    listTypes(): string[] {
        return Array.from(this.handlers.keys());
    }
}

// ─── Singleton with built-in handlers pre-registered ────────────────────────

const registry = new HandlerRegistry();

// Register built-in handlers
registry.register(new StartHandler());
registry.register(new EndHandler());
registry.register(new ActionNodeHandler());
registry.register(new DelayHandler());
registry.register(new ConditionHandler());
registry.register(new ForkHandler());
registry.register(new JoinHandler());
registry.register(new TransformHandler());
registry.register(new WebhookResponseHandler());

export { registry };
export default registry;
