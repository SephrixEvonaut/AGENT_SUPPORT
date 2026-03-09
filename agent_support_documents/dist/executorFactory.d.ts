import { MacroBinding } from "./types.js";
import { ExecutionCallback } from "./sequenceExecutor.js";
/**
 * Available execution backends
 * - robotjs: Software injection via SendInput API (has mouse stutter workarounds)
 * - interception: Kernel-level injection (hardest to detect)
 * - teensy: Hardware USB HID via Teensy 4.0 serial (no stutter, no workarounds needed)
 * - mock: Testing only (no keypresses sent)
 */
export type ExecutorBackend = "robotjs" | "interception" | "teensy" | "mock";
/**
 * Unified executor interface
 * Supports both awaitable and fire-and-forget execution for concurrent sequences
 */
export interface IExecutor {
    execute(binding: MacroBinding): Promise<boolean>;
    executeDetached(binding: MacroBinding): void;
    isBindingExecuting?(bindingName: string): boolean;
    getActiveExecutionCount?(): number;
    cancel?(bindingName: string): void;
    cancelAll?(): void;
    dryRun?(binding: MacroBinding): Promise<void>;
    destroy?(): void;
    grantSupremacy?(macroName: string): void;
    revokeSupremacy?(macroName: string): void;
    isStunBreakBlocked?(): {
        reason: string;
        cooldownMs: number;
    } | null;
    recordStunBreakUsed?(): void;
}
/**
 * Backend configuration
 */
export interface ExecutorConfig {
    backend: ExecutorBackend;
    interceptionDllPath?: string;
    onEvent?: ExecutionCallback;
}
/**
 * Factory to create the appropriate executor based on configuration
 */
export declare class ExecutorFactory {
    /**
     * Create an executor with the specified backend
     */
    static create(config?: Partial<ExecutorConfig>): Promise<IExecutor>;
    /**
     * Auto-select the best available backend
     * Prefers Interception > RobotJS > Mock
     */
    static createBest(onEvent?: ExecutionCallback): Promise<{
        executor: IExecutor;
        backend: ExecutorBackend;
    }>;
    /**
     * Get information about available backends
     */
    static getAvailableBackends(): Promise<{
        backend: ExecutorBackend;
        available: boolean;
        notes: string;
    }[]>;
}
export default ExecutorFactory;
//# sourceMappingURL=executorFactory.d.ts.map