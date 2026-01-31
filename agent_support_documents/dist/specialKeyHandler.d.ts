import { SpecialKeyOutputEvent } from "./omegaGestureDetector.js";
/**
 * Key press callback for executing actual key outputs
 */
export type KeyPressCallback = (key: string, holdDurationMs: number) => Promise<void>;
/**
 * Configuration for special key handler
 */
export interface SpecialKeyHandlerConfig {
    /** Callback to press a key with specified hold duration */
    onKeyPress: KeyPressCallback;
    /** Enable debug logging */
    debug?: boolean;
}
/**
 * Special Key Handler
 * Processes SpecialKeyOutputEvents from the Omega gesture detector
 */
export declare class SpecialKeyHandler {
    private config;
    private isExecuting;
    private pendingQueue;
    private isShutdown;
    constructor(config: SpecialKeyHandlerConfig);
    /**
     * Handle a special key output event
     */
    handleEvent(event: SpecialKeyOutputEvent): Promise<void>;
    /**
     * Process a single event
     */
    private processEvent;
    /**
     * Process D key Retaliate output
     * Outputs [count] R presses with randomized timing
     */
    private processRetaliateOutput;
    /**
     * Process S key Group Member output
     * Outputs target key followed by NUMPAD_SUBTRACT
     */
    private processGroupMemberOutput;
    /**
     * Process C key ESCAPE output
     */
    private processEscapeOutput;
    /**
     * Process = key Smash output (handled via gesture, but could be direct)
     */
    private processSmashOutput;
    /**
     * Sleep for specified milliseconds
     */
    private sleep;
    /**
     * Shutdown the handler
     */
    shutdown(): void;
}
/**
 * Create a special key handler with RobotJS integration
 */
export declare function createSpecialKeyHandler(debug?: boolean): Promise<SpecialKeyHandler>;
export default SpecialKeyHandler;
//# sourceMappingURL=specialKeyHandler.d.ts.map