import { SequenceStep, MacroBinding, CompiledProfile } from "./types.js";
import { type BackendMode } from "./keyOutputAdapter.js";
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
export type SuppressKeyCallback = (key: string, durationMs: number) => void;
export declare class SequenceExecutor {
    private isExecuting;
    private activeExecutions;
    private isShutdown;
    private callback;
    private compiledProfile;
    private trafficController;
    private timerManager;
    private suppressKeyCallback;
    private sleepAbortController;
    private heldModifier;
    private lastModifierCleanup;
    private readonly MODIFIER_CLEANUP_INTERVAL_MS;
    private outputPaceCounter;
    private lastAbilityTimes;
    private repeatPoliceWaiting;
    private readonly REPEAT_POLICE_WINDOW_MS;
    private readonly REPEAT_POLICE_DELAY_MS;
    private backendMode;
    private teensyExecutor;
    constructor(callback?: ExecutionCallback, compiledProfile?: CompiledProfile, backendMode?: BackendMode);
    /**
     * Get the current backend mode
     */
    getBackendMode(): BackendMode;
    /**
     * Set the Teensy executor reference for teensy mode key output
     */
    setTeensyExecutor(executor: any): void;
    /**
     * Provide a compiled profile to enable traffic control.
     */
    setCompiledProfile(compiled: CompiledProfile): void;
    /**
     * Set modifier state callback for smart traffic control.
     * This allows traffic controller to only wait when conflicting modifier is held.
     */
    setModifierStateCallback(cb: () => {
        shift: boolean;
        alt: boolean;
        ctrl: boolean;
    }): void;
    /**
     * Set callback to suppress keys in the gesture detector during output.
     * This prevents synthetic keypresses from triggering gestures.
     */
    setSuppressKeyCallback(cb: SuppressKeyCallback): void;
    /**
     * Suppress a key for a duration (prevents gesture detection of synthetic keypresses)
     */
    private suppressKey;
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
     * Ensure clean modifier state before sending modified keys
     * This prevents conflicts when physical keys (like movement) are held
     * while we try to send synthetic ALT/SHIFT + key combinations
     */
    private ensureCleanModifierState;
    /**
     * Buffer tier ranges (inclusive) - base ranges for human randomizer
     * Actual values selected using sophisticated multi-layer randomization
     * Updated: Larger gaps to reduce mouse lag from blocking robotjs calls
     */
    private bufferRanges;
    /**
     * Sleep for specified milliseconds (cancellable - aborts on shutdown)
     * Optimized: No polling interval - checks shutdown before and after sleep
     */
    private sleep;
    /**
     * Send a single keypress
     */
    private pressKey;
    /**
     * Route keyToggle to the active backend.
     * In teensy mode, "down" sends a minimal press (Teensy handles hold+release atomically).
     * "up" is a no-op for Teensy since it auto-releases after the duration.
     */
    private _keyToggle;
    /**
     * Route keyTap to the active backend.
     */
    private _keyTap;
    /**
     * Press a key for a specific duration - the optimized Teensy path.
     * For Teensy: sends a single serial command with built-in hold duration.
     * For RobotJS: does keyToggle down → sleep → keyToggle up.
     */
    private _keyPressForDuration;
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
     * Check if Stun Break is blocked by cooldown
     * @returns null if available, BlockerInfo if on cooldown
     */
    isStunBreakBlocked(): {
        reason: string;
        cooldownMs: number;
    } | null;
    /**
     * Record Stun Break usage and start cooldown timer
     */
    recordStunBreakUsed(): void;
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