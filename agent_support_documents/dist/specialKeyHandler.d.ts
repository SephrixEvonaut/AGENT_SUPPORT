import { SpecialKeyOutputEvent } from "./omegaGestureDetector.js";
import { type BackendMode } from "./keyOutputAdapter.js";
import { type TeensyExecutor } from "./teensyExecutor.js";
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
    /** Callback to suppress a key in the gesture detector (prevents echo) */
    onSuppressKey?: (key: string, durationMs: number) => void;
    /** Enable debug logging */
    debug?: boolean;
    /** Backend mode - 'software' enables pressure monitoring, 'teensy' disables it */
    backendMode?: BackendMode;
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
    private dStreamActive;
    private sayModule;
    private ttsAvailable;
    private ttsSpeaking;
    constructor(config: SpecialKeyHandlerConfig);
    /**
     * Initialize TTS module (say package)
     */
    private initializeTTS;
    /**
     * Speak a TTS message. Returns a promise that resolves when done speaking.
     */
    private speakTTS;
    /**
     * Check if TTS is currently speaking
     */
    isTTSSpeaking(): boolean;
    /**
     * Handle a special key output event
     */
    handleEvent(event: SpecialKeyOutputEvent): Promise<void>;
    /**
     * Process a single event
     */
    private processEvent;
    /**
     * Handle D key release - IMMEDIATELY stop all R processing
     */
    private handleDRelease;
    /**
     * Process D toggle TTS event ("on on on" / "off off off")
     */
    private processDToggleTTS;
    /**
     * Process D key stream output - sends a single R
     * Called every 290ms by the interval in omegaGestureDetector (after 120ms initial delay)
     * Each R is held for 36-41ms (randomized)
     */
    private processDStreamOutput;
    /**
     * Process S key Group Member output
     * Outputs target key followed by cog key
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
     * Process MIDDLE_CLICK double-tap Max Zoom Out (PAGEDOWN)
     */
    private processMiddleClickZoomOut;
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
 * Options for creating a special key handler
 */
export interface CreateSpecialKeyHandlerOptions {
    debug?: boolean;
    /** Callback to suppress keys in gesture detector (prevents echo) */
    onSuppressKey?: (key: string, durationMs: number) => void;
    /** Backend mode - determines if pressure monitoring is active */
    backendMode?: BackendMode;
    /** Optional Teensy executor for hardware key output */
    teensyExecutor?: TeensyExecutor | null;
}
/**
 * Create a special key handler with RobotJS integration
 */
export declare function createSpecialKeyHandler(optionsOrDebug?: boolean | CreateSpecialKeyHandlerOptions): Promise<SpecialKeyHandler>;
export default SpecialKeyHandler;
//# sourceMappingURL=specialKeyHandler.d.ts.map