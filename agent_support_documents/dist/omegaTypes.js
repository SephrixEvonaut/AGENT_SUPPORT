// ============================================================================
// OMEGA TYPES - Type definitions for the Omega gesture detection system
// ============================================================================
//
// Omega is a simplified 4-gesture system designed for responsive gameplay:
// - quick: Fires on keyUp if held below threshold
// - long: Fires IMMEDIATELY when threshold is crossed (no wait for keyUp)
// - quick_toggle: Same as quick, but while toggle is active
// - long_toggle: Same as long, but while toggle is active
//
// Toggle keys (W, Y) create a modifier state for all other keys.
//
// ============================================================================
// ============================================================================
// OMEGA GESTURE TYPES
// ============================================================================
/**
 * The 8 Omega gesture types (4 base + 4 F2 toggle variants)
 * F2 toggle is an independent modifier that creates a separate gesture space
 * combo_7_4: Special combo gesture triggered by key 4 during/after key 7 hold
 */
export const OMEGA_GESTURE_TYPES = [
    "quick",
    "long",
    "quick_toggle",
    "long_toggle",
    "quick_f2",
    "long_f2",
    "quick_toggle_f2",
    "long_toggle_f2",
    "combo_7_4",
    "quick_q_toggle",
    "long_q_toggle",
    "quick_s_toggle",
    "long_s_toggle",
];
/**
 * Check if a string is a valid Omega gesture type
 */
export function isOmegaGestureType(value) {
    return OMEGA_GESTURE_TYPES.includes(value);
}
// ============================================================================
// PER-KEY THRESHOLDS
// ============================================================================
/**
 * Per-key calibrated thresholds (quick→long boundary in ms)
 * These values define when a press transitions from "quick" to "long"
 */
export const OMEGA_KEY_THRESHOLDS = {
    // Number keys
    "1": 312,
    "2": 488,
    "3": 355,
    "4": 298,
    "5": 470,
    "6": 510, // Same threshold for normal and toggled mode
    "7": 500, // F2 toggle activation threshold (custom handler)
    // Letter keys
    W: 185, // Also a toggle activator
    A: 241,
    S: 512,
    D: 400, // Special handling (Prompt 2)
    B: 391,
    I: 597,
    Y: 233, // Also a toggle activator
    U: 558,
    T: 238,
    C: 349, // Special: has double-tap detection
    H: 452,
    P: 380, // Default estimate
    // D-key only input keys (Omega system - only valid during D hold)
    E: 380, // Default estimate
    F: 380, // Default estimate
    G: 380, // Default estimate
    // Special keys
    "=": 380, // Special: has double-tap detection
    F2: 380, // Special: has double-tap detection
    MIDDLE_CLICK: 442,
    // Semicolon for forward movement (D-key trigger in Omega)
    ";": 380, // Default estimate
    // Spacebar
    SPACEBAR: 380,
    // Q key (toggle activator for Q toggle system)
    Q: 350,
    // 8 key
    "8": 380,
    // Group member SWTOR keys (for config mode)
    // These don't trigger gestures, only captured during config mode
    F10: 380,
    F11: 380,
    F12: 380,
    INSERT: 380,
};
/**
 * Special threshold for key "6" when in toggled mode
 */
export const KEY_6_TOGGLED_THRESHOLD = 510;
/**
 * Keys that require double-tap detection (wait for multi-press window)
 */
export const DOUBLE_TAP_DETECTION_KEYS = ["C", "=", "F2"];
/**
 * Toggle activator keys
 */
export const TOGGLE_KEYS = ["W", "Y"];
/**
 * Check if a key is a toggle activator
 */
export function isToggleKey(key) {
    return key === "W" || key === "Y";
}
/**
 * Check if a key has double-tap detection
 */
export function hasDoubleTapDetection(key) {
    return DOUBLE_TAP_DETECTION_KEYS.includes(key);
}
/**
 * Create initial Omega state
 */
export function createInitialOmegaState() {
    return {
        toggleActive: false,
        toggleActivator: null,
        toggleStartTime: null,
        activeKeyDowns: new Map(),
        groupMemberToggleActive: false,
    };
}
/**
 * Default Omega configuration
 */
export const DEFAULT_OMEGA_CONFIG = {
    multiPressWindow: 350,
    debounceDelay: 15,
    cancelThreshold: 2000,
    checkIntervalMs: 5, // Very fast checking for responsive long-press detection
};
// ============================================================================
// GCD TYPES (OMEGA-SPECIFIC)
// ============================================================================
/**
 * GCD abilities that respect the 1.275s global cooldown
 */
export const OMEGA_GCD_ABILITIES = [
    "SWEEPING_SLASH",
    "VICIOUS_THROW",
    "RAVAGE",
    "CRUSHING_BLOW",
    "FORCE_SCREAM",
    "SABER_THROW",
    "FORCE_PUSH",
    "FORCE_CHOKE",
    "BACKHAND",
    "VICIOUS_SLASH",
    "BASIC_ATTACK",
    "SMASH",
    "ELECTRO_STUN",
    "SEISMIC_GRENADE",
    "INTERCEDE",
    "GUARD",
    "AEGIS_ASSAULT",
    "FORCE_LEAP",
];
/**
 * The corrected GCD duration in milliseconds (1.275 seconds)
 */
export const OMEGA_GCD_DURATION_MS = 1275;
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
/**
 * Get the threshold for a key, accounting for toggled state
 */
export function getKeyThreshold(key, isToggled) {
    // Special case: key "6" has different threshold when toggled
    if (key === "6" && isToggled) {
        return KEY_6_TOGGLED_THRESHOLD;
    }
    return OMEGA_KEY_THRESHOLDS[key] ?? 380; // Default to 380ms if not specified
}
/**
 * Determine the gesture type based on hold duration and toggle state
 */
export function determineOmegaGesture(holdDuration, threshold, isToggled) {
    const isLong = holdDuration >= threshold;
    if (isToggled) {
        return isLong ? "long_toggle" : "quick_toggle";
    }
    else {
        return isLong ? "long" : "quick";
    }
}
/**
 * Map an Omega gesture to its Alpha equivalent for fallback/compatibility
 * This allows Omega bindings to fall back to Alpha profiles if needed
 */
export function omegaToAlphaGesture(omega) {
    switch (omega) {
        case "quick":
            return "single";
        case "long":
            return "single_long";
        case "quick_toggle":
            return "double"; // Toggle variants map to double-tap equivalents
        case "long_toggle":
            return "double_long";
        default:
            return "single";
    }
}
//# sourceMappingURL=omegaTypes.js.map