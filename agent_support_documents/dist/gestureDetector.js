// ============================================================================
// GESTURE DETECTOR - Per-key gesture detection with 9 gesture types
// ============================================================================
//
// FEATURES:
// - Per-key isolated state machines (22 independent keys)
// - Simultaneous multi-key gesture detection (press W+A+1+2 at once)
// - Press count capped at 4 (excess presses = quadruple, no long)
// - Non-blocking async-friendly design for concurrent sequences
//
// ============================================================================
import { INPUT_KEYS, } from "./types.js";
import { performance } from "perf_hooks";
// Maximum press count before treating as quadruple
const MAX_PRESS_COUNT = 4;
// Per-key state machine for gesture detection
// Each key has its own completely independent state machine
class KeyGestureStateMachine {
    key;
    settings;
    emitFn;
    pressHistory = [];
    keyDownTime = null;
    gestureTimer = null;
    // Track if we've exceeded the press limit (ignore further presses until reset)
    pressLimitReached = false;
    constructor(key, settings, emitFn) {
        this.key = key;
        this.settings = settings;
        this.emitFn = emitFn;
    }
    clearTimers() {
        if (this.gestureTimer) {
            clearTimeout(this.gestureTimer);
            this.gestureTimer = null;
        }
        // No other active timers used for classification; we rely on keyUp timing
    }
    emitGesture(gesture, holdDuration) {
        // Emit the gesture via callback (non-blocking)
        // Using queueMicrotask for cross-platform compatibility
        queueMicrotask(() => {
            try {
                this.emitFn({
                    inputKey: this.key,
                    gesture,
                    timestamp: performance.now(),
                    holdDuration,
                });
            }
            catch {
                // swallow
            }
        });
        // Reset state (reuse array to reduce allocations)
        this.pressHistory.length = 0;
        this.pressLimitReached = false;
    }
    /**
     * Resolve gesture based on press count and long press state
     *
     * Press count mapping:
     * - 1: single or long
     * - 2: double or double_long
     * - 3: triple or triple_long
     * - 4: quadruple_long (only if last is long - otherwise treat as no gesture for now)
     * - >4: treated as quadruple_long (excess presses, no long check)
     *
     * Note: The gesture type system only has quadruple_long, not plain quadruple.
     * For >4 presses, we assume the user wants quadruple_long regardless of timing.
     */
    resolveGesture() {
        const count = this.pressHistory.length;
        if (count === 0)
            return;
        const lastPress = this.pressHistory[count - 1];
        let gesture;
        // Helper to map count + pressType -> gesture string
        const mapGesture = (n, type) => {
            const base = n === 1
                ? "single"
                : n === 2
                    ? "double"
                    : n === 3
                        ? "triple"
                        : "quadruple";
            if (type === "normal")
                return base;
            if (type === "long")
                return `${base}_long`;
            return `${base}_super_long`;
        };
        const capped = Math.min(count, MAX_PRESS_COUNT);
        gesture = mapGesture(capped, lastPress.pressType);
        this.emitGesture(gesture);
    }
    handleKeyDown() {
        // If we've already hit the press limit, ignore this press
        if (this.pressLimitReached) {
            return;
        }
        const now = performance.now();
        this.keyDownTime = now;
        // Clear any pending gesture resolution timer (we will re-schedule on keyUp)
        if (this.gestureTimer) {
            clearTimeout(this.gestureTimer);
            this.gestureTimer = null;
        }
    }
    handleKeyUp() {
        if (this.keyDownTime === null)
            return;
        const now = performance.now();
        const holdDuration = now - this.keyDownTime;
        this.keyDownTime = null;
        // If press limit already reached, ignore this key up
        if (this.pressLimitReached) {
            return;
        }
        // If hold exceeded cancel threshold, nullify only this key's recording (do not emit)
        if (holdDuration >= this.settings.cancelThreshold) {
            // Do not add to pressHistory; this press is ignored.
            return;
        }
        // Determine press type for this tap based on holdDuration
        let pressType = "normal";
        if (holdDuration >= this.settings.longPressMin &&
            holdDuration <= this.settings.longPressMax) {
            pressType = "long";
        }
        else if (holdDuration >= this.settings.superLongMin &&
            holdDuration <= this.settings.superLongMax) {
            pressType = "super_long";
        }
        // removed debug logging
        // Check if this press is within multi-press window
        const lastPress = this.pressHistory[this.pressHistory.length - 1];
        const isWithinWindow = lastPress && now - lastPress.timestamp < this.settings.multiPressWindow;
        if (!isWithinWindow) {
            // Start fresh press sequence (reuse array)
            this.pressHistory.length = 0;
            this.pressLimitReached = false;
        }
        // Record this press (normal/long/super_long)
        this.pressHistory.push({ timestamp: now, pressType });
        // If we've reached the max press count, resolve immediately to minimize latency
        if (this.pressHistory.length >= MAX_PRESS_COUNT) {
            this.pressLimitReached = true;
            // Clear any pending timer
            if (this.gestureTimer) {
                clearTimeout(this.gestureTimer);
                this.gestureTimer = null;
            }
            // Resolve immediately
            this.resolveGesture();
            return;
        }
        // Clear existing gesture timer and schedule resolution after multi-press window
        if (this.gestureTimer) {
            clearTimeout(this.gestureTimer);
        }
        this.gestureTimer = setTimeout(() => {
            this.resolveGesture();
        }, this.settings.multiPressWindow);
    }
    reset() {
        this.clearTimers();
        this.pressHistory = [];
        this.keyDownTime = null;
        this.pressLimitReached = false;
    }
}
// ============================================================================
// MAIN GESTURE DETECTOR - Manages all 22+ independent key state machines
// ============================================================================
export class GestureDetector {
    machines = new Map();
    _callback;
    settings;
    listeners = new Set();
    // Event queue for burst resilience
    eventQueue = [];
    processingQueue = false;
    constructor(settings, callback) {
        this.settings = settings;
        this._callback = callback;
        // Create independent state machine for each input key
        // Each machine is completely isolated - no shared state
        for (const key of INPUT_KEYS) {
            this.machines.set(key, new KeyGestureStateMachine(key, settings, (ev) => {
                try {
                    this._callback(ev);
                }
                catch { }
                for (const l of this.listeners) {
                    try {
                        l(ev);
                    }
                    catch { }
                }
            }));
        }
        // initialized
    }
    /** Replace the callback used by all per-key machines at runtime */
    setCallback(cb) {
        this._callback = cb;
    }
    /** Subscribe to gesture events without replacing the central callback */
    onGesture(cb) {
        this.listeners.add(cb);
    }
    /** Unsubscribe a previously registered gesture listener */
    offGesture(cb) {
        this.listeners.delete(cb);
    }
    get callback() {
        return this._callback;
    }
    set callback(cb) {
        this.setCallback(cb);
    }
    /**
     * Queue a key event for processing
     * Uses immediate processing for low-latency with queue fallback for bursts
     */
    queueEvent(type, key) {
        const event = { type, key, timestamp: Date.now() };
        // Process immediately if not already processing
        if (!this.processingQueue) {
            this.processEvent(event);
        }
        else {
            // Queue for later processing
            this.eventQueue.push(event);
            // Warn if queue is getting large (potential issue)
            if (this.eventQueue.length > 50) {
                console.warn(`⚠️  Event queue building up: ${this.eventQueue.length} events`);
            }
        }
    }
    processEvent(event) {
        this.processingQueue = true;
        const upperKey = event.key.toUpperCase();
        const machine = this.machines.get(upperKey);
        if (machine) {
            if (event.type === "down") {
                machine.handleKeyDown();
            }
            else {
                machine.handleKeyUp();
            }
        }
        // Process any queued events
        if (this.eventQueue.length > 0) {
            const nextEvent = this.eventQueue.shift();
            // Use queueMicrotask for cross-platform compatibility
            queueMicrotask(() => this.processEvent(nextEvent));
        }
        else {
            this.processingQueue = false;
        }
    }
    handleKeyDown(key) {
        this.queueEvent("down", key);
    }
    handleKeyUp(key) {
        this.queueEvent("up", key);
    }
    handleMouseDown(button) {
        this.queueEvent("down", button);
    }
    handleMouseUp(button) {
        this.queueEvent("up", button);
    }
    reset() {
        // Clear event queue
        this.eventQueue = [];
        this.processingQueue = false;
        // Reset all machines
        for (const machine of this.machines.values()) {
            machine.reset();
        }
    }
    updateSettings(settings) {
        this.settings = settings;
        // Recreate machines with new settings
        this.machines.clear();
        for (const key of INPUT_KEYS) {
            this.machines.set(key, new KeyGestureStateMachine(key, settings, (ev) => {
                try {
                    this._callback(ev);
                }
                catch { }
                for (const l of this.listeners) {
                    try {
                        l(ev);
                    }
                    catch { }
                }
            }));
        }
    }
    /**
     * Get current queue depth (for monitoring)
     */
    getQueueDepth() {
        return this.eventQueue.length;
    }
}
