// ─── Phase 8: Scheduler Service ─────────────────────────────────────────────
//
// Interval-based scheduler that checks cron triggers every tick.
// Fires matching workflows by starting executions via the orchestrator.

import { prisma } from "../prisma";
import { shouldRun, getNextRunTime } from "./cron-parser";
import { executeWorkflow } from "../orchestrator";

export interface SchedulerStatus {
    isRunning: boolean;
    tickIntervalMs: number;
    lastTickAt: Date | null;
    tickCount: number;
    triggersChecked: number;
    triggersFired: number;
    errors: number;
}

class Scheduler {
    private intervalHandle: ReturnType<typeof setInterval> | null = null;
    private _isRunning = false;
    private _tickIntervalMs: number;
    private _lastTickAt: Date | null = null;
    private _tickCount = 0;
    private _triggersChecked = 0;
    private _triggersFired = 0;
    private _errors = 0;
    private _isProcessing = false;

    constructor(tickIntervalMs = 60_000) {
        this._tickIntervalMs = tickIntervalMs;
    }

    /**
     * Start the scheduler. Will tick at the configured interval.
     */
    start(): void {
        if (this._isRunning) return;

        this._isRunning = true;
        console.log(
            `[Scheduler] Started (tick every ${this._tickIntervalMs / 1000}s)`
        );

        // Run immediately on start
        this.tick();

        // Then schedule periodic ticks
        this.intervalHandle = setInterval(() => this.tick(), this._tickIntervalMs);

        // Don't hold the process open just for the scheduler
        if (this.intervalHandle.unref) {
            this.intervalHandle.unref();
        }
    }

    /**
     * Stop the scheduler gracefully.
     */
    stop(): void {
        if (!this._isRunning) return;

        this._isRunning = false;
        if (this.intervalHandle) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = null;
        }
        console.log("[Scheduler] Stopped");
    }

    /**
     * Execute a single scheduler tick: find and fire due cron triggers.
     */
    private async tick(): Promise<void> {
        // Prevent overlapping ticks
        if (this._isProcessing) return;

        this._isProcessing = true;
        this._lastTickAt = new Date();
        this._tickCount++;

        try {
            // Find all enabled cron triggers
            const cronTriggers = await prisma.trigger.findMany({
                where: {
                    type: "cron",
                    enabled: true,
                },
                include: {
                    workflow: {
                        select: { id: true, name: true, status: true },
                    },
                },
            });

            this._triggersChecked += cronTriggers.length;

            for (const trigger of cronTriggers) {
                // Skip if workflow is not active
                if (trigger.workflow.status !== "active") continue;

                const config = trigger.config as Record<string, unknown>;
                const expression = config.expression as string | undefined;

                if (!expression) continue;

                // Check if this trigger should fire now
                if (!shouldRun(expression)) continue;

                // Prevent double-firing within the same minute
                if (trigger.lastFiredAt) {
                    const lastFired = new Date(trigger.lastFiredAt);
                    const now = new Date();
                    if (
                        lastFired.getFullYear() === now.getFullYear() &&
                        lastFired.getMonth() === now.getMonth() &&
                        lastFired.getDate() === now.getDate() &&
                        lastFired.getHours() === now.getHours() &&
                        lastFired.getMinutes() === now.getMinutes()
                    ) {
                        continue; // Already fired this minute
                    }
                }

                // Fire the trigger
                try {
                    console.log(
                        `[Scheduler] Firing cron trigger ${trigger.id} → workflow "${trigger.workflow.name}"`
                    );

                    const triggerInput = config.input as Record<string, unknown> | undefined;
                    const nextRun = getNextRunTime(expression);

                    // Update trigger timestamps
                    await prisma.trigger.update({
                        where: { id: trigger.id },
                        data: {
                            lastFiredAt: new Date(),
                            ...(nextRun ? { nextRunAt: nextRun } : {}),
                        },
                    });

                    // Execute the workflow (fire-and-forget for scheduler)
                    executeWorkflow(trigger.workflow.id, triggerInput).catch((err) => {
                        console.error(
                            `[Scheduler] Execution failed for trigger ${trigger.id}:`,
                            err
                        );
                        this._errors++;
                    });

                    this._triggersFired++;
                } catch (err) {
                    console.error(
                        `[Scheduler] Error firing trigger ${trigger.id}:`,
                        err
                    );
                    this._errors++;
                }
            }
        } catch (err) {
            console.error("[Scheduler] Tick error:", err);
            this._errors++;
        } finally {
            this._isProcessing = false;
        }
    }

    /**
     * Get current scheduler status.
     */
    getStatus(): SchedulerStatus {
        return {
            isRunning: this._isRunning,
            tickIntervalMs: this._tickIntervalMs,
            lastTickAt: this._lastTickAt,
            tickCount: this._tickCount,
            triggersChecked: this._triggersChecked,
            triggersFired: this._triggersFired,
            errors: this._errors,
        };
    }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

const scheduler = new Scheduler();
export { scheduler };
export default scheduler;
