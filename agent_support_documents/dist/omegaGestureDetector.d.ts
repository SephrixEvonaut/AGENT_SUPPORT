import { InputKey, GestureSettings } from "./types.js";
import { OmegaGestureCallback, OmegaConfig, IGestureDetector } from "./omegaTypes.js";
/**
 * Special output event for direct key emission (bypasses gesture system)
 */
export interface SpecialKeyOutputEvent {
    type: "direct_output";
    keys: string[];
    timings?: {
        keyDownMs: [number, number];
        gapMs?: [number, number];
    };
    ttsMessage?: string;
    source: "d_stream" | "d_release" | "d_toggle_tts" | "s_group_member" | "s_target_of_target" | "s_guard_bypass" | "c_escape" | "equals_smash" | "middle_click_zoom_out";
}
export type SpecialKeyCallback = (event: SpecialKeyOutputEvent) => void;
export declare class OmegaGestureDetector implements IGestureDetector {
    private state;
    private config;
    private globalSettings;
    private keySpecificSettings;
    private gestureCallback;
    private specialKeyCallback;
    private listeners;
    private isTTSSpeakingCallback;
    private checkInterval;
    private pendingQuickTimers;
    private eventQueue;
    private processingQueue;
    private suppressedKeys;
    private suppressionTimers;
    private key7ComboState;
    private existingBindings;
    private isStopped;
    private dStreamIntervalMs;
    private dKeyMode;
    private static readonly BURST_INTRA_GAP_MIN;
    private static readonly BURST_INTRA_GAP_MAX;
    private static readonly BURST_COUNT;
    private static readonly BURST_SLOW_CYCLE_MIN;
    private static readonly BURST_SLOW_CYCLE_MAX;
    private static readonly BURST_FAST_CYCLE_MIN;
    private static readonly BURST_FAST_CYCLE_MAX;
    private dKeyOutputKey;
    constructor(settings: GestureSettings, gestureCallback: OmegaGestureCallback, config?: Partial<OmegaConfig>, specialKeyCallback?: SpecialKeyCallback);
    /**
     * Set callback for special key outputs (D retaliate, S group member, etc.)
     */
    setSpecialKeyCallback(callback: SpecialKeyCallback): void;
    /**
     * Set callback to check if TTS is currently speaking
     * Used to ignore D presses during TTS announcements
     */
    setTTSSpeakingCallback(callback: () => boolean): void;
    /**
     * Set the D key R stream interval (ms between repeated R presses while D is held).
     * Default: 380ms (software mode, reduces queue pressure)
     * Teensy mode: 200ms (faster Retaliate procs, no queue contention)
     */
    setDStreamInterval(intervalMs: number): void;
    /**
     * Set the D key behavior mode for the active profile
     * - continuous_stream: Toggle on/off R stream (Tank)
     * - burst_stream_slow: Toggle burst cycle (3 Rs, 5.6-6.8s between) (Rage)
     * - burst_stream_fast: Toggle burst cycle (3 Rs, 3.6-4.2s between) (Mercs)
     * - single_press: Fire one R per D press (Sorcs, Engineering)
     */
    setDKeyMode(mode: "continuous_stream" | "burst_stream_slow" | "burst_stream_fast" | "single_press"): void;
    /**
     * Set the output key for D key single_press and burst modes.
     * Continuous stream always emits "R" (Tank).
     */
    setDKeyOutput(key: string): void;
    /**
     * Get the DPS target key for a given DPS slot (1 or 2)
     * Returns the group member target key mapped to the designated DPS slot,
     * or null if that DPS slot hasn't been designated.
     */
    getDPSTargetKey(dpsSlot: 1 | 2): string | null;
    /**
     * Set the list of existing bindings for "fire quick immediately if no long" optimization
     * @param bindings - Array of binding objects with inputKey and gesture properties
     */
    setExistingBindings(bindings: Array<{
        inputKey: string;
        gesture: string;
    }>): void;
    /**
     * Check if a long binding exists for this key in the given state
     */
    private hasLongBinding;
    /**
     * Suppress a key temporarily (prevents robotjs synthetic keys from being re-detected)
     * @param key - The key to suppress (e.g., "B")
     * @param durationMs - How long to suppress (default 150ms)
     */
    suppressKey(key: string, durationMs?: number): void;
    private startCheckInterval;
    /**
     * Stop the check interval when no keys are held (performance optimization)
     */
    private stopCheckInterval;
    /**
     * Start interval only when keys are being held (on-demand optimization)
     * This saves ~10% CPU when idle
     */
    private maybeStartCheckInterval;
    /**
     * Stop interval when all keys released (on-demand optimization)
     */
    private maybeStopCheckInterval;
    /**
     * Check all active key holds for threshold crossing
     */
    private checkAllThresholds;
    /**
     * Get effective threshold for a key, accounting for special cases
     */
    private getEffectiveThreshold;
    /**
     * Check if R stream is currently active (from either D or =)
     */
    private isRStreamActive;
    /**
     * Start the shared R stream (called by D, =, or F2)
     * Only starts if not already running
     */
    private startSharedRStream;
    /**
     * Stop the shared R stream (only if ALL sources are no longer streaming)
     * D toggle mode: only stops if D toggle is off AND = and F2 are not streaming
     */
    private stopSharedRStreamIfNeeded;
    /**
     * Handle D key down - dispatches to mode-specific handler
     */
    private handleDKeyDown;
    /**
     * D key continuous stream (Tank) - toggle R stream on/off
     * First press: starts R stream + TTS "on on on"
     * Second press: stops R stream + TTS "off off off"
     */
    private handleDKeyToggleContinuous;
    /**
     * D key burst stream (Rage = slow, Mercs = fast) - toggle burst cycle on/off
     * Toggle ON: fires burst of 3 Rs (100-127ms gaps), then waits cycle delay, repeats
     * Toggle OFF: stops burst cycle
     */
    private handleDKeyToggleBurst;
    /**
     * D key single press (Sorcs, Engineering) - fire one R per D press
     */
    private handleDKeySinglePress;
    /**
     * Start burst R stream cycle: fires 3 Rs with 100-127ms gaps,
     * then waits cycle delay before repeating
     */
    private startBurstRStream;
    /**
     * Send a single R in the stream
     */
    private sendStreamR;
    /**
     * Stop the D key R stream immediately
     */
    private stopDStream;
    /**
     * Handle D key up - in toggle mode, just remove from active keys
     */
    private handleDKeyUp;
    /**
     * Cancel D stream if = is pressed (works for both hold and toggle modes)
     */
    private cancelDPersistenceIfActive;
    /**
     * Handle S key down
     */
    private handleSKeyDown;
    /**
     * Check S key for group member toggle activation
     */
    private checkSKeyToggleActivation;
    /**
     * Handle S key up
     */
    private handleSKeyUp;
    /**
     * Handle key during S group member toggle - intercept 1/2/3/4
     * Uses dynamic mappings from groupMemberConfig
     */
    private handleSInterceptKey;
    /**
     * Toggle group member config mode on/off
     * Called when user wants to reconfigure group member mappings at match start
     */
    toggleConfigMode(): void;
    /**
     * Reset group member mappings to defaults
     */
    resetGroupMemberMappings(): void;
    /**
     * Load group member mappings from profile data
     * Profile format: { "1": ["F10", "CTRL+V"], "2": ["F11", "CTRL+V"], ... }
     */
    loadGroupMemberMappings(mappings: Record<string, [string, string]>): void;
    /**
     * Exit config mode
     */
    private exitConfigMode;
    /**
     * Log current mappings
     */
    private logCurrentMappings;
    /**
     * Handle SWTOR group member key press during config mode
     * These are the raw keys from clicking ops frame members: [, ], ,, '
     */
    private handleConfigModeSwotorKey;
    /**
     * Handle slot assignment key (1-4) during config mode
     * After 4 slots: enters DPS designation phase
     */
    private handleConfigModeSlotKey;
    /**
     * Handle C key down
     */
    private handleCKeyDown;
    /**
     * Check C key for long-press threshold
     */
    private checkCKeyLongPress;
    /**
     * Handle C key up
     */
    private handleCKeyUp;
    /**
     * Handle MIDDLE_CLICK down
     */
    private handleMiddleClickDown;
    /**
     * Check MIDDLE_CLICK for long-press threshold
     */
    private checkMiddleClickLongPress;
    /**
     * Handle MIDDLE_CLICK up
     */
    private handleMiddleClickUp;
    /**
     * Handle = key down
     */
    private handleEqualsKeyDown;
    /**
     * Handle = key up
     */
    private handleEqualsKeyUp;
    /** F2 override threshold: holding F2 >255ms deactivates W/Y toggle */
    private f2OverrideTimer;
    /**
     * Handle F2 key down - activate F2 toggle mode
     * After 255ms, overrides W/Y toggle if active
     */
    private handleF2KeyDown;
    /**
     * Handle F2 key up - deactivate F2 toggle mode
     */
    private handleF2KeyUp;
    /**
     * Check if F2 toggle is currently active
     */
    isF2ToggleActive(): boolean;
    /**
     * Handle key 7 down - schedule F2 toggle activation after 500ms hold
     * Key 7 is an output key (e.g., from cog icon), so synthetic presses
     * will be ~40ms and never hit the 500ms threshold.
     */
    private handleKey7Down;
    /**
     * Handle key 7 up - deactivate F2 toggle if key 7 activated it
     */
    private handleKey7Up;
    /**
     * Check for 4+7 combo: key 4 down during key 7 hold or within 420ms of key 7 release
     * @returns true if combo detected and fired, false otherwise
     */
    private check4And7Combo;
    /**
     * Fire the 4+7 combo gesture
     */
    private fireCombo7And4;
    /**
     * Check if a toggle key has been held long enough to mark as "long hold"
     * Toggle is already active from keydown - this just determines quick vs long behavior
     */
    private checkToggleActivation;
    /**
     * Activate toggle mode
     */
    private activateToggle;
    /**
     * Deactivate toggle mode
     */
    private deactivateToggle;
    /**
     * Check if Q key has been held long enough to activate Q toggle mode
     */
    private checkQToggleActivation;
    /**
     * Handle Q key up - deactivate Q toggle and optionally fire quick
     */
    private handleQKeyUp;
    /**
     * Check if Q toggle is currently active
     */
    isQToggleActive(): boolean;
    /**
     * Get effective Q toggle state for a key
     * Returns true if Q toggle is active and the key is not Q itself
     */
    private getEffectiveQToggleState;
    /**
     * Get effective toggle state for a key
     * W or Y held past threshold activates toggle for all standard keys (1-6, etc.)
     * Toggle keys (W, Y themselves) are excluded
     * Q has its own toggle (Q toggle)
     * S key has its own toggle (group member)
     * F2 key has its own toggle (_f2 gestures)
     */
    private getEffectiveToggleState;
    /**
     * Handle toggle key up (W or Y)
     */
    private handleToggleKeyUp;
    /**
     * Determine the correct gesture type based on quick/long + toggle states
     * Priority: Q toggle > F2 toggle > W/Y toggle > base
     * Q toggle uses quick_q_toggle / long_q_toggle
     * F2 toggle takes precedence and adds _f2 suffix
     */
    private determineGestureType;
    /**
     * Fire a long gesture (called when threshold is crossed, BEFORE keyUp)
     */
    private fireLongGesture;
    /**
     * Fire a quick gesture (called on keyUp if threshold wasn't crossed)
     */
    private fireQuickGesture;
    /**
     * Emit a gesture event to all listeners
     */
    private emitGesture;
    handleKeyDown(key: string): void;
    handleKeyUp(key: string): void;
    handleMouseDown(button: string): void;
    handleMouseUp(button: string): void;
    private queueEvent;
    private processEvent;
    private processKeyDown;
    private processKeyUp;
    reset(): void;
    updateSettings(settings: GestureSettings): void;
    updateKeyProfile(key: InputKey, settings: GestureSettings): void;
    clearKeyProfile(key: InputKey): void;
    getKeyProfile(key: InputKey): GestureSettings | null;
    getAllProfiles(): Record<string, GestureSettings>;
    getCustomizedKeys(): InputKey[];
    loadKeyProfiles(profiles: Record<string, GestureSettings>): void;
    getGlobalSettings(): GestureSettings;
    destroy(): void;
    onGesture(cb: OmegaGestureCallback): void;
    offGesture(cb: OmegaGestureCallback): void;
    getToggleState(): {
        active: boolean;
        activator: "W" | "Y" | null;
    };
    getActiveKeys(): InputKey[];
    isKeyHeld(key: InputKey): boolean;
    getKeyHoldDuration(key: InputKey): number | null;
    /**
     * Get D key stream state
     */
    getDKeyState(): {
        active: boolean;
        rCount: number;
    };
    /**
     * Get S key group member toggle state
     */
    getSKeyToggleState(): boolean;
    setGroupMemberToggle(active: boolean): void;
    getGroupMemberToggle(): boolean;
    /**
     * Programmatically stop R streaming if it's currently active.
     * Used by abilities that require R streaming to stop (e.g. ground-targeted AoEs).
     * Returns true if R streaming was active and was stopped.
     */
    stopRStreamIfActive(): boolean;
}
export declare function createOmegaGestureDetector(settings: GestureSettings, gestureCallback: OmegaGestureCallback, config?: Partial<OmegaConfig>, specialKeyCallback?: SpecialKeyCallback): OmegaGestureDetector;
//# sourceMappingURL=omegaGestureDetector.d.ts.map