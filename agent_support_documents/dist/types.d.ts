export declare const INPUT_KEYS: readonly ["W", "A", "S", "D", "B", "I", "Y", "U", "T", "C", "H", "P", "E", "F", "G", "F2", "SPACEBAR", "Q", "1", "2", "3", "4", "5", "6", "7", "8", "=", "MIDDLE_CLICK", ";", "F10", "F11", "F12", "INSERT"];
export type InputKey = (typeof INPUT_KEYS)[number];
export declare const OUTPUT_KEYS: readonly ["J", "K", "L", "M", "N", "O", "Q", "R", "V", "X", "Z", ",", ".", "'", ";", "]", "[", "F6", "F7", "F8", "F9", "NUMPAD0", "NUMPAD1", "NUMPAD2", "NUMPAD3", "NUMPAD4", "NUMPAD5", "NUMPAD6", "NUMPAD7", "NUMPAD8", "NUMPAD9", "NUMPAD_ADD", "NUMPAD_MULTIPLY", "NUMPAD_DECIMAL", "NUMPAD_SUBTRACT", "BACKSPACE", "END", "ESCAPE"];
export type OutputKey = (typeof OUTPUT_KEYS)[number];
export declare const GESTURE_TYPES: readonly ["single", "single_long", "single_super_long", "double", "double_long", "double_super_long", "triple", "triple_long", "triple_super_long", "quadruple", "quadruple_long", "quadruple_super_long"];
export type GestureType = (typeof GESTURE_TYPES)[number];
/**
 * Timer step configuration for TTS countdown timers.
 * Used by Omega system for ability cooldown tracking.
 */
export interface TimerConfig {
    /** Unique identifier for the timer (e.g., "drop", "burst", "laze") */
    id: string;
    /** Duration in seconds before TTS fires */
    durationSeconds: number;
    /** TTS message to speak when timer completes */
    message: string;
}
export interface SequenceStep {
    /** The key to press (e.g., "a", "b", "f1"). Optional if this is a timer-only step. */
    key?: string;
    /** Optional step name for display/debugging */
    name?: string;
    /** Minimum ms before next press (>= 25ms) */
    minDelay?: number;
    /** Maximum ms before next press (variance >= 4ms) */
    maxDelay?: number;
    /**
     * How long to hold the key down (inclusive range in ms).
     * Defaults to [23, 38] if omitted.
     * Uses weighted distribution: 37ms=10%, 29ms=10%, 23ms=10%, rest=70% uniform
     */
    keyDownDuration?: [number, number];
    /**
     * Buffer tier after this key press: determines inter-key randomized delay.
     * If omitted, falls back to using minDelay/maxDelay behavior.
     */
    bufferTier?: "low" | "medium" | "high";
    /**
     * Optional second key to press simultaneously (dual key press).
     * Must be a valid OutputKey.
     */
    dualKey?: OutputKey;
    /**
     * Delay in ms before pressing the second key (after primary key down).
     * Must be >= 1ms if provided. Defaults to 6ms.
     */
    dualKeyOffsetMs?: number;
    /**
     * How long to hold the dual key down (inclusive range in ms).
     * Defaults to same as keyDownDuration if omitted.
     */
    dualKeyDownDuration?: [number, number];
    /**
     * If true, this key will be held down through the next step's execution
     * and released during the next step's buffer period.
     * Used for focus target modifiers (e.g., Shift+R) that need to remain
     * held while the next ability executes.
     */
    holdThroughNext?: boolean;
    /**
     * Minimum delay (ms) before releasing a held modifier during next step's buffer.
     * Only applies if holdThroughNext is true.
     * Must be >= 1ms. Defaults to 7ms.
     */
    releaseDelayMin?: number;
    /**
     * Maximum delay (ms) before releasing a held modifier during next step's buffer.
     * Only applies if holdThroughNext is true.
     * Must be >= releaseDelayMin. Defaults to 18ms.
     */
    releaseDelayMax?: number;
    /**
     * Scroll direction for scroll steps. If set, this step performs a scroll instead of keypress.
     */
    scrollDirection?: "up" | "down";
    /**
     * Number of scroll units (lines). Defaults to 3 if scrollDirection is set.
     */
    scrollMagnitude?: number;
    /**
     * Echo hits: rapid repeat keypresses during the buffer phase.
     * The key is held and re-pressed 1-4 times within the specified window
     * to ensure ability activation even with game lag.
     * Format: { count: 1|2|3|4, windowMs: total window time (e.g., 170) }
     * Presses occur during buffer, not as extra delays.
     */
    echoHits?: {
        count: 1 | 2 | 3 | 4;
        windowMs: number;
    };
    /**
     * Timer configuration for TTS countdown timers (NEW for Omega system).
     * If set, this step starts a timer instead of (or in addition to) pressing a key.
     * Timer steps without a key will only start the timer.
     * Timer steps with a key will press the key AND start the timer.
     */
    timer?: TimerConfig;
}
/**
 * GCD (Global Cooldown) ability identifiers.
 * Used to track which abilities trigger the 1.275s global cooldown
 * and their individual cooldown timers.
 */
export type GCDAbilityType = "CRUSHING_BLOW" | "FORCE_SCREAM" | "AEGIS_ASSAULT" | "SWEEPING_SLASH" | "VICIOUS_SLASH" | "BASIC_ATTACK" | "RAVAGE" | "SMASH" | "VICIOUS_THROW" | "SABER_THROW" | "FORCE_CHOKE" | "BACKHAND" | "FORCE_PUSH" | "ELECTRO_STUN" | "SEISMIC_GRENADE" | "INTERCEDE" | "GUARD" | "FORCE_LEAP" | "RAGING_BURST" | "FORCE_CRUSH" | "OBLITERATE" | "INNERVATE" | "DARK_HEAL" | "ROAMING_MEND" | "DARK_INFUSION" | "REVIVIFICATION" | "RESURGENCE" | "ELECTROCUTE" | "CONSUMPTION" | "UNNATURAL_PRESERVATION" | "PURGE" | "FORCE_STORM" | "WHIRLWIND" | "STATIC_BARRIER" | "FORCE_LIGHTNING" | "DEMOLISH" | "AFFLICTION" | "DEATH_FIELD" | "CREEPING_TERROR" | "FORCE_LEECH" | "EXPLOSIVE_PROBE" | "SERIES_OF_SHOTS" | "PLASMA_PROBE" | "FRAG_GRENADE" | "ORBITAL_STRIKE" | "EMP_DISCHARGE" | "FLASH_BANG" | "SNIPE" | "COVERED_ESCAPE" | "SUPPRESSIVE_FIRE" | "LEG_SHOT" | "RAPID_SCAN" | "HEALING_SCAN" | "KOLTO_MISSILE" | "FULL_AUTO" | "EMERGENCY_SCAN" | "KOLTO_SHELL" | "PROGRESSIVE_SCAN" | "ELECTRO_DART" | "POWER_SHOT" | "CLEANSE" | "UNLOAD" | "CONCUSSION_MISSILE" | "PRIMING_SHOT" | "HEATSEEKER_MISSILES" | "BLAZING_BOLTS" | "TRACER_MISSILE" | "DEATH_FROM_ABOVE" | "RAIL_SHOT" | "PLASMA_GRENADE";
export interface MacroBinding {
    name: string;
    trigger?: {
        key: InputKey;
        gesture: GestureType;
    };
    sequence: SequenceStep[];
    enabled: boolean;
    /**
     * If this macro contains a GCD ability, specify which one.
     * This enables the GCD system to:
     * - Queue sequences during GCD lockout
     * - Track per-ability cooldowns
     * - Execute most-recent-wins logic
     *
     * If omitted, the system will attempt to detect from the macro name.
     */
    gcdAbility?: GCDAbilityType;
}
export interface GestureSettings {
    multiPressWindow: number;
    debounceDelay: number;
    longPressMin: number;
    longPressMax: number;
    superLongMin: number;
    superLongMax: number;
    cancelThreshold: number;
}
export interface MacroProfile {
    name: string;
    description: string;
    gestureSettings: GestureSettings;
    macros: MacroBinding[];
}
/**
 * Conundrum conflict type
 * - 'shift': key conflicts with SHIFT variant only
 * - 'alt': key conflicts with ALT variant only
 * - 'both': key conflicts with both SHIFT and ALT variants
 */
export type ConundrumConflict = "shift" | "alt" | "both";
/**
 * Compiled profile for fast runtime lookup
 * - conundrumKeys: raw keys that also appear with modifiers (legacy)
 * - conundrumConflicts: map of key -> which modifier(s) it conflicts with
 * - safeKeys: raw keys that do not appear with modifiers
 */
export interface CompiledProfile {
    conundrumKeys: Set<string>;
    conundrumConflicts: Map<string, ConundrumConflict>;
    safeKeys: Set<string>;
}
export interface GestureEvent {
    inputKey: InputKey;
    gesture: GestureType;
    timestamp: number;
    holdDuration?: number;
}
export interface BlockerInfo {
    reason: string;
    cooldownMs: number;
}
export declare const SEQUENCE_CONSTRAINTS: {
    readonly MIN_DELAY: 25;
    readonly MIN_VARIANCE: 4;
    readonly MAX_UNIQUE_KEYS: 6;
    readonly MAX_STEPS_PER_KEY: 6;
};
export type { RawCalibrationData, CalibrationStatistics, CalibrationData, CalculatedThresholds, KeyProfile, CalibratedMacroProfile, CalibrationConfig, CalibrationStep, ServerMessage, ClientCommand, } from "./calibrationTypes.js";
//# sourceMappingURL=types.d.ts.map