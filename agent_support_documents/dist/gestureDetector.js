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
    // Elongating window with dynamic timing: multiPressWindow initial + 60ms per additional tap
    windowDeadline = null;
    waitingForRelease = false; // Must wait for final key release
    // Track if the current keyDown occurred within the window (for long/super_long detection)
    // This allows held keys to count toward the sequence even if released after window expires
    keyDownWasWithinWindow = false;
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
    // Window timing constants (TRIPLED from original for more forgiving detection)
    static INITIAL_WINDOW = 240; // First keyDown to 2nd keyDown window - was 80
    static EXTENSION_WINDOW = 150; // Each subsequent keyDown extension - was 50
    handleKeyDown() {
        // If we've already hit the press limit, ignore this press
        if (this.pressLimitReached) {
            return;
        }
        const now = performance.now();
        // Determine if this keyDown is within the elongating window
        // This is the critical check - we track it so that even if the key is held
        // past the window deadline (for long/super_long), it still counts toward the sequence
        const withinWindow = this.windowDeadline !== null && now <= this.windowDeadline;
        if (withinWindow) {
            // This keyDown is within the window - it will count toward the current sequence
            this.keyDownWasWithinWindow = true;
            // Clear any pending timer as we're continuing the sequence
            if (this.gestureTimer) {
                clearTimeout(this.gestureTimer);
                this.gestureTimer = null;
            }
            // CRITICAL: Extend window from THIS keyDown time (not keyUp!)
            // Per spec: Window = keyDownTime + EXTENSION_WINDOW for 2nd, 3rd, 4th press
            this.windowDeadline = now + KeyGestureStateMachine.EXTENSION_WINDOW;
        }
        else {
            // This keyDown is outside the window - it starts a new sequence
            // But only clear history if we're not waiting for a 4th press release
            if (!this.waitingForRelease) {
                this.pressHistory.length = 0;
                this.pressLimitReached = false;
            }
            this.keyDownWasWithinWindow = false; // First press of new sequence
            // CRITICAL: Set initial window from THIS keyDown time
            // Per spec: Window = keyDownTime + INITIAL_WINDOW for 1st press
            this.windowDeadline = now + KeyGestureStateMachine.INITIAL_WINDOW;
        }
        this.keyDownTime = now;
        // Handle 4th press special case - will resolve immediately on release
        if (this.pressHistory.length === 3 &&
            (withinWindow || this.waitingForRelease)) {
            this.windowDeadline = null;
            this.waitingForRelease = true;
        }
    }
    handleKeyUp() {
        if (this.keyDownTime === null)
            return;
        const now = performance.now();
        const holdDuration = now - this.keyDownTime;
        const keyDownTime = this.keyDownTime; // Save before clearing
        this.keyDownTime = null;
        // If press limit already reached, ignore this key up
        if (this.pressLimitReached) {
            return;
        }
        // If hold exceeded cancel threshold, nullify only this key's recording (do not emit)
        if (holdDuration >= this.settings.cancelThreshold) {
            // Do not add to pressHistory; this press is ignored.
            // Reset state for next gesture
            this.pressHistory.length = 0;
            this.windowDeadline = null;
            this.waitingForRelease = false;
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
        // Determine if this press counts toward the current sequence
        // Key insight: Check if keyDOWN was within window, not keyUP
        // This allows long/super_long presses that extend past the window to still count
        const countsTowardSequence = this.pressHistory.length === 0 || // First press always counts
            this.keyDownWasWithinWindow || // KeyDown was within window
            this.waitingForRelease; // Waiting for 4th press
        if (!countsTowardSequence) {
            // KeyDown was after window expired - start fresh sequence
            this.pressHistory.length = 0;
            this.pressLimitReached = false;
            this.waitingForRelease = false;
        }
        // Record this press (normal/long/super_long)
        this.pressHistory.push({ timestamp: now, pressType });
        // If we've reached the max press count (4th press), resolve immediately after release
        if (this.pressHistory.length >= MAX_PRESS_COUNT) {
            this.pressLimitReached = true;
            this.waitingForRelease = false;
            this.windowDeadline = null;
            // Clear any pending timers
            if (this.gestureTimer) {
                clearTimeout(this.gestureTimer);
                this.gestureTimer = null;
            }
            // Resolve immediately (we just got the release, so we can classify it)
            this.resolveGesture();
            return;
        }
        // Window is already set in handleKeyDown() based on keyDown time
        // per the spec: window starts from keyDown, not keyUp
        // Gesture finalization is handled by interval checker in parent GestureDetector
        // No need to schedule individual setTimeout per key
    }
    reset() {
        this.clearTimers();
        this.pressHistory = [];
        this.keyDownTime = null;
        this.pressLimitReached = false;
        this.windowDeadline = null;
        this.waitingForRelease = false;
        this.keyDownWasWithinWindow = false;
    }
    /**
     * Check if this key has a pending gesture that should be finalized
     * Called by interval checker in GestureDetector
     */
    checkPendingGesture() {
        // Only finalize if we have pending presses and window expired
        if (this.pressHistory.length === 0)
            return;
        if (this.keyDownTime !== null)
            return; // Still holding key down
        if (this.waitingForRelease)
            return; // Waiting for 4th press release
        const now = performance.now();
        if (this.windowDeadline !== null && now >= this.windowDeadline) {
            // Window expired, finalize the gesture
            this.resolveGesture();
        }
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
    // Interval-based gesture checking (replaces individual timeouts)
    checkInterval = null;
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
        // Start interval-based gesture checker (50ms intervals)
        this.checkInterval = setInterval(() => {
            this.checkAllPendingGestures();
        }, 50);
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
     * Check all key state machines for pending gestures that should be finalized
     * Called every 50ms by interval timer
     */
    checkAllPendingGestures() {
        for (const machine of this.machines.values()) {
            machine.checkPendingGesture();
        }
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
        // Clear interval checker
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        // Restart interval checker
        this.checkInterval = setInterval(() => {
            this.checkAllPendingGestures();
        }, 50);
        // Reset all machines
        for (const machine of this.machines.values()) {
            machine.reset();
        }
    }
    updateSettings(settings) {
        this.settings = settings;
        // Clear existing interval
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
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
        // Restart interval checker
        this.checkInterval = setInterval(() => {
            this.checkAllPendingGestures();
        }, 50);
    }
    /**
     * Get current queue depth (for monitoring)
     */
    getQueueDepth() {
        return this.eventQueue.length;
    }
}
