/**
 * Manages multiple concurrent timers with text-to-speech announcements.
 * Prevents duplicate timers with same ID and provides cancellation.
 */
export declare class TimerManager {
    private activeTimers;
    private ttsAvailable;
    private sayModule;
    constructor();
    /**
     * Initialize TTS module (say package)
     */
    private initializeTTS;
    /**
     * Start a new timer. If timer with same ID exists, it will be cancelled first.
     * @param id Unique timer identifier (e.g., "drop", "burst", "laze")
     * @param duration Duration in seconds
     * @param message Message to speak when timer completes
     */
    startTimer(id: string, duration: number, message: string): void;
    /**
     * Cancel a specific timer by ID
     */
    cancelTimer(id: string): boolean;
    /**
     * Cancel all active timers
     */
    cancelAllTimers(): void;
    /**
     * Get count of active timers
     */
    getActiveTimerCount(): number;
    /**
     * Get information about a specific timer
     */
    getTimerInfo(id: string): {
        remaining: number;
        elapsed: number;
        total: number;
    } | null;
    /**
     * Called when timer completes
     */
    private onTimerComplete;
    /**
     * Shutdown timer manager - cancel all timers
     */
    shutdown(): void;
}
