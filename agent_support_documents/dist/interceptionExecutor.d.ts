/**
 * Interception Driver Executor - Phase 2
 *
 * Uses the Interception driver for kernel-level input injection.
 * Input appears to come from real hardware devices, making it much
 * harder for anti-cheat systems to detect.
 *
 * Detection level: HARD (kernel-level, no LLKHF_INJECTED flag)
 *
 * Requirements:
 * - Interception driver installed (https://github.com/oblitum/Interception)
 * - Windows only
 * - Administrator privileges for driver installation
 *
 * How it works:
 * 1. Interception hooks into the Windows input stack at kernel level
 * 2. We create a "virtual" keyboard device context
 * 3. Input sent through this context appears to come from hardware
 * 4. No software injection flags are set
 */
import { SequenceStep } from "./types.js";
export declare class InterceptionExecutor {
    private context;
    private keyboardDevice;
    private ffi;
    private initialized;
    private dllPath;
    constructor(dllPath?: string);
    /**
     * Initialize the Interception driver context
     */
    initialize(): Promise<boolean>;
    /**
     * Cleanup and destroy context
     */
    destroy(): void;
    /**
     * Get scan code entry for a key (includes extended flag)
     */
    private getScanCodeEntry;
    /**
     * Create a keystroke buffer for Interception
     * The struct is 8 bytes total:
     *   unsigned short code (2 bytes)
     *   unsigned short state (2 bytes)
     *   unsigned int information (4 bytes)
     */
    private createStrokeBuffer;
    /**
     * Send a single keypress (down + up) via Interception
     */
    private sendKey;
    /**
     * Calculate randomized delay between min and max
     */
    private getRandomDelay;
    /**
     * Precise sleep using busy-wait for sub-millisecond accuracy
     */
    private preciseSleep;
    /**
     * Validate a sequence before execution
     */
    validateSequence(sequence: SequenceStep[]): {
        valid: boolean;
        errors: string[];
    };
    /**
     * Execute a sequence of keypresses with timing
     * Uses Interception driver for kernel-level injection
     */
    executeSequence(sequence: SequenceStep[]): Promise<boolean>;
    /**
     * Check if Interception driver is available
     */
    static isAvailable(): Promise<boolean>;
}
/**
 * Fallback executor that mimics Interception API but uses console logging
 * Useful for testing on non-Windows systems or without driver installed
 */
export declare class MockInterceptionExecutor {
    private initialized;
    initialize(): Promise<boolean>;
    destroy(): void;
    validateSequence(sequence: SequenceStep[]): {
        valid: boolean;
        errors: string[];
    };
    executeSequence(sequence: SequenceStep[]): Promise<boolean>;
}
export default InterceptionExecutor;
