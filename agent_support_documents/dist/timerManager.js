// ============================================================================
// TIMER MANAGER - TTS Timer System
// ============================================================================
import { logger } from "./logger.js";
/**
 * Manages multiple concurrent timers with text-to-speech announcements.
 * Prevents duplicate timers with same ID and provides cancellation.
 */
export class TimerManager {
    activeTimers = new Map();
    ttsAvailable = false;
    sayModule = null;
    constructor() {
        this.initializeTTS();
    }
    /**
     * Initialize TTS module (say package)
     */
    async initializeTTS() {
        try {
            // Dynamically import 'say' package
            this.sayModule = await import("say");
            this.ttsAvailable = true;
            logger.info("TTS module loaded successfully");
        }
        catch (error) {
            logger.warn("TTS module (say) not available. Install with: npm install say");
            logger.warn("Timers will log messages instead of speaking them.");
            this.ttsAvailable = false;
        }
    }
    /**
     * Start a new timer. If timer with same ID exists, it will be cancelled first.
     * @param id Unique timer identifier (e.g., "drop", "burst", "laze")
     * @param duration Duration in seconds
     * @param message Message to speak when timer completes
     */
    startTimer(id, duration, message) {
        // Cancel existing timer with same ID
        if (this.activeTimers.has(id)) {
            logger.info(`Timer '${id}' already active - restarting`);
            this.cancelTimer(id);
        }
        const startTime = Date.now();
        logger.info(`Starting timer '${id}': ${duration}s → "${message}"`);
        // Create timeout for TTS announcement
        const timeoutHandle = setTimeout(() => {
            this.onTimerComplete(id, message);
        }, duration * 1000);
        // Store active timer
        this.activeTimers.set(id, {
            id,
            timeoutHandle,
            startTime,
            duration,
            message,
        });
    }
    /**
     * Cancel a specific timer by ID
     */
    cancelTimer(id) {
        const timer = this.activeTimers.get(id);
        if (!timer) {
            return false;
        }
        clearTimeout(timer.timeoutHandle);
        this.activeTimers.delete(id);
        logger.info(`Timer '${id}' cancelled`);
        return true;
    }
    /**
     * Cancel all active timers
     */
    cancelAllTimers() {
        logger.info(`Cancelling all timers (${this.activeTimers.size} active)`);
        for (const timer of this.activeTimers.values()) {
            clearTimeout(timer.timeoutHandle);
        }
        this.activeTimers.clear();
    }
    /**
     * Get count of active timers
     */
    getActiveTimerCount() {
        return this.activeTimers.size;
    }
    /**
     * Get information about a specific timer
     */
    getTimerInfo(id) {
        const timer = this.activeTimers.get(id);
        if (!timer) {
            return null;
        }
        const elapsed = (Date.now() - timer.startTime) / 1000;
        const remaining = Math.max(0, timer.duration - elapsed);
        return {
            remaining,
            elapsed,
            total: timer.duration,
        };
    }
    /**
     * Called when timer completes
     */
    onTimerComplete(id, message) {
        // Remove from active timers
        this.activeTimers.delete(id);
        logger.info(`Timer '${id}' complete - announcing: "${message}"`);
        // Speak the message using TTS
        if (this.ttsAvailable && this.sayModule) {
            try {
                this.sayModule.speak(message);
            }
            catch (error) {
                logger.error(`TTS error for timer '${id}': ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        else {
            // Fallback: just log the message
            logger.info(`[TTS DISABLED] Would speak: "${message}"`);
        }
    }
    /**
     * Shutdown timer manager - cancel all timers
     */
    shutdown() {
        this.cancelAllTimers();
    }
}
