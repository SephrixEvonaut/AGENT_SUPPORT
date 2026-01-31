import { SequenceStep, MacroBinding, CompiledProfile } from "./types.js";
export interface ExecutionEvent {
    type: "started" | "step" | "completed" | "error" | "cancelled";
    bindingName: string;
    step?: SequenceStep;
    stepIndex?: number;
    delay?: number;
    error?: string;
    timestamp: number;
}
export type ExecutionCallback = (event: ExecutionEvent) => void;
export declare class SequenceExecutor {
    private isExecuting;
    private activeExecutions;
    private isShutdown;
    private callback;
    private compiledProfile;
    private trafficController;
    private timerManager;
    private sleepAbortController;
    private heldModifier;
    constructor(callback?: ExecutionCallback, compiledProfile?: CompiledProfile);
    /**
     * Provide a compiled profile to enable traffic control.
     */
    setCompiledProfile(compiled: CompiledProfile): void;
    /**
     * Validate a sequence step meets timing constraints
     */
    private validateStep;
    /**
     * Validate entire sequence meets constraints
     */
    private validateSequence;
    /**
     * Map our profile key names to RobotJS key names
     */
    private robotJsKeyMap;
    /**
     * Parse a step key which may include modifiers like "SHIFT+Q" or "ALT+NUMPAD7"
     */
    private parseKey;
    /**
     * Buffer tier ranges (inclusive) - base ranges for human randomizer
     * Actual values selected using sophisticated multi-layer randomization
     */
    private bufferRanges;
    /**
     * Sleep for specified milliseconds (cancellable - aborts immediately on shutdown)
     */
    private sleep;
    /**
     * Send a single keypress
     */
    private pressKey;
    /**
     * Check if a binding is currently executing
     */
    isBindingExecuting(bindingName: string): boolean;
    /**
     * Get count of currently active executions
     */
    getActiveExecutionCount(): number;
    /**
     * Get names of all currently executing bindings
     */
    getActiveBindings(): string[];
    /**
     * Cancel execution for a specific binding
     */
    cancel(bindingName: string): void;
    /**
     * Cancel all executions
     */
    cancelAll(): void;
    /**
     * Grant supremacy to a macro - it bypasses traffic control entirely
     * Use for high-priority macros that should never wait
     */
    grantSupremacy(macroName: string): void;
    /**
     * Revoke supremacy from a macro
     */
    revokeSupremacy(macroName: string): void;
    /**
     * Get list of macros with supremacy
     */
    getSupremacyList(): string[];
    /**
     * Destroy the executor - stops all operations and prevents new ones
     */
    destroy(): void;
    /**
     * Execute a macro binding's sequence (fire-and-forget)
     * This method launches the execution as a detached promise, allowing
     * multiple different bindings to run simultaneously.
     */
    executeDetached(binding: MacroBinding): void;
    /**
     * Execute a macro binding's sequence (awaitable)
     * Use this when you need to wait for completion.
     */
    execute(binding: MacroBinding): Promise<boolean>;
    /**
     * Internal execution logic
     */
    private executeInternal;
    /**
     * Test execution without actually sending keys (dry run)
     */
    dryRun(binding: MacroBinding): Promise<void>;
    /**
     * Shutdown executor and clean up resources
     */
    shutdown(): void;
}
//# sourceMappingURL=sequenceExecutor.d.ts.map