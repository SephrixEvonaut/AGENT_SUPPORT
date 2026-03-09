import { InputKey, MacroBinding, GestureSettings } from "./types.js";
/**
 * The 8 Omega gesture types (4 base + 4 F2 toggle variants)
 * F2 toggle is an independent modifier that creates a separate gesture space
 * combo_7_4: Special combo gesture triggered by key 4 during/after key 7 hold
 */
export declare const OMEGA_GESTURE_TYPES: readonly ["quick", "long", "quick_toggle", "long_toggle", "quick_f2", "long_f2", "quick_toggle_f2", "long_toggle_f2", "combo_7_4", "quick_q_toggle", "long_q_toggle", "quick_s_toggle", "long_s_toggle"];
export type OmegaGestureType = (typeof OMEGA_GESTURE_TYPES)[number];
/**
 * Check if a string is a valid Omega gesture type
 */
export declare function isOmegaGestureType(value: string): value is OmegaGestureType;
/**
 * Per-key calibrated thresholds (quick→long boundary in ms)
 * These values define when a press transitions from "quick" to "long"
 */
export declare const OMEGA_KEY_THRESHOLDS: Record<InputKey, number>;
/**
 * Special threshold for key "6" when in toggled mode
 */
export declare const KEY_6_TOGGLED_THRESHOLD = 510;
/**
 * Keys that require double-tap detection (wait for multi-press window)
 */
export declare const DOUBLE_TAP_DETECTION_KEYS: InputKey[];
/**
 * Toggle activator keys
 */
export declare const TOGGLE_KEYS: InputKey[];
/**
 * Check if a key is a toggle activator
 */
export declare function isToggleKey(key: InputKey): key is "W" | "Y";
/**
 * Check if a key has double-tap detection
 */
export declare function hasDoubleTapDetection(key: InputKey): boolean;
/**
 * State of an actively pressed key
 */
export interface ActiveKeyState {
    startTime: number;
    longFired: boolean;
}
/**
 * Core Omega state machine state
 */
export interface OmegaState {
    /** Whether toggle mode is currently active */
    toggleActive: boolean;
    /** Which key activated the toggle (W or Y), null if no toggle */
    toggleActivator: "W" | "Y" | null;
    /** When the toggle was activated (for threshold checking) */
    toggleStartTime: number | null;
    /** Map of currently held keys with their state */
    activeKeyDowns: Map<InputKey, ActiveKeyState>;
    /** S key's independent toggle state (for group member targeting) */
    groupMemberToggleActive: boolean;
}
/**
 * Create initial Omega state
 */
export declare function createInitialOmegaState(): OmegaState;
/**
 * Omega gesture event (emitted when a gesture is detected)
 */
export interface OmegaGestureEvent {
    inputKey: InputKey;
    gesture: OmegaGestureType;
    timestamp: number;
    holdDuration?: number;
    wasToggled: boolean;
    toggleActivator?: "W" | "Y";
    wasF2Toggle?: boolean;
}
/**
 * Callback type for Omega gesture events
 */
export type OmegaGestureCallback = (event: OmegaGestureEvent) => void;
/**
 * Extended MacroBinding that uses OmegaGestureType
 */
export interface OmegaMacroBinding extends Omit<MacroBinding, "trigger"> {
    trigger: {
        key: InputKey;
        gesture: OmegaGestureType;
    };
}
/**
 * Omega binding lookup table type
 */
export type OmegaBindingLookup = Map<InputKey, Map<OmegaGestureType, OmegaMacroBinding>>;
/**
 * Omega system configuration
 */
export interface OmegaConfig {
    /** Multi-press window for keys with double-tap detection (ms) */
    multiPressWindow: number;
    /** Debounce delay for key events (ms) */
    debounceDelay: number;
    /** Cancel threshold - holds beyond this are ignored (ms) */
    cancelThreshold: number;
    /** How often to check for long-press threshold crossing (ms) */
    checkIntervalMs: number;
}
/**
 * Default Omega configuration
 */
export declare const DEFAULT_OMEGA_CONFIG: OmegaConfig;
/**
 * GCD abilities that respect the 1.275s global cooldown
 */
export declare const OMEGA_GCD_ABILITIES: readonly ["SWEEPING_SLASH", "VICIOUS_THROW", "RAVAGE", "CRUSHING_BLOW", "FORCE_SCREAM", "SABER_THROW", "FORCE_PUSH", "FORCE_CHOKE", "BACKHAND", "VICIOUS_SLASH", "BASIC_ATTACK", "SMASH", "ELECTRO_STUN", "SEISMIC_GRENADE", "INTERCEDE", "GUARD", "AEGIS_ASSAULT", "FORCE_LEAP"];
export type OmegaGCDAbility = (typeof OMEGA_GCD_ABILITIES)[number];
/**
 * The corrected GCD duration in milliseconds (1.275 seconds)
 */
export declare const OMEGA_GCD_DURATION_MS = 1275;
/**
 * Available gesture detection systems
 */
export type GestureSystem = "alpha" | "omega";
/**
 * System selection configuration
 */
export interface SystemSelection {
    system: GestureSystem;
    selectedAt: number;
}
/**
 * Common interface that both Alpha and Omega detectors implement
 * This allows the rest of the system to work with either detector
 */
export interface IGestureDetector {
    /** Handle key down event */
    handleKeyDown(key: string): void;
    /** Handle key up event */
    handleKeyUp(key: string): void;
    /** Handle mouse button down */
    handleMouseDown(button: string): void;
    /** Handle mouse button up */
    handleMouseUp(button: string): void;
    /** Reset all state */
    reset(): void;
    /** Update global settings */
    updateSettings(settings: GestureSettings): void;
    /** Update settings for a specific key */
    updateKeyProfile(key: InputKey, settings: GestureSettings): void;
    /** Clear key-specific settings */
    clearKeyProfile(key: InputKey): void;
    /** Get active profile for a key */
    getKeyProfile(key: InputKey): GestureSettings | null;
    /** Get all profiles */
    getAllProfiles(): Record<string, GestureSettings>;
    /** Get keys with custom settings */
    getCustomizedKeys(): InputKey[];
    /** Load multiple key profiles */
    loadKeyProfiles(profiles: Record<string, GestureSettings>): void;
    /** Get global settings */
    getGlobalSettings(): GestureSettings;
    /** Destroy the detector */
    destroy(): void;
}
/**
 * Get the threshold for a key, accounting for toggled state
 */
export declare function getKeyThreshold(key: InputKey, isToggled: boolean): number;
/**
 * Determine the gesture type based on hold duration and toggle state
 */
export declare function determineOmegaGesture(holdDuration: number, threshold: number, isToggled: boolean): OmegaGestureType;
/**
 * Map an Omega gesture to its Alpha equivalent for fallback/compatibility
 * This allows Omega bindings to fall back to Alpha profiles if needed
 */
export declare function omegaToAlphaGesture(omega: OmegaGestureType): string;
//# sourceMappingURL=omegaTypes.d.ts.map