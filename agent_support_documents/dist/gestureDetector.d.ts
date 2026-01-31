import { InputKey, GestureSettings, GestureEvent } from "./types.js";
export type GestureCallback = (event: GestureEvent) => void;
export declare class GestureDetector {
    private machines;
    private _callback;
    private listeners;
    private globalSettings;
    private eventQueue;
    private processingQueue;
    private checkInterval;
    private isStopped;
    constructor(settings: GestureSettings, callback: GestureCallback);
    /**
     * Handle key down event
     */
    handleKeyDown(key: string): void;
    /**
     * Handle key up event
     */
    handleKeyUp(key: string): void;
    /**
     * Handle mouse button down (for MIDDLE_CLICK)
     */
    handleMouseDown(button: string): void;
    /**
     * Handle mouse button up (for MIDDLE_CLICK)
     */
    handleMouseUp(button: string): void;
    /**
     * Reset all state machines
     */
    reset(): void;
    /**
     * Replace the callback used by all per-key machines at runtime
     */
    setCallback(cb: GestureCallback): void;
    /**
     * Subscribe to gesture events without replacing the central callback
     */
    onGesture(cb: GestureCallback): void;
    /**
     * Unsubscribe a previously registered gesture listener
     */
    offGesture(cb: GestureCallback): void;
    get callback(): GestureCallback;
    set callback(cb: GestureCallback);
    /**
     * Get current event queue depth (for testing/monitoring)
     */
    getQueueDepth(): number;
    /**
     * Check all key state machines for pending gestures that should be finalized
     */
    private checkAllPendingGestures;
    /**
     * Queue a key event for processing
     * Uses immediate processing for low-latency with queue fallback for bursts
     */
    private queueEvent;
    /**
     * Process a single event
     */
    private processEvent;
    /**
     * Update global gesture settings for all machines
     */
    updateSettings(settings: GestureSettings): void;
    /**
     * Update settings for a specific key (hot-reload support)
     * This overrides the global settings for this key only
     */
    updateKeyProfile(key: InputKey, settings: GestureSettings): void;
    /**
     * Clear key-specific settings (revert to global)
     */
    clearKeyProfile(key: InputKey): void;
    /**
     * Get the active profile for a specific key
     */
    getKeyProfile(key: InputKey): GestureSettings | null;
    /**
     * Get all key profiles (for export/status)
     */
    getAllProfiles(): Record<string, GestureSettings>;
    /**
     * Get keys that have custom (non-global) settings
     */
    getCustomizedKeys(): InputKey[];
    /**
     * Load multiple key profiles at once
     */
    loadKeyProfiles(profiles: Record<string, GestureSettings>): void;
    /**
     * Get the global (default) settings
     */
    getGlobalSettings(): GestureSettings;
    /**
     * Destroy the gesture detector - stop all timers and clear state
     */
    destroy(): void;
}
//# sourceMappingURL=gestureDetector.d.ts.map