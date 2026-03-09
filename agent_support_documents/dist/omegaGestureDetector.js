// ============================================================================
// OMEGA GESTURE DETECTOR - Enhanced with Special Key Behaviors
// ============================================================================
//
// ARCHITECTURE:
// - 4 base gestures: quick, long, quick_toggle, long_toggle
// - Long gestures fire IMMEDIATELY when threshold is crossed (no keyUp wait)
// - W and Y act as toggle activators (first to cross threshold wins)
// - Per-key calibrated thresholds
//
// SPECIAL KEY BEHAVIORS:
// - D: Time-based Burst (hold 360ms → 9 Rs over 1.7-1.9s)
// - S: Dual-purpose (quick=Guard, long=Group Member Toggle)
// - C: Quick/long + double-tap ESCAPE detection
// - =: Gap-based only (tap count, ignores hold duration)
// - F2: Gap-based only (tap count, ignores hold duration)
// - 6: Custom threshold based on toggle state (415ms vs 320ms)
// - W/Y: Toggle activators with quick fallback if released early
//
// ============================================================================
import { INPUT_KEYS } from "./types.js";
import { DEFAULT_OMEGA_CONFIG, createInitialOmegaState, getKeyThreshold, isToggleKey, TOGGLE_KEYS, OMEGA_KEY_THRESHOLDS, } from "./omegaTypes.js";
import { performance } from "perf_hooks";
// ============================================================================
// SPECIAL KEY CONSTANTS
// ============================================================================
/**
 * D KEY STREAMING SYSTEM
 * While D is held: sends 1 R every 290ms after initial 120ms delay
 * - First R fires after 120ms of D hold
 * - Second R at 410ms (120 + 290), then every 290ms after
 * - Each R held for 36-41ms
 * - D release: R stream PERSISTS for 1.8s unless = is pressed
 *   (= within 400ms before D release or within 1.8s after cancels persistence)
 */
const D_FIRST_R_DELAY_MS = 120; // First R fires after 120ms
const D_STREAM_INTERVAL_MS = 430; // Subsequent Rs every 430ms
const D_R_HOLD_MIN_MS = 36; // Minimum R key hold duration
const D_R_HOLD_MAX_MS = 41; // Maximum R key hold duration
const D_PERSIST_DURATION_MS = 1800; // R stream persists 1.8s after D release
const D_PERSIST_EQUALS_CANCEL_WINDOW_MS = 400; // = within 400ms before D release cancels
/** Temporary input keys only active during D hold (movement keys - passed through) */
const D_ONLY_INPUT_KEYS = new Set(["E", "F", "G", ";"]);
/**
 * Group member SWTOR keybinds (the keys SWTOR has bound for ops frame targeting)
 * These are the physical keys the game uses - user presses these in ops frame
 */
const GROUP_MEMBER_SWTOR_KEYS = new Set([
    "F10", // Group Member 1 in SWTOR
    "F11", // Group Member 2 in SWTOR
    "F12", // Group Member 3 in SWTOR
    "INSERT", // Group Member 4 in SWTOR
]);
/** Map SWTOR key to internal name for output */
const SWTOR_KEY_TO_OUTPUT = {
    F10: "F10",
    F11: "F11",
    F12: "F12",
    INSERT: "INSERT",
};
/**
 * DEFAULT S key group member toggle outputs: slot 1-4 -> [target key, then ALT+F9 (cog)]
 * These can be reconfigured at match start via config mode
 */
const DEFAULT_GROUP_MEMBER_OUTPUTS = {
    "1": ["F10", "ALT+F9"],
    "2": ["F11", "ALT+F9"],
    "3": ["F12", "ALT+F9"],
    "4": ["INSERT", "ALT+F9"],
};
/** Keys that intercept during S group member toggle */
const S_INTERCEPT_KEYS = new Set(["1", "2", "3", "4", "5", "6", "T"]);
/** S toggle T key output: Target of Target (M) + Cog (ALT+F9) */
const S_TOGGLE_T_OUTPUT = ["M", "ALT+F9"];
/** Key 7 threshold for F2 toggle activation */
const KEY_7_F2_TOGGLE_THRESHOLD_MS = 500;
/** Config mode timeout - window to press 1-4 after pressing a group member key */
const CONFIG_MODE_WINDOW_MS = 3000;
/** C key multi-press window for double-tap detection */
const C_MULTIPRESS_WINDOW = 337;
/** MIDDLE_CLICK multi-press window for double-tap detection */
const MIDDLE_CLICK_MULTIPRESS_WINDOW = 350;
/** = key multi-press window (gap-based only) */
const EQUALS_MULTIPRESS_WINDOW = 419;
/** = key threshold to trigger R streaming (same as D key behavior) */
const EQUALS_R_STREAM_THRESHOLD_MS = 540;
/** F2 key threshold to trigger R streaming (after 888ms, also streams Rs) */
const F2_R_STREAM_THRESHOLD_MS = 888;
/** F2 key multi-press window (gap-based only) */
const F2_MULTIPRESS_WINDOW = 307;
/** Key 6 thresholds */
const KEY_6_NORMAL_THRESHOLD = 510;
const KEY_6_TOGGLE_THRESHOLD = 510;
/**
 * Create extended initial state
 */
function createExtendedOmegaState() {
    return {
        ...createInitialOmegaState(),
        dKey: {
            active: false,
            startTime: 0,
            streamTimer: null,
            rCount: 0,
            persistTimer: null,
            releaseTime: null,
            toggledOn: false,
        },
        equalsRStream: {
            holdStartTime: null,
            triggeredRStream: false,
            checkTimer: null,
        },
        f2RStream: {
            triggeredRStream: false,
            checkTimer: null,
        },
        sKey: {
            active: false,
            startTime: null,
        },
        cKey: {
            tapCount: 0,
            lastTapTime: 0,
            windowTimer: null,
            pendingQuick: false,
        },
        middleClick: {
            tapCount: 0,
            lastTapTime: 0,
            windowTimer: null,
        },
        equalsKey: {
            tapCount: 0,
            lastTapTime: 0,
            windowTimer: null,
        },
        f2Key: {
            tapCount: 0,
            lastTapTime: 0,
            windowTimer: null,
        },
        f2Toggle: {
            active: false,
            startTime: null,
        },
        key7: {
            activatedF2Toggle: false,
            checkTimer: null,
        },
        qToggle: {
            active: false,
            startTime: null,
        },
        groupMemberConfig: {
            configModeActive: false,
            pendingSwotorKey: null,
            pendingKeyTime: 0,
            pendingTimer: null,
            slotMappings: { ...DEFAULT_GROUP_MEMBER_OUTPUTS },
            configuredCount: 0,
            dpsDesignationPhase: null,
            dps1Slot: null,
            dps2Slot: null,
        },
    };
}
// ============================================================================
// OMEGA GESTURE DETECTOR CLASS (ENHANCED)
// ============================================================================
export class OmegaGestureDetector {
    // Core state
    state;
    config;
    globalSettings;
    keySpecificSettings = new Map();
    // Callbacks
    gestureCallback;
    specialKeyCallback = null;
    listeners = new Set();
    isTTSSpeakingCallback = null;
    // Timers and intervals
    checkInterval = null;
    pendingQuickTimers = new Map();
    // Event queue for burst handling
    eventQueue = [];
    processingQueue = false;
    // Key suppression (prevents robotjs synthetic keys from being re-detected)
    suppressedKeys = new Set();
    suppressionTimers = new Map();
    // Key 7 combo tracking (for 4+7 combo detection)
    key7ComboState = {
        downTime: null,
        upTime: null,
        isDown: false,
    };
    // Binding lookup for "fire quick immediately if no long" optimization
    // Set<"inputKey:gesture"> - e.g., "4:long", "5:long_toggle"
    existingBindings = new Set();
    // Shutdown flag
    isStopped = false;
    // Configurable D stream interval (default from module constant, overridable for teensy mode)
    dStreamIntervalMs = D_STREAM_INTERVAL_MS;
    // D key mode: continuous_stream (Tank), burst_stream_slow/fast, single_press
    dKeyMode = "continuous_stream";
    // Burst stream constants
    static BURST_INTRA_GAP_MIN = 100; // ms between Rs within a burst
    static BURST_INTRA_GAP_MAX = 127;
    static BURST_COUNT = 3; // Rs per burst cycle
    static BURST_SLOW_CYCLE_MIN = 4000; // cycle delay for slow burst (Rage)
    static BURST_SLOW_CYCLE_MAX = 6000;
    static BURST_FAST_CYCLE_MIN = 3600; // cycle delay for fast burst (Mercs)
    static BURST_FAST_CYCLE_MAX = 4200;
    // D key output key (used by single_press and burst modes; continuous always emits R)
    dKeyOutputKey = "R";
    constructor(settings, gestureCallback, config, specialKeyCallback) {
        this.globalSettings = settings;
        this.gestureCallback = gestureCallback;
        this.specialKeyCallback = specialKeyCallback || null;
        this.config = { ...DEFAULT_OMEGA_CONFIG, ...config };
        this.state = createExtendedOmegaState();
        // Don't start interval yet - wait for first keypress (on-demand optimization)
        // this.startCheckInterval() called in maybeStartCheckInterval()
    }
    /**
     * Set callback for special key outputs (D retaliate, S group member, etc.)
     */
    setSpecialKeyCallback(callback) {
        this.specialKeyCallback = callback;
    }
    /**
     * Set callback to check if TTS is currently speaking
     * Used to ignore D presses during TTS announcements
     */
    setTTSSpeakingCallback(callback) {
        this.isTTSSpeakingCallback = callback;
    }
    /**
     * Set the D key R stream interval (ms between repeated R presses while D is held).
     * Default: 380ms (software mode, reduces queue pressure)
     * Teensy mode: 200ms (faster Retaliate procs, no queue contention)
     */
    setDStreamInterval(intervalMs) {
        this.dStreamIntervalMs = intervalMs;
        console.log(`🔧 D stream interval set to ${intervalMs}ms`);
    }
    /**
     * Set the D key behavior mode for the active profile
     * - continuous_stream: Toggle on/off R stream (Tank)
     * - burst_stream_slow: Toggle burst cycle (3 Rs, 5.6-6.8s between) (Rage)
     * - burst_stream_fast: Toggle burst cycle (3 Rs, 3.6-4.2s between) (Mercs)
     * - single_press: Fire one R per D press (Sorcs, Engineering)
     */
    setDKeyMode(mode) {
        this.dKeyMode = mode;
        console.log(`🔧 D key mode set to: ${mode}`);
    }
    /**
     * Set the output key for D key single_press and burst modes.
     * Continuous stream always emits "R" (Tank).
     */
    setDKeyOutput(key) {
        this.dKeyOutputKey = key;
        console.log(`🔧 D key output set to: ${key}`);
    }
    /**
     * Get the DPS target key for a given DPS slot (1 or 2)
     * Returns the group member target key mapped to the designated DPS slot,
     * or null if that DPS slot hasn't been designated.
     */
    getDPSTargetKey(dpsSlot) {
        const config = this.state.groupMemberConfig;
        const slotKey = dpsSlot === 1 ? config.dps1Slot : config.dps2Slot;
        if (!slotKey)
            return null;
        const outputs = config.slotMappings[slotKey];
        if (!outputs)
            return null;
        return outputs[0]; // Return the target key (first element)
    }
    /**
     * Set the list of existing bindings for "fire quick immediately if no long" optimization
     * @param bindings - Array of binding objects with inputKey and gesture properties
     */
    setExistingBindings(bindings) {
        this.existingBindings.clear();
        for (const binding of bindings) {
            const key = `${binding.inputKey}:${binding.gesture}`;
            this.existingBindings.add(key);
        }
        console.log(`🔧 Loaded ${bindings.length} bindings for instant-quick optimization`);
        // Check if combo_7_4 binding exists
        const hasCombo = bindings.some((b) => b.gesture === "combo_7_4");
        if (hasCombo) {
            console.log("🎯 4+7 combo binding registered");
        }
    }
    /**
     * Check if a long binding exists for this key in the given state
     */
    hasLongBinding(key, isToggled, isF2Toggle) {
        // Check Q toggle first
        if (this.state.qToggle.active && key !== "Q") {
            const bindingKey = `${key}:long_q_toggle`;
            return this.existingBindings.has(bindingKey);
        }
        // Determine what long gesture would be for this state
        let longGesture;
        if (isF2Toggle) {
            longGesture = isToggled ? "long_toggle_f2" : "long_f2";
        }
        else {
            longGesture = isToggled ? "long_toggle" : "long";
        }
        const bindingKey = `${key}:${longGesture}`;
        return this.existingBindings.has(bindingKey);
    }
    /**
     * Suppress a key temporarily (prevents robotjs synthetic keys from being re-detected)
     * @param key - The key to suppress (e.g., "B")
     * @param durationMs - How long to suppress (default 150ms)
     */
    suppressKey(key, durationMs = 150) {
        const upperKey = key.toUpperCase();
        // Clear any existing timer for this key
        const existingTimer = this.suppressionTimers.get(upperKey);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }
        // Add to suppressed set
        this.suppressedKeys.add(upperKey);
        // Set timer to remove suppression
        const timer = setTimeout(() => {
            this.suppressedKeys.delete(upperKey);
            this.suppressionTimers.delete(upperKey);
        }, durationMs);
        this.suppressionTimers.set(upperKey, timer);
    }
    // ==========================================================================
    // INTERVAL MANAGEMENT
    // ==========================================================================
    startCheckInterval() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
        this.checkInterval = setInterval(() => {
            if (this.isStopped)
                return;
            this.checkAllThresholds();
        }, this.config.checkIntervalMs);
    }
    /**
     * Stop the check interval when no keys are held (performance optimization)
     */
    stopCheckInterval() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
    /**
     * Start interval only when keys are being held (on-demand optimization)
     * This saves ~10% CPU when idle
     */
    maybeStartCheckInterval() {
        if (!this.checkInterval && this.state.activeKeyDowns.size > 0) {
            this.startCheckInterval();
        }
    }
    /**
     * Stop interval when all keys released (on-demand optimization)
     */
    maybeStopCheckInterval() {
        if (this.state.activeKeyDowns.size === 0) {
            this.stopCheckInterval();
        }
    }
    /**
     * Check all active key holds for threshold crossing
     */
    checkAllThresholds() {
        const now = performance.now();
        // D key uses interval-based streaming, no threshold check needed
        // Check S key for group member toggle activation
        this.checkSKeyToggleActivation(now);
        // Check standard keys for long-press threshold crossing
        for (const [key, keyState] of this.state.activeKeyDowns) {
            // Skip special handling keys (D, S, =, F2 have custom logic)
            if (key === "D" || key === "S" || key === "=" || key === "F2")
                continue;
            // Skip toggle keys (W, Y, Q) - they use checkToggleActivation instead
            if (key === "W" || key === "Y" || key === "Q")
                continue;
            // Skip if long already fired
            if (keyState.longFired)
                continue;
            // C key has special handling
            if (key === "C") {
                this.checkCKeyLongPress(now, keyState);
                continue;
            }
            // MIDDLE_CLICK has special handling
            if (key === "MIDDLE_CLICK") {
                this.checkMiddleClickLongPress(now, keyState);
                continue;
            }
            // Standard long-press detection
            const holdDuration = now - keyState.startTime;
            const isToggled = this.getEffectiveToggleState(key);
            const threshold = this.getEffectiveThreshold(key, isToggled);
            // Debug logging for key 6 (only when about to fire, not every check)
            // Removed for performance - re-enable with DEBUG=1 if needed
            if (holdDuration >= threshold) {
                this.fireLongGesture(key, holdDuration, isToggled);
            }
        }
        // Check toggle activators for toggle activation
        this.checkToggleActivation(now);
        // Check Q toggle activation
        this.checkQToggleActivation(now);
    }
    /**
     * Get effective threshold for a key, accounting for special cases
     */
    getEffectiveThreshold(key, isToggled) {
        // Key 6 has custom thresholds based on toggle state
        if (key === "6") {
            return isToggled ? KEY_6_TOGGLE_THRESHOLD : KEY_6_NORMAL_THRESHOLD;
        }
        // Use standard threshold lookup
        return getKeyThreshold(key, isToggled);
    }
    // ==========================================================================
    // D KEY + = KEY - SHARED R STREAMING
    // ==========================================================================
    // D held: sends Rs after 120ms delay, then every 290ms
    // = held ≥540ms: triggers same R stream
    // Only ONE stream runs - D and = share it
    // Stream stops when BOTH D and = are released
    // ==========================================================================
    /**
     * Check if R stream is currently active (from either D or =)
     */
    isRStreamActive() {
        return this.state.dKey.active;
    }
    /**
     * Start the shared R stream (called by D, =, or F2)
     * Only starts if not already running
     */
    startSharedRStream(source) {
        // If stream already running, just mark this source as contributing
        if (this.state.dKey.active) {
            return;
        }
        const now = performance.now();
        // Initialize stream state
        this.state.dKey = {
            active: true,
            startTime: now,
            streamTimer: null,
            rCount: 0,
            persistTimer: null,
            releaseTime: null,
            toggledOn: this.state.dKey.toggledOn,
        };
        // First R fires after 120ms delay, then every 290ms after that
        this.state.dKey.streamTimer = setTimeout(() => {
            if (!this.state.dKey.active)
                return;
            // Fire first R
            this.sendStreamR();
            // Start interval for subsequent Rs (using configurable interval)
            this.state.dKey.streamTimer = setInterval(() => {
                this.sendStreamR();
            }, this.dStreamIntervalMs);
        }, D_FIRST_R_DELAY_MS);
    }
    /**
     * Stop the shared R stream (only if ALL sources are no longer streaming)
     * D toggle mode: only stops if D toggle is off AND = and F2 are not streaming
     */
    stopSharedRStreamIfNeeded() {
        // Check if D toggle is still on
        const dToggled = this.state.dKey.toggledOn;
        // Check if = triggered the stream and is still held
        const equalsHeld = this.state.equalsRStream.triggeredRStream &&
            this.state.activeKeyDowns.has("=");
        // Check if F2 triggered the stream and is still held
        const f2Held = this.state.f2RStream.triggeredRStream &&
            this.state.activeKeyDowns.has("F2");
        // Only stop if none are holding the stream
        if (!dToggled && !equalsHeld && !f2Held) {
            this.stopDStream();
            // Reset D state (preserve toggledOn which is already false)
            this.state.dKey = {
                active: false,
                startTime: 0,
                streamTimer: null,
                rCount: 0,
                persistTimer: null,
                releaseTime: null,
                toggledOn: false,
            };
        }
    }
    /**
     * Handle D key down - dispatches to mode-specific handler
     */
    handleDKeyDown() {
        // If D already tracked (key repeat), ignore
        if (this.state.activeKeyDowns.has("D")) {
            return;
        }
        // Ignore D presses while TTS is still speaking (prevents accidental double-toggle)
        if (this.isTTSSpeakingCallback && this.isTTSSpeakingCallback()) {
            console.log("🔇 D press ignored - TTS still speaking");
            return;
        }
        const now = performance.now();
        // Record in active keys (for key repeat detection only)
        this.state.activeKeyDowns.set("D", {
            startTime: now,
            longFired: false,
        });
        switch (this.dKeyMode) {
            case "continuous_stream":
                this.handleDKeyToggleContinuous();
                break;
            case "burst_stream_slow":
            case "burst_stream_fast":
                this.handleDKeyToggleBurst();
                break;
            case "single_press":
                this.handleDKeySinglePress();
                break;
        }
    }
    /**
     * D key continuous stream (Tank) - toggle R stream on/off
     * First press: starts R stream + TTS "on on on"
     * Second press: stops R stream + TTS "off off off"
     */
    handleDKeyToggleContinuous() {
        if (this.state.dKey.toggledOn) {
            // Currently ON → turn OFF
            this.state.dKey.toggledOn = false;
            console.log("🔴 D Toggle: R stream OFF");
            // Stop the stream
            this.stopDStream();
            this.state.dKey.active = false;
            this.state.dKey.rCount = 0;
            // TTS "off off off"
            if (this.specialKeyCallback) {
                this.specialKeyCallback({
                    type: "direct_output",
                    keys: [],
                    ttsMessage: "off off off",
                    source: "d_toggle_tts",
                });
            }
        }
        else {
            // Currently OFF → turn ON
            this.state.dKey.toggledOn = true;
            console.log("🟢 D Toggle: R stream ON");
            // Cancel any persistence timer from previous session
            if (this.state.dKey.persistTimer) {
                clearTimeout(this.state.dKey.persistTimer);
                this.state.dKey.persistTimer = null;
            }
            // TTS "on on on"
            if (this.specialKeyCallback) {
                this.specialKeyCallback({
                    type: "direct_output",
                    keys: [],
                    ttsMessage: "on on on",
                    source: "d_toggle_tts",
                });
            }
            // Start shared R stream
            this.startSharedRStream("D");
        }
    }
    /**
     * D key burst stream (Rage = slow, Mercs = fast) - toggle burst cycle on/off
     * Toggle ON: fires burst of 3 Rs (100-127ms gaps), then waits cycle delay, repeats
     * Toggle OFF: stops burst cycle
     */
    handleDKeyToggleBurst() {
        if (this.state.dKey.toggledOn) {
            // Currently ON → turn OFF
            this.state.dKey.toggledOn = false;
            console.log(`🔴 D Toggle: Burst stream OFF (${this.dKeyMode})`);
            this.stopDStream();
            this.state.dKey.active = false;
            this.state.dKey.rCount = 0;
            if (this.specialKeyCallback) {
                this.specialKeyCallback({
                    type: "direct_output",
                    keys: [],
                    ttsMessage: "off off off",
                    source: "d_toggle_tts",
                });
            }
        }
        else {
            // Currently OFF → turn ON
            this.state.dKey.toggledOn = true;
            console.log(`🟢 D Toggle: Burst stream ON (${this.dKeyMode})`);
            if (this.state.dKey.persistTimer) {
                clearTimeout(this.state.dKey.persistTimer);
                this.state.dKey.persistTimer = null;
            }
            if (this.specialKeyCallback) {
                this.specialKeyCallback({
                    type: "direct_output",
                    keys: [],
                    ttsMessage: "on on on",
                    source: "d_toggle_tts",
                });
            }
            // Start burst R stream cycle
            this.startBurstRStream();
        }
    }
    /**
     * D key single press (Sorcs, Engineering) - fire one R per D press
     */
    handleDKeySinglePress() {
        console.log("🟡 D Single Press: Firing one R");
        if (this.specialKeyCallback) {
            this.specialKeyCallback({
                type: "direct_output",
                keys: [this.dKeyOutputKey],
                timings: {
                    keyDownMs: [D_R_HOLD_MIN_MS, D_R_HOLD_MAX_MS],
                },
                source: "d_stream",
            });
        }
    }
    /**
     * Start burst R stream cycle: fires 3 Rs with 100-127ms gaps,
     * then waits cycle delay before repeating
     */
    startBurstRStream() {
        // Stop any existing stream
        this.stopDStream();
        this.state.dKey.active = true;
        this.state.dKey.startTime = performance.now();
        this.state.dKey.rCount = 0;
        const fireBurstCycle = () => {
            if (!this.state.dKey.toggledOn || !this.state.dKey.active)
                return;
            let burstIndex = 0;
            const fireNextR = () => {
                if (!this.state.dKey.toggledOn || !this.state.dKey.active)
                    return;
                // Fire burst key
                this.state.dKey.rCount++;
                if (this.specialKeyCallback) {
                    this.specialKeyCallback({
                        type: "direct_output",
                        keys: [this.dKeyOutputKey],
                        timings: {
                            keyDownMs: [D_R_HOLD_MIN_MS, D_R_HOLD_MAX_MS],
                        },
                        source: "d_stream",
                    });
                }
                burstIndex++;
                if (burstIndex < OmegaGestureDetector.BURST_COUNT) {
                    // Schedule next R in burst with 100-127ms gap
                    const gap = OmegaGestureDetector.BURST_INTRA_GAP_MIN +
                        Math.random() *
                            (OmegaGestureDetector.BURST_INTRA_GAP_MAX -
                                OmegaGestureDetector.BURST_INTRA_GAP_MIN);
                    this.state.dKey.streamTimer = setTimeout(fireNextR, gap);
                }
                else {
                    // Burst complete - schedule next cycle
                    const [cycleMin, cycleMax] = this.dKeyMode === "burst_stream_slow"
                        ? [
                            OmegaGestureDetector.BURST_SLOW_CYCLE_MIN,
                            OmegaGestureDetector.BURST_SLOW_CYCLE_MAX,
                        ]
                        : [
                            OmegaGestureDetector.BURST_FAST_CYCLE_MIN,
                            OmegaGestureDetector.BURST_FAST_CYCLE_MAX,
                        ];
                    const cycleDelay = cycleMin + Math.random() * (cycleMax - cycleMin);
                    console.log(`   💤 Burst cycle complete (${OmegaGestureDetector.BURST_COUNT} Rs), next in ${Math.round(cycleDelay)}ms`);
                    this.state.dKey.streamTimer = setTimeout(fireBurstCycle, cycleDelay);
                }
            };
            fireNextR();
        };
        // Start first burst immediately
        fireBurstCycle();
    }
    /**
     * Send a single R in the stream
     */
    sendStreamR() {
        if (!this.state.dKey.active) {
            this.stopDStream();
            return;
        }
        this.state.dKey.rCount++;
        if (this.specialKeyCallback) {
            this.specialKeyCallback({
                type: "direct_output",
                keys: ["R"],
                timings: {
                    keyDownMs: [D_R_HOLD_MIN_MS, D_R_HOLD_MAX_MS],
                },
                source: "d_stream",
            });
        }
    }
    /**
     * Stop the D key R stream immediately
     */
    stopDStream() {
        if (this.state.dKey.streamTimer) {
            clearTimeout(this.state.dKey.streamTimer);
            clearInterval(this.state.dKey.streamTimer);
            this.state.dKey.streamTimer = null;
        }
    }
    /**
     * Handle D key up - in toggle mode, just remove from active keys
     */
    handleDKeyUp() {
        this.state.activeKeyDowns.delete("D");
    }
    /**
     * Cancel D stream if = is pressed (works for both hold and toggle modes)
     */
    cancelDPersistenceIfActive() {
        if (this.state.dKey.toggledOn && this.state.dKey.active) {
            console.log("🔴 = pressed → canceling D toggle R stream");
            this.state.dKey.toggledOn = false;
            this.stopDStream();
            this.state.dKey.active = false;
            this.state.dKey.rCount = 0;
            if (this.specialKeyCallback) {
                this.specialKeyCallback({
                    type: "direct_output",
                    keys: [],
                    ttsMessage: "off off off",
                    source: "d_toggle_tts",
                });
            }
            return true;
        }
        return false;
    }
    // ==========================================================================
    // S KEY - DUAL PURPOSE WITH GROUP MEMBER TOGGLE
    // ==========================================================================
    /**
     * Handle S key down
     */
    handleSKeyDown() {
        const now = performance.now();
        this.state.sKey.startTime = now;
        this.state.activeKeyDowns.set("S", {
            startTime: now,
            longFired: false,
        });
    }
    /**
     * Check S key for group member toggle activation
     */
    checkSKeyToggleActivation(now) {
        const sKeyState = this.state.activeKeyDowns.get("S");
        if (!sKeyState || this.state.sKey.active)
            return;
        const holdDuration = now - sKeyState.startTime;
        const threshold = OMEGA_KEY_THRESHOLDS["S"] || 512;
        if (holdDuration >= threshold) {
            // Activate group member toggle
            this.state.sKey.active = true;
            sKeyState.longFired = true; // Prevent normal long gesture
            console.log(`🟢 S key: Group Member Toggle ACTIVATED (held ${Math.round(holdDuration)}ms ≥ ${threshold}ms threshold)`);
            console.log(`   Hold S and press 1/2/3/4 to target group members`);
        }
    }
    /**
     * Handle S key up
     */
    handleSKeyUp() {
        const sKeyState = this.state.activeKeyDowns.get("S");
        if (!sKeyState)
            return;
        const now = performance.now();
        const holdDuration = now - sKeyState.startTime;
        // If group member toggle was active, just deactivate
        if (this.state.sKey.active) {
            console.log("🟢 S key: Group Member Toggle DEACTIVATED");
            this.state.sKey.active = false;
            this.state.sKey.startTime = null;
            this.state.activeKeyDowns.delete("S");
            return;
        }
        // Quick gesture (Guard) - S is independent of W/Y toggle
        if (holdDuration < this.config.cancelThreshold) {
            this.emitGesture({
                inputKey: "S",
                gesture: "quick", // S always uses quick, ignores W/Y toggle
                timestamp: now,
                holdDuration,
                wasToggled: false,
            });
        }
        this.state.activeKeyDowns.delete("S");
        this.state.sKey.startTime = null;
    }
    /**
     * Handle key during S group member toggle - intercept 1/2/3/4
     * Uses dynamic mappings from groupMemberConfig
     */
    handleSInterceptKey(key) {
        if (!this.state.sKey.active)
            return false;
        if (!S_INTERCEPT_KEYS.has(key))
            return false;
        // T key during S toggle: emit Target of Target + Cog
        if (key === "T") {
            console.log(`   🎯 S intercept: T → Target of Target + Cog (${S_TOGGLE_T_OUTPUT.join(" → ")})`);
            if (this.specialKeyCallback) {
                this.specialKeyCallback({
                    type: "direct_output",
                    keys: [...S_TOGGLE_T_OUTPUT],
                    source: "s_target_of_target",
                });
            }
            else {
                console.log(`   ⚠️ S intercept: specialKeyCallback not set!`);
            }
            return true;
        }
        // 5 key during S toggle: Target of Target + Cog
        if (key === "5") {
            console.log(`   🎯 S intercept: 5 → Target of Target + Cog`);
            if (this.specialKeyCallback) {
                this.specialKeyCallback({
                    type: "direct_output",
                    keys: ["M", "ALT+F9"],
                    source: "s_target_of_target",
                });
            }
            return true;
        }
        // 6 key during S toggle: Focus Target's Target of Target + Cog
        if (key === "6") {
            console.log(`   🎯 S intercept: 6 → Focus ToT + Cog`);
            if (this.specialKeyCallback) {
                this.specialKeyCallback({
                    type: "direct_output",
                    keys: ["J", "ALT+F9"],
                    source: "s_target_of_target",
                });
            }
            return true;
        }
        // 1/2/3/4: Use dynamic group member mappings
        const outputs = this.state.groupMemberConfig.slotMappings[key];
        if (!outputs) {
            console.log(`   ⚠️ S intercept: No mapping for key "${key}"`);
            return false;
        }
        console.log(`   🎯 S intercept: ${key} → ${outputs.join(" → ")}`);
        if (this.specialKeyCallback) {
            this.specialKeyCallback({
                type: "direct_output",
                keys: outputs,
                source: "s_group_member",
            });
        }
        else {
            console.log(`   ⚠️ S intercept: specialKeyCallback not set!`);
        }
        // Return true to PREVENT normal gesture processing
        return true;
    }
    // ==========================================================================
    // GROUP MEMBER CONFIGURATION MODE
    // ==========================================================================
    /**
     * Toggle group member config mode on/off
     * Called when user wants to reconfigure group member mappings at match start
     */
    toggleConfigMode() {
        const config = this.state.groupMemberConfig;
        if (config.configModeActive) {
            // Deactivate
            this.exitConfigMode("manual toggle");
        }
        else {
            // Activate
            config.configModeActive = true;
            config.configuredCount = 0;
            config.dpsDesignationPhase = null;
            config.dps1Slot = null;
            config.dps2Slot = null;
            // Reset to defaults when entering config mode
            config.slotMappings = { ...DEFAULT_GROUP_MEMBER_OUTPUTS };
            console.log("╔════════════════════════════════════════════════════════╗");
            console.log("║  🎯 GROUP MEMBER CONFIG MODE ACTIVATED                 ║");
            console.log("║                                                        ║");
            console.log("║  Instructions:                                         ║");
            console.log("║  1. Click an ops frame member (sends [, ], ,, or ')    ║");
            console.log("║  2. Press 1-4 to assign that member to a slot          ║");
            console.log("║  3. Repeat for all 4 members                           ║");
            console.log("║  4. Press CTRL+SHIFT+G again to finish, or auto-exit   ║");
            console.log("║                                                        ║");
            console.log("║  Current mappings will be reset to defaults.           ║");
            console.log("╚════════════════════════════════════════════════════════╝");
        }
    }
    /**
     * Reset group member mappings to defaults
     */
    resetGroupMemberMappings() {
        this.state.groupMemberConfig.slotMappings = {
            ...DEFAULT_GROUP_MEMBER_OUTPUTS,
        };
        this.state.groupMemberConfig.configuredCount = 0;
        console.log("🔄 Group member mappings reset to defaults:");
        this.logCurrentMappings();
    }
    /**
     * Load group member mappings from profile data
     * Profile format: { "1": ["F10", "CTRL+V"], "2": ["F11", "CTRL+V"], ... }
     */
    loadGroupMemberMappings(mappings) {
        const validSlots = ["1", "2", "3", "4"];
        let loaded = 0;
        for (const [slot, keys] of Object.entries(mappings)) {
            if (!validSlots.includes(slot)) {
                console.warn(`⚠️ Invalid group member slot: "${slot}" (expected 1-4)`);
                continue;
            }
            if (!Array.isArray(keys) || keys.length < 2) {
                console.warn(`⚠️ Invalid mapping for slot ${slot}: expected [targetKey, cogKey]`);
                continue;
            }
            this.state.groupMemberConfig.slotMappings[slot] = [keys[0], keys[1]];
            loaded++;
        }
        if (loaded > 0) {
            console.log(`📋 Loaded ${loaded} group member mappings from profile:`);
            this.logCurrentMappings();
        }
    }
    /**
     * Exit config mode
     */
    exitConfigMode(reason) {
        const config = this.state.groupMemberConfig;
        config.configModeActive = false;
        config.pendingSwotorKey = null;
        config.pendingKeyTime = 0;
        if (config.pendingTimer) {
            clearTimeout(config.pendingTimer);
            config.pendingTimer = null;
        }
        console.log(`\n✅ Config mode exited (${reason})`);
        console.log("📋 Final group member mappings:");
        this.logCurrentMappings();
    }
    /**
     * Log current mappings
     */
    logCurrentMappings() {
        const mappings = this.state.groupMemberConfig.slotMappings;
        console.log("   Slot 1 (S+1) → " + mappings["1"]?.[0] + " → ALT+F9");
        console.log("   Slot 2 (S+2) → " + mappings["2"]?.[0] + " → ALT+F9");
        console.log("   Slot 3 (S+3) → " + mappings["3"]?.[0] + " → ALT+F9");
        console.log("   Slot 4 (S+4) → " + mappings["4"]?.[0] + " → ALT+F9");
    }
    /**
     * Handle SWTOR group member key press during config mode
     * These are the raw keys from clicking ops frame members: [, ], ,, '
     */
    handleConfigModeSwotorKey(key) {
        const config = this.state.groupMemberConfig;
        if (!config.configModeActive)
            return false;
        if (!GROUP_MEMBER_SWTOR_KEYS.has(key))
            return false;
        // Clear any existing pending timer
        if (config.pendingTimer) {
            clearTimeout(config.pendingTimer);
        }
        // Set this as the pending key
        config.pendingSwotorKey = key;
        config.pendingKeyTime = performance.now();
        const outputName = SWTOR_KEY_TO_OUTPUT[key];
        console.log(`\n🎯 Config: Detected group member key [${key}] (${outputName})`);
        console.log(`   Now press 1-4 to assign this member to a slot...`);
        // Set timeout to expire the pending key
        config.pendingTimer = setTimeout(() => {
            if (config.pendingSwotorKey === key) {
                console.log(`⏰ Config: Pending key [${key}] expired (no slot selected)`);
                config.pendingSwotorKey = null;
                config.pendingKeyTime = 0;
            }
        }, CONFIG_MODE_WINDOW_MS);
        // Return true to consume the key (don't let it through to other handlers)
        return true;
    }
    /**
     * Handle slot assignment key (1-4) during config mode
     * After 4 slots: enters DPS designation phase
     */
    handleConfigModeSlotKey(key) {
        const config = this.state.groupMemberConfig;
        if (!config.configModeActive)
            return false;
        // DPS Designation Phase: picking DPS 1 or DPS 2
        if (config.dpsDesignationPhase !== null) {
            const slotKeys = ["1", "2", "3", "4"];
            if (!slotKeys.includes(key))
                return false;
            if (config.dpsDesignationPhase === 1) {
                config.dps1Slot = key;
                config.dpsDesignationPhase = 2;
                console.log(`✅ DPS 1 designated → slot ${key} (${config.slotMappings[key]?.[0]})`);
                // TTS "DPS 2"
                if (this.specialKeyCallback) {
                    this.specialKeyCallback({
                        type: "direct_output",
                        keys: [],
                        ttsMessage: "DPS 2",
                        source: "s_group_member",
                    });
                }
                return true;
            }
            else if (config.dpsDesignationPhase === 2) {
                config.dps2Slot = key;
                config.dpsDesignationPhase = null;
                console.log(`✅ DPS 2 designated → slot ${key} (${config.slotMappings[key]?.[0]})`);
                // TTS "config done"
                if (this.specialKeyCallback) {
                    this.specialKeyCallback({
                        type: "direct_output",
                        keys: [],
                        ttsMessage: "config done",
                        source: "s_group_member",
                    });
                }
                console.log(`📋 DPS Designations: DPS1=slot${config.dps1Slot}, DPS2=slot${config.dps2Slot}`);
                this.exitConfigMode("DPS designation complete");
                return true;
            }
        }
        // Normal slot assignment phase
        if (!S_INTERCEPT_KEYS.has(key))
            return false; // Only 1-4
        if (!config.pendingSwotorKey)
            return false; // Must have a pending key
        const outputName = SWTOR_KEY_TO_OUTPUT[config.pendingSwotorKey];
        if (!outputName)
            return false;
        // Clear the timer
        if (config.pendingTimer) {
            clearTimeout(config.pendingTimer);
            config.pendingTimer = null;
        }
        // Assign the mapping
        config.slotMappings[key] = [outputName, "ALT+F9"];
        config.configuredCount++;
        console.log(`✅ Config: Slot ${key} → ${outputName} (${config.pendingSwotorKey})`);
        console.log(`   Configured ${config.configuredCount}/4 slots`);
        // Clear pending
        config.pendingSwotorKey = null;
        config.pendingKeyTime = 0;
        // After all 4 configured, enter DPS designation phase
        if (config.configuredCount >= 4) {
            config.dpsDesignationPhase = 1;
            console.log("\n🎯 All 4 group members configured! Now designating DPS targets:");
            console.log("   Press 1-4 to pick DPS 1, then 1-4 to pick DPS 2");
            // TTS "DPS 1"
            if (this.specialKeyCallback) {
                this.specialKeyCallback({
                    type: "direct_output",
                    keys: [],
                    ttsMessage: "DPS 1",
                    source: "s_group_member",
                });
            }
        }
        // Return true to consume the key
        return true;
    }
    // ==========================================================================
    // C KEY - QUICK/LONG + DOUBLE-TAP ESCAPE
    // ==========================================================================
    /**
     * Handle C key down
     */
    handleCKeyDown() {
        const now = performance.now();
        // Check if within multi-press window for double-tap
        if (this.state.cKey.tapCount > 0 &&
            now - this.state.cKey.lastTapTime < C_MULTIPRESS_WINDOW) {
            // Cancel pending quick timer
            if (this.state.cKey.windowTimer) {
                clearTimeout(this.state.cKey.windowTimer);
                this.state.cKey.windowTimer = null;
            }
        }
        this.state.activeKeyDowns.set("C", {
            startTime: now,
            longFired: false,
        });
    }
    /**
     * Check C key for long-press threshold
     */
    checkCKeyLongPress(now, keyState) {
        if (keyState.longFired)
            return;
        const holdDuration = now - keyState.startTime;
        const isToggled = this.state.toggleActive;
        const threshold = OMEGA_KEY_THRESHOLDS["C"] || 349;
        if (holdDuration >= threshold) {
            // Long press detected - fire immediately
            // Long press cannot be part of double-tap, so no need to wait
            this.state.cKey.tapCount = 0; // Reset tap count
            if (this.state.cKey.windowTimer) {
                clearTimeout(this.state.cKey.windowTimer);
                this.state.cKey.windowTimer = null;
            }
            this.fireLongGesture("C", holdDuration, isToggled);
        }
    }
    /**
     * Handle C key up
     */
    handleCKeyUp() {
        const cKeyState = this.state.activeKeyDowns.get("C");
        if (!cKeyState)
            return;
        const now = performance.now();
        const holdDuration = now - cKeyState.startTime;
        this.state.activeKeyDowns.delete("C");
        // If long already fired, nothing more to do
        if (cKeyState.longFired) {
            return;
        }
        // Check cancel threshold
        if (holdDuration >= this.config.cancelThreshold) {
            console.log(`⛔ C cancelled (held ${Math.round(holdDuration)}ms)`);
            return;
        }
        // Increment tap count
        this.state.cKey.tapCount++;
        this.state.cKey.lastTapTime = now;
        // Clear existing window timer
        if (this.state.cKey.windowTimer) {
            clearTimeout(this.state.cKey.windowTimer);
        }
        // Check for double-tap immediately
        if (this.state.cKey.tapCount >= 2) {
            // Double-tap detected - emit ESCAPE
            console.log("🟡 C key: Double-tap → ESCAPE");
            this.state.cKey.tapCount = 0;
            this.state.cKey.windowTimer = null;
            if (this.specialKeyCallback) {
                this.specialKeyCallback({
                    type: "direct_output",
                    keys: ["ESCAPE"],
                    source: "c_escape",
                });
            }
            return;
        }
        // Schedule single-tap (quick) after window expires
        const isToggled = this.state.toggleActive;
        this.state.cKey.windowTimer = setTimeout(() => {
            if (this.isStopped)
                return;
            // Window expired with single tap - fire quick gesture
            if (this.state.cKey.tapCount === 1) {
                this.state.cKey.tapCount = 0;
                this.fireQuickGesture("C", holdDuration, isToggled);
            }
            this.state.cKey.windowTimer = null;
        }, C_MULTIPRESS_WINDOW);
    }
    // ==========================================================================
    // MIDDLE_CLICK - QUICK/LONG + DOUBLE-TAP MAX ZOOM OUT
    // ==========================================================================
    /**
     * Handle MIDDLE_CLICK down
     */
    handleMiddleClickDown() {
        const now = performance.now();
        // Check if within multi-press window for double-tap
        if (this.state.middleClick.tapCount > 0 &&
            now - this.state.middleClick.lastTapTime < MIDDLE_CLICK_MULTIPRESS_WINDOW) {
            // Cancel pending quick timer
            if (this.state.middleClick.windowTimer) {
                clearTimeout(this.state.middleClick.windowTimer);
                this.state.middleClick.windowTimer = null;
            }
        }
        this.state.activeKeyDowns.set("MIDDLE_CLICK", {
            startTime: now,
            longFired: false,
        });
    }
    /**
     * Check MIDDLE_CLICK for long-press threshold
     */
    checkMiddleClickLongPress(now, keyState) {
        if (keyState.longFired)
            return;
        const holdDuration = now - keyState.startTime;
        const isToggled = this.state.toggleActive;
        const threshold = OMEGA_KEY_THRESHOLDS["MIDDLE_CLICK"] || 442;
        if (holdDuration >= threshold) {
            // Long press detected - fire immediately
            this.state.middleClick.tapCount = 0; // Reset tap count
            if (this.state.middleClick.windowTimer) {
                clearTimeout(this.state.middleClick.windowTimer);
                this.state.middleClick.windowTimer = null;
            }
            this.fireLongGesture("MIDDLE_CLICK", holdDuration, isToggled);
        }
    }
    /**
     * Handle MIDDLE_CLICK up
     */
    handleMiddleClickUp() {
        const mcState = this.state.activeKeyDowns.get("MIDDLE_CLICK");
        if (!mcState)
            return;
        const now = performance.now();
        const holdDuration = now - mcState.startTime;
        this.state.activeKeyDowns.delete("MIDDLE_CLICK");
        // If long already fired, nothing more to do
        if (mcState.longFired) {
            return;
        }
        // Check cancel threshold
        if (holdDuration >= this.config.cancelThreshold) {
            console.log(`⛔ MIDDLE_CLICK cancelled (held ${Math.round(holdDuration)}ms)`);
            return;
        }
        // Increment tap count
        this.state.middleClick.tapCount++;
        this.state.middleClick.lastTapTime = now;
        // Clear existing window timer
        if (this.state.middleClick.windowTimer) {
            clearTimeout(this.state.middleClick.windowTimer);
        }
        // Check for double-tap immediately
        if (this.state.middleClick.tapCount >= 2) {
            // Double-tap detected - emit max zoom out (CTRL+B)
            console.log("🟡 MIDDLE_CLICK: Double-tap → Max Zoom Out");
            this.state.middleClick.tapCount = 0;
            this.state.middleClick.windowTimer = null;
            if (this.specialKeyCallback) {
                this.specialKeyCallback({
                    type: "direct_output",
                    keys: ["CTRL+B"],
                    source: "middle_click_zoom_out",
                });
            }
            return;
        }
        // Schedule single-tap (quick) after window expires
        const isToggled = this.state.toggleActive;
        this.state.middleClick.windowTimer = setTimeout(() => {
            if (this.isStopped)
                return;
            // Window expired with single tap - fire quick gesture
            if (this.state.middleClick.tapCount === 1) {
                this.state.middleClick.tapCount = 0;
                this.fireQuickGesture("MIDDLE_CLICK", holdDuration, isToggled);
            }
            this.state.middleClick.windowTimer = null;
        }, MIDDLE_CLICK_MULTIPRESS_WINDOW);
    }
    // ==========================================================================
    // = KEY - GAP-BASED DOUBLE-TAP + LONG HOLD R STREAMING
    // ==========================================================================
    // Double-tap: Smash (gap-based detection)
    // Hold ≥540ms: Trigger shared R stream (same as D key)
    // ==========================================================================
    /**
     * Handle = key down
     */
    handleEqualsKeyDown() {
        const now = performance.now();
        // Check if within multi-press window (for double-tap detection)
        if (this.state.equalsKey.tapCount > 0 &&
            now - this.state.equalsKey.lastTapTime < EQUALS_MULTIPRESS_WINDOW) {
            // Cancel pending timer
            if (this.state.equalsKey.windowTimer) {
                clearTimeout(this.state.equalsKey.windowTimer);
                this.state.equalsKey.windowTimer = null;
            }
        }
        this.state.activeKeyDowns.set("=", {
            startTime: now,
            longFired: false,
        });
        // Track for R streaming threshold check
        this.state.equalsRStream.holdStartTime = now;
        this.state.equalsRStream.triggeredRStream = false;
        // Clear any existing check timer
        if (this.state.equalsRStream.checkTimer) {
            clearTimeout(this.state.equalsRStream.checkTimer);
        }
        // Schedule check for R streaming threshold (540ms)
        this.state.equalsRStream.checkTimer = setTimeout(() => {
            if (this.isStopped)
                return;
            // Only trigger if = is still held and we haven't already triggered
            if (this.state.activeKeyDowns.has("=") &&
                !this.state.equalsRStream.triggeredRStream) {
                console.log("🟣 = key: Held ≥540ms → Starting R stream");
                this.state.equalsRStream.triggeredRStream = true;
                // Clear tap count (this is a hold, not a tap)
                this.state.equalsKey.tapCount = 0;
                if (this.state.equalsKey.windowTimer) {
                    clearTimeout(this.state.equalsKey.windowTimer);
                    this.state.equalsKey.windowTimer = null;
                }
                // Start shared R stream (will no-op if already running from D)
                this.startSharedRStream("=");
            }
        }, EQUALS_R_STREAM_THRESHOLD_MS);
    }
    /**
     * Handle = key up
     */
    handleEqualsKeyUp() {
        const keyState = this.state.activeKeyDowns.get("=");
        if (!keyState)
            return;
        const now = performance.now();
        const holdDuration = now - keyState.startTime;
        this.state.activeKeyDowns.delete("=");
        // Clear R stream check timer
        if (this.state.equalsRStream.checkTimer) {
            clearTimeout(this.state.equalsRStream.checkTimer);
            this.state.equalsRStream.checkTimer = null;
        }
        // If this = hold triggered R streaming, handle stream stop
        if (this.state.equalsRStream.triggeredRStream) {
            this.state.equalsRStream.triggeredRStream = false;
            this.state.equalsRStream.holdStartTime = null;
            // Stop stream only if D is also not holding it
            this.stopSharedRStreamIfNeeded();
            return; // Don't process as tap
        }
        // Reset R stream state
        this.state.equalsRStream.holdStartTime = null;
        // If held long enough that it would have triggered R stream, don't count as tap
        if (holdDuration >= EQUALS_R_STREAM_THRESHOLD_MS) {
            return;
        }
        // Increment tap count (this was a quick release, not a long hold)
        this.state.equalsKey.tapCount++;
        this.state.equalsKey.lastTapTime = now;
        // Clear existing timer
        if (this.state.equalsKey.windowTimer) {
            clearTimeout(this.state.equalsKey.windowTimer);
        }
        // Check for double-tap immediately
        if (this.state.equalsKey.tapCount >= 2) {
            // Double-tap: Smash → ]
            console.log("🟣 = key: Double-tap → Smash");
            this.state.equalsKey.tapCount = 0;
            this.state.equalsKey.windowTimer = null;
            // Emit special gesture event for Smash sequence
            this.emitGesture({
                inputKey: "=",
                gesture: "quick", // Map to quick for binding lookup
                timestamp: now,
                wasToggled: false,
            });
            return;
        }
        // Schedule window expiration (single tap = no action)
        this.state.equalsKey.windowTimer = setTimeout(() => {
            if (this.isStopped)
                return;
            // Single tap - no output for = key
            this.state.equalsKey.tapCount = 0;
            this.state.equalsKey.windowTimer = null;
        }, EQUALS_MULTIPRESS_WINDOW);
    }
    // ==========================================================================
    // F2 KEY - INDEPENDENT TOGGLE MODIFIER
    // ==========================================================================
    // F2 is held to activate a separate gesture space (quick_f2, long_f2, etc.)
    // While F2 is held, all other inputs use _f2 gesture variants
    // W and Y can emit quick_f2_toggle when quick-tapped during F2 hold
    // After 255ms, F2 overrides W/Y toggle (deactivates it)
    // ==========================================================================
    /** F2 override threshold: holding F2 >255ms deactivates W/Y toggle */
    f2OverrideTimer = null;
    /**
     * Handle F2 key down - activate F2 toggle mode
     * After 255ms, overrides W/Y toggle if active
     */
    handleF2KeyDown() {
        const now = performance.now();
        // Activate F2 toggle mode immediately on press
        this.state.f2Toggle.active = true;
        this.state.f2Toggle.startTime = now;
        this.state.activeKeyDowns.set("F2", {
            startTime: now,
            longFired: false,
        });
        // Schedule F2 override of W/Y toggle after 255ms
        if (this.f2OverrideTimer) {
            clearTimeout(this.f2OverrideTimer);
        }
        this.f2OverrideTimer = setTimeout(() => {
            if (this.isStopped)
                return;
            // If F2 is still held and W/Y toggle is active, override it
            if (this.state.f2Toggle.active && this.state.toggleActive) {
                console.log("🔵 F2 held >255ms → overriding W/Y toggle");
                this.deactivateToggle();
            }
            this.f2OverrideTimer = null;
        }, 255);
        console.log("🔵 F2 Toggle ACTIVATED");
    }
    /**
     * Handle F2 key up - deactivate F2 toggle mode
     */
    handleF2KeyUp() {
        const keyState = this.state.activeKeyDowns.get("F2");
        if (!keyState)
            return;
        const now = performance.now();
        const holdDuration = now - keyState.startTime;
        this.state.activeKeyDowns.delete("F2");
        // Clear F2 override timer
        if (this.f2OverrideTimer) {
            clearTimeout(this.f2OverrideTimer);
            this.f2OverrideTimer = null;
        }
        // Deactivate F2 toggle mode (but NOT if key 7 is holding it active)
        if (this.state.f2Toggle.active && !this.state.key7.activatedF2Toggle) {
            console.log(`🔵 F2 Toggle DEACTIVATED (held ${Math.round(holdDuration)}ms)`);
            this.state.f2Toggle.active = false;
            this.state.f2Toggle.startTime = null;
        }
    }
    /**
     * Check if F2 toggle is currently active
     */
    isF2ToggleActive() {
        return this.state.f2Toggle.active;
    }
    // ==========================================================================
    // KEY 7 → F2 TOGGLE ACTIVATION
    // ==========================================================================
    /**
     * Handle key 7 down - schedule F2 toggle activation after 500ms hold
     * Key 7 is an output key (e.g., from cog icon), so synthetic presses
     * will be ~40ms and never hit the 500ms threshold.
     */
    handleKey7Down() {
        const now = performance.now();
        // If 7 already tracked (key repeat), ignore
        if (this.state.activeKeyDowns.has("7")) {
            return;
        }
        this.state.activeKeyDowns.set("7", {
            startTime: now,
            longFired: false,
        });
        // Update key 7 combo state
        this.key7ComboState.isDown = true;
        this.key7ComboState.downTime = Date.now();
        this.key7ComboState.upTime = null;
        // Reset state
        this.state.key7.activatedF2Toggle = false;
        // Clear any existing check timer
        if (this.state.key7.checkTimer) {
            clearTimeout(this.state.key7.checkTimer);
        }
        // Schedule check for F2 toggle activation (500ms)
        this.state.key7.checkTimer = setTimeout(() => {
            if (this.isStopped)
                return;
            // Only trigger if 7 is still held
            if (this.state.activeKeyDowns.has("7") &&
                !this.state.key7.activatedF2Toggle) {
                // Don't activate if F2 toggle is already active (from actual F2 key)
                if (this.state.f2Toggle.active) {
                    console.log("🔢 Key 7: Held ≥500ms but F2 toggle already active, skipping");
                    return;
                }
                console.log("🔢 Key 7: Held ≥500ms → F2 Toggle ACTIVATED (via key 7)");
                this.state.key7.activatedF2Toggle = true;
                this.state.f2Toggle.active = true;
                this.state.f2Toggle.startTime = performance.now();
            }
        }, KEY_7_F2_TOGGLE_THRESHOLD_MS);
    }
    /**
     * Handle key 7 up - deactivate F2 toggle if key 7 activated it
     */
    handleKey7Up() {
        const keyState = this.state.activeKeyDowns.get("7");
        if (!keyState)
            return;
        const now = performance.now();
        const holdDuration = now - keyState.startTime;
        this.state.activeKeyDowns.delete("7");
        // Update key 7 combo state
        this.key7ComboState.isDown = false;
        this.key7ComboState.upTime = Date.now();
        // Clear check timer
        if (this.state.key7.checkTimer) {
            clearTimeout(this.state.key7.checkTimer);
            this.state.key7.checkTimer = null;
        }
        // If this key 7 hold activated F2 toggle, deactivate it
        if (this.state.key7.activatedF2Toggle) {
            console.log(`🔢 Key 7: F2 Toggle DEACTIVATED (held ${Math.round(holdDuration)}ms)`);
            this.state.f2Toggle.active = false;
            this.state.f2Toggle.startTime = null;
            this.state.key7.activatedF2Toggle = false;
        }
    }
    // ==========================================================================
    // 4+7 COMBO DETECTION
    // ==========================================================================
    /**
     * Check for 4+7 combo: key 4 down during key 7 hold or within 420ms of key 7 release
     * @returns true if combo detected and fired, false otherwise
     */
    check4And7Combo() {
        const now = Date.now();
        const COMBO_WINDOW_MS = 420;
        // Check if key 7 is currently held
        if (this.key7ComboState.isDown) {
            console.log("🎯 4+7 COMBO: Detected (4 pressed during 7 hold)");
            this.fireCombo7And4();
            return true;
        }
        // Check if key 7 was released within the combo window
        if (this.key7ComboState.upTime !== null &&
            now - this.key7ComboState.upTime <= COMBO_WINDOW_MS) {
            const timeSinceRelease = now - this.key7ComboState.upTime;
            console.log(`🎯 4+7 COMBO: Detected (4 pressed ${timeSinceRelease}ms after 7 release)`);
            this.fireCombo7And4();
            return true;
        }
        return false;
    }
    /**
     * Fire the 4+7 combo gesture
     */
    fireCombo7And4() {
        this.gestureCallback({
            inputKey: "4",
            gesture: "combo_7_4",
            timestamp: Date.now(),
            wasToggled: false, // Combo is independent of toggle state
        });
    }
    // ==========================================================================
    // W/Y TOGGLE ACTIVATORS - IMMEDIATE ACTIVATION ON KEYDOWN
    // ==========================================================================
    // Toggle activates immediately on keydown
    // Quick release (before threshold) → fires targeting gesture + deactivates toggle
    // Long hold (past threshold) → deactivates toggle on release (no targeting gesture)
    // ==========================================================================
    /**
     * Check if a toggle key has been held long enough to mark as "long hold"
     * Toggle is already active from keydown - this just determines quick vs long behavior
     */
    checkToggleActivation(now) {
        // Check W and Y for threshold crossing (marks as longFired)
        for (const toggleKey of TOGGLE_KEYS) {
            const keyState = this.state.activeKeyDowns.get(toggleKey);
            if (!keyState)
                continue;
            // Skip if already marked as long
            if (keyState.longFired)
                continue;
            const holdDuration = now - keyState.startTime;
            const threshold = getKeyThreshold(toggleKey, false);
            if (holdDuration >= threshold) {
                // Mark as long hold - no targeting gesture on release
                keyState.longFired = true;
            }
        }
    }
    /**
     * Activate toggle mode
     */
    activateToggle(activator, startTime) {
        if (this.state.toggleActive)
            return;
        this.state.toggleActive = true;
        this.state.toggleActivator = activator;
        this.state.toggleStartTime = startTime;
        console.log(`🔀 Toggle ACTIVATED by ${activator}`);
    }
    /**
     * Deactivate toggle mode
     */
    deactivateToggle() {
        if (!this.state.toggleActive)
            return;
        console.log(`🔀 Toggle DEACTIVATED (was ${this.state.toggleActivator})`);
        this.state.toggleActive = false;
        this.state.toggleActivator = null;
        this.state.toggleStartTime = null;
    }
    // ==========================================================================
    // Q TOGGLE SYSTEM (independent of W/Y toggle)
    // ==========================================================================
    /**
     * Check if Q key has been held long enough to activate Q toggle mode
     */
    checkQToggleActivation(now) {
        // If Q toggle already active, nothing to do
        if (this.state.qToggle.active)
            return;
        const keyState = this.state.activeKeyDowns.get("Q");
        if (!keyState)
            return;
        if (keyState.longFired)
            return;
        const holdDuration = now - keyState.startTime;
        const threshold = getKeyThreshold("Q", false);
        if (holdDuration >= threshold) {
            // Activate Q toggle mode
            this.state.qToggle.active = true;
            this.state.qToggle.startTime = keyState.startTime;
            keyState.longFired = true; // Prevent quick gesture on release
            console.log(`🟣 Q Toggle ACTIVATED (held ${Math.round(holdDuration)}ms)`);
        }
    }
    /**
     * Handle Q key up - deactivate Q toggle and optionally fire quick
     */
    handleQKeyUp() {
        const keyState = this.state.activeKeyDowns.get("Q");
        if (!keyState)
            return;
        const now = performance.now();
        const holdDuration = now - keyState.startTime;
        this.state.activeKeyDowns.delete("Q");
        // If Q toggle was active, deactivate it
        if (this.state.qToggle.active) {
            console.log(`🟣 Q Toggle DEACTIVATED (held ${Math.round(holdDuration)}ms)`);
            this.state.qToggle.active = false;
            this.state.qToggle.startTime = null;
            return; // No quick gesture - it was a toggle hold
        }
        // Quick gesture fallback (released before threshold)
        if (holdDuration < this.config.cancelThreshold) {
            // Q quick uses W/Y toggle state like other keys
            const isToggled = this.state.toggleActive;
            const gesture = this.determineGestureType(false, isToggled);
            this.emitGesture({
                inputKey: "Q",
                gesture,
                timestamp: now,
                holdDuration,
                wasToggled: isToggled,
                toggleActivator: this.state.toggleActivator ?? undefined,
                wasF2Toggle: this.state.f2Toggle.active,
            });
        }
    }
    /**
     * Check if Q toggle is currently active
     */
    isQToggleActive() {
        return this.state.qToggle.active;
    }
    /**
     * Get effective Q toggle state for a key
     * Returns true if Q toggle is active and the key is not Q itself
     */
    getEffectiveQToggleState(key) {
        if (key === "Q")
            return false; // Q itself doesn't get Q toggled
        return this.state.qToggle.active;
    }
    /**
     * Get effective toggle state for a key
     * W or Y held past threshold activates toggle for all standard keys (1-6, etc.)
     * Toggle keys (W, Y themselves) are excluded
     * Q has its own toggle (Q toggle)
     * S key has its own toggle (group member)
     * F2 key has its own toggle (_f2 gestures)
     */
    getEffectiveToggleState(key) {
        // Toggle keys themselves don't get toggled (they ARE the togglers)
        if (isToggleKey(key)) {
            return false;
        }
        // Standard keys use the shared W/Y toggle state
        return this.state.toggleActive;
    }
    /**
     * Handle toggle key up (W or Y)
     */
    handleToggleKeyUp(key) {
        const keyState = this.state.activeKeyDowns.get(key);
        if (!keyState)
            return;
        const now = performance.now();
        const holdDuration = now - keyState.startTime;
        this.state.activeKeyDowns.delete(key);
        // Deactivate toggle when the activator key is released
        if (this.state.toggleActive && this.state.toggleActivator === key) {
            this.deactivateToggle();
        }
        // If long already fired (held past threshold), no targeting output
        if (keyState.longFired) {
            console.log(`⏳ ${key} held past threshold (${Math.round(holdDuration)}ms) - toggle only, no targeting output`);
            return;
        }
        // Quick gesture fallback (released before threshold)
        // Use toggled variant only if the OTHER toggle key activated the current toggle
        const otherToggleKey = key === "W" ? "Y" : "W";
        const wasOtherToggling = this.state.toggleActive && this.state.toggleActivator === otherToggleKey;
        // Use determineGestureType to handle F2 toggle state
        const gesture = this.determineGestureType(false, wasOtherToggling);
        this.emitGesture({
            inputKey: key,
            gesture,
            timestamp: now,
            holdDuration,
            wasToggled: wasOtherToggling,
            toggleActivator: wasOtherToggling ? otherToggleKey : undefined,
            wasF2Toggle: this.state.f2Toggle.active,
        });
    }
    // ==========================================================================
    // GESTURE EMISSION
    // ==========================================================================
    /**
     * Determine the correct gesture type based on quick/long + toggle states
     * Priority: Q toggle > F2 toggle > W/Y toggle > base
     * Q toggle uses quick_q_toggle / long_q_toggle
     * F2 toggle takes precedence and adds _f2 suffix
     */
    determineGestureType(isLong, isToggled, isQToggled = false) {
        // Q toggle has its own gesture types (independent of F2 and W/Y)
        if (isQToggled) {
            return isLong ? "long_q_toggle" : "quick_q_toggle";
        }
        const f2Active = this.state.f2Toggle.active;
        if (f2Active) {
            // F2 toggle active - use _f2 variants
            if (isToggled) {
                return isLong ? "long_toggle_f2" : "quick_toggle_f2";
            }
            else {
                return isLong ? "long_f2" : "quick_f2";
            }
        }
        else {
            // Normal mode
            if (isToggled) {
                return isLong ? "long_toggle" : "quick_toggle";
            }
            else {
                return isLong ? "long" : "quick";
            }
        }
    }
    /**
     * Fire a long gesture (called when threshold is crossed, BEFORE keyUp)
     */
    fireLongGesture(key, holdDuration, isToggled) {
        const keyState = this.state.activeKeyDowns.get(key);
        if (!keyState || keyState.longFired)
            return;
        // Mark as fired to prevent duplicate emissions
        keyState.longFired = true;
        const isQToggled = this.getEffectiveQToggleState(key);
        const gesture = this.determineGestureType(true, isToggled, isQToggled);
        this.emitGesture({
            inputKey: key,
            gesture,
            timestamp: performance.now(),
            holdDuration,
            wasToggled: isToggled,
            toggleActivator: this.state.toggleActivator ?? undefined,
            wasF2Toggle: this.state.f2Toggle.active,
        });
    }
    /**
     * Fire a quick gesture (called on keyUp if threshold wasn't crossed)
     */
    fireQuickGesture(key, holdDuration, isToggled) {
        const isQToggled = this.getEffectiveQToggleState(key);
        const gesture = this.determineGestureType(false, isToggled, isQToggled);
        this.emitGesture({
            inputKey: key,
            gesture,
            timestamp: performance.now(),
            holdDuration,
            wasToggled: isToggled,
            toggleActivator: this.state.toggleActivator ?? undefined,
            wasF2Toggle: this.state.f2Toggle.active,
        });
    }
    /**
     * Emit a gesture event to all listeners
     */
    emitGesture(event) {
        if (this.isStopped)
            return;
        queueMicrotask(() => {
            if (this.isStopped)
                return;
            try {
                this.gestureCallback(event);
            }
            catch {
                // Swallow callback errors
            }
            for (const listener of this.listeners) {
                try {
                    listener(event);
                }
                catch {
                    // Swallow listener errors
                }
            }
        });
    }
    // ==========================================================================
    // KEY EVENT HANDLING
    // ==========================================================================
    handleKeyDown(key) {
        this.queueEvent("down", key);
    }
    handleKeyUp(key) {
        this.queueEvent("up", key);
    }
    handleMouseDown(button) {
        if (button === "MIDDLE_CLICK") {
            this.queueEvent("down", button);
        }
    }
    handleMouseUp(button) {
        if (button === "MIDDLE_CLICK") {
            this.queueEvent("up", button);
        }
    }
    queueEvent(type, key) {
        if (this.isStopped)
            return;
        if (this.eventQueue.length >= 100) {
            console.error("❌ Event queue overflow, dropping event");
            return;
        }
        const event = { type, key, timestamp: Date.now() };
        if (!this.processingQueue) {
            this.processEvent(event);
        }
        else {
            this.eventQueue.push(event);
        }
    }
    processEvent(event) {
        this.processingQueue = true;
        try {
            const upperKey = event.key.toUpperCase();
            // Check if key is suppressed (synthetic keypress from robotjs)
            if (this.suppressedKeys.has(upperKey)) {
                console.log(`[Suppress] Ignoring synthetic "${upperKey}" ${event.type}`);
                return;
            }
            // ========== CONFIG MODE HANDLING (highest priority) ==========
            // Config mode intercepts group member SWTOR keys ([, ], ,, ') and slot keys (1-4)
            if (this.state.groupMemberConfig.configModeActive &&
                event.type === "down") {
                // Check for SWTOR group member keys (from clicking ops frame)
                if (this.handleConfigModeSwotorKey(event.key)) {
                    return; // Consumed by config mode
                }
                // Check for slot assignment keys (1-4)
                if (this.handleConfigModeSlotKey(upperKey)) {
                    return; // Consumed by config mode
                }
            }
            // Handle D-only input keys (E, F, G, ;) - movement keys
            // These are passed through to SWTOR during D hold, not consumed
            if (D_ONLY_INPUT_KEYS.has(upperKey)) {
                // D-only keys don't need gesture processing
                // They just go directly to the game for movement
                return;
            }
            // Validate key is one we track
            if (!INPUT_KEYS.includes(upperKey)) {
                return;
            }
            const inputKey = upperKey;
            if (event.type === "down") {
                this.processKeyDown(inputKey);
                this.maybeStartCheckInterval(); // Start interval on first keypress
            }
            else {
                this.processKeyUp(inputKey);
                this.maybeStopCheckInterval(); // Stop interval when all keys released
            }
            // Process queued events
            while (this.eventQueue.length > 0) {
                const nextEvent = this.eventQueue.shift();
                const nextKey = nextEvent.key.toUpperCase();
                // Config mode for queued events
                if (this.state.groupMemberConfig.configModeActive &&
                    nextEvent.type === "down") {
                    if (this.handleConfigModeSwotorKey(nextEvent.key)) {
                        continue;
                    }
                    if (this.handleConfigModeSlotKey(nextKey)) {
                        continue;
                    }
                }
                // Handle D-only keys - skip gesture processing
                if (D_ONLY_INPUT_KEYS.has(nextKey)) {
                    continue;
                }
                if (!INPUT_KEYS.includes(nextKey))
                    continue;
                const nextInputKey = nextKey;
                if (nextEvent.type === "down") {
                    this.processKeyDown(nextInputKey);
                    this.maybeStartCheckInterval();
                }
                else {
                    this.processKeyUp(nextInputKey);
                    this.maybeStopCheckInterval();
                }
            }
        }
        finally {
            this.processingQueue = false;
        }
    }
    processKeyDown(key) {
        const now = performance.now();
        // Ignore key repeat (key already held)
        if (this.state.activeKeyDowns.has(key)) {
            return;
        }
        // STATE MACHINE PRIORITY ORDER:
        // 1. S group member intercept > 2. Normal processing
        // (D key no longer blocks - it's time-based, not trigger-based)
        // Check for S intercept during group member toggle
        if (this.handleSInterceptKey(key)) {
            return; // Intercepted, don't process further
        }
        // Special key handling
        switch (key) {
            case "D":
                this.handleDKeyDown();
                return;
            case "S":
                this.handleSKeyDown();
                return;
            case "C":
                this.handleCKeyDown();
                return;
            case "MIDDLE_CLICK":
                this.handleMiddleClickDown();
                return;
            case "=":
                this.handleEqualsKeyDown();
                return;
            case "F2":
                this.handleF2KeyDown();
                return;
            case "7":
                this.handleKey7Down();
                return;
            case "4":
                // Check for 4+7 combo detection
                if (this.check4And7Combo()) {
                    return; // Combo detected, don't process standard key down
                }
                break;
            case "W":
            case "Y": {
                // If the OTHER toggle key is already the active toggle activator,
                // this key should be treated as a standard key under that toggle
                // (e.g., Y quick during W toggle = quick_toggle for Y targeting)
                const otherToggle = key === "W" ? "Y" : "W";
                if (this.state.toggleActive &&
                    this.state.toggleActivator === otherToggle) {
                    // Don't overwrite toggle — this key is a standard press under the other's toggle
                    break;
                }
                // Activate toggle for this key
                this.activateToggle(key, now);
                break;
            }
            case "Q":
                // Q toggle key has standard key down (processed by checkQToggleActivation)
                break;
        }
        // Standard key down
        this.state.activeKeyDowns.set(key, {
            startTime: now,
            longFired: false,
        });
        // OPTIMIZATION: Fire quick immediately if no long binding exists for current state
        // This makes keys without longs feel more responsive
        // EXCEPTION: Toggle keys (W, Y, Q) must NEVER use instant-quick since they need to be
        // held past threshold to activate toggle mode for other keys
        if (isToggleKey(key) || key === "Q") {
            // Toggle keys skip instant-quick optimization - they need full hold processing
        }
        else {
            const isToggled = this.getEffectiveToggleState(key);
            const isF2 = this.state.f2Toggle.active;
            if (this.existingBindings.size > 0 &&
                !this.hasLongBinding(key, isToggled, isF2)) {
                // No long binding exists - fire quick immediately on keydown
                this.fireQuickGesture(key, 0, isToggled);
                // Mark as fired to prevent double-firing on keyup
                const keyState = this.state.activeKeyDowns.get(key);
                if (keyState) {
                    keyState.longFired = true; // Reuse this flag to prevent keyup processing
                }
                return;
            }
        }
        // Cancel any pending quick timer for this key
        const pendingTimer = this.pendingQuickTimers.get(key);
        if (pendingTimer) {
            clearTimeout(pendingTimer);
            this.pendingQuickTimers.delete(key);
        }
    }
    processKeyUp(key) {
        // Special key handling
        switch (key) {
            case "D":
                this.handleDKeyUp();
                return;
            case "S":
                this.handleSKeyUp();
                return;
            case "C":
                this.handleCKeyUp();
                return;
            case "MIDDLE_CLICK":
                this.handleMiddleClickUp();
                return;
            case "=":
                this.handleEqualsKeyUp();
                return;
            case "F2":
                this.handleF2KeyUp();
                return;
            case "7":
                this.handleKey7Up();
                return;
            case "W":
            case "Y":
                this.handleToggleKeyUp(key);
                return;
            case "Q":
                this.handleQKeyUp();
                return;
        }
        // Standard key up processing
        const keyState = this.state.activeKeyDowns.get(key);
        if (!keyState)
            return;
        const now = performance.now();
        const holdDuration = now - keyState.startTime;
        this.state.activeKeyDowns.delete(key);
        // Check if toggle activator releasing
        if (this.state.toggleActive &&
            isToggleKey(key) &&
            this.state.toggleActivator === key) {
            this.deactivateToggle();
        }
        // Determine toggle state for this key
        // Any key uses toggle state if W or Y was held past threshold
        const wasToggled = this.getEffectiveToggleState(key);
        // If long already fired, nothing more to do
        if (keyState.longFired) {
            return;
        }
        // Check cancel threshold
        if (holdDuration >= this.config.cancelThreshold) {
            console.log(`⛔ ${key} cancelled (held ${Math.round(holdDuration)}ms)`);
            return;
        }
        // Fire quick gesture
        this.fireQuickGesture(key, holdDuration, wasToggled);
    }
    // ==========================================================================
    // IGestureDetector INTERFACE IMPLEMENTATION
    // ==========================================================================
    reset() {
        this.state = createExtendedOmegaState();
        for (const timer of this.pendingQuickTimers.values()) {
            clearTimeout(timer);
        }
        this.pendingQuickTimers.clear();
        this.eventQueue.length = 0;
    }
    updateSettings(settings) {
        this.globalSettings = settings;
        if (settings.multiPressWindow) {
            this.config.multiPressWindow = settings.multiPressWindow;
        }
        this.startCheckInterval();
    }
    updateKeyProfile(key, settings) {
        this.keySpecificSettings.set(key, settings);
        console.log(`✅ Updated ${key} profile (Omega)`);
    }
    clearKeyProfile(key) {
        this.keySpecificSettings.delete(key);
        console.log(`🔄 Cleared ${key} profile (Omega)`);
    }
    getKeyProfile(key) {
        return this.keySpecificSettings.get(key) ?? this.globalSettings;
    }
    getAllProfiles() {
        const profiles = {};
        for (const key of INPUT_KEYS) {
            profiles[key] = this.keySpecificSettings.get(key) ?? this.globalSettings;
        }
        return profiles;
    }
    getCustomizedKeys() {
        return Array.from(this.keySpecificSettings.keys());
    }
    loadKeyProfiles(profiles) {
        for (const [key, settings] of Object.entries(profiles)) {
            this.keySpecificSettings.set(key, settings);
        }
        console.log(`🎯 Loaded ${Object.keys(profiles).length} key profiles (Omega)`);
    }
    getGlobalSettings() {
        return { ...this.globalSettings };
    }
    destroy() {
        this.isStopped = true;
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        for (const timer of this.pendingQuickTimers.values()) {
            clearTimeout(timer);
        }
        this.pendingQuickTimers.clear();
        // Clear special key timers
        if (this.state.cKey.windowTimer) {
            clearTimeout(this.state.cKey.windowTimer);
        }
        if (this.state.equalsKey.windowTimer) {
            clearTimeout(this.state.equalsKey.windowTimer);
        }
        if (this.state.f2Key.windowTimer) {
            clearTimeout(this.state.f2Key.windowTimer);
        }
        this.eventQueue.length = 0;
        this.listeners.clear();
        this.state = createExtendedOmegaState();
        console.log("🛑 Omega Gesture Detector destroyed");
    }
    // ==========================================================================
    // ADDITIONAL METHODS
    // ==========================================================================
    onGesture(cb) {
        this.listeners.add(cb);
    }
    offGesture(cb) {
        this.listeners.delete(cb);
    }
    getToggleState() {
        return {
            active: this.state.toggleActive,
            activator: this.state.toggleActivator,
        };
    }
    getActiveKeys() {
        return Array.from(this.state.activeKeyDowns.keys());
    }
    isKeyHeld(key) {
        return this.state.activeKeyDowns.has(key);
    }
    getKeyHoldDuration(key) {
        const keyState = this.state.activeKeyDowns.get(key);
        if (!keyState)
            return null;
        return performance.now() - keyState.startTime;
    }
    /**
     * Get D key stream state
     */
    getDKeyState() {
        return {
            active: this.state.dKey.active,
            rCount: this.state.dKey.rCount,
        };
    }
    /**
     * Get S key group member toggle state
     */
    getSKeyToggleState() {
        return this.state.sKey.active;
    }
    setGroupMemberToggle(active) {
        this.state.groupMemberToggleActive = active;
    }
    getGroupMemberToggle() {
        return this.state.groupMemberToggleActive;
    }
}
// ============================================================================
// FACTORY FUNCTION
// ============================================================================
export function createOmegaGestureDetector(settings, gestureCallback, config, specialKeyCallback) {
    return new OmegaGestureDetector(settings, gestureCallback, config, specialKeyCallback);
}
//# sourceMappingURL=omegaGestureDetector.js.map