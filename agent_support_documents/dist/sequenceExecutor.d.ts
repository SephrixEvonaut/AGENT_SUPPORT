import { SequenceStep, MacroBinding } from './types.js';
export interface ExecutionEvent {
    type: 'started' | 'step' | 'completed' | 'error' | 'cancelled';
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
    private callback;
    constructor(callback?: ExecutionCallback);
    /**
     * Validate a sequence step meets timing constraints
     */
    private validateStep;
    /**
     * Validate entire sequence meets constraints
     */
    private validateSequence;
    /**
     * Get randomized delay between min and max (inclusive)
     */
    private getRandomDelay;
    /**
     * Sleep for specified milliseconds
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
}
