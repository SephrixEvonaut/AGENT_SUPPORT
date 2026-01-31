// ============================================================================
// CALIBRATION TYPES - Extended type definitions for gesture calibration system
// ============================================================================
import { INPUT_KEYS, } from "./types.js";
export const CALIBRATION_STEPS = [
    "single_tap",
    "long_hold",
    "super_long_hold",
    "double_tap",
    "triple_tap",
    "quadruple_tap",
];
export const STEP_NAMES = {
    single_tap: "Single Tap (Quick Press)",
    long_hold: "Long Hold",
    super_long_hold: "Super Long Hold",
    double_tap: "Double Tap Speed",
    triple_tap: "Triple Tap Speed",
    quadruple_tap: "Quadruple Tap Speed",
    complete: "Complete",
};
export const STEP_INSTRUCTIONS = {
    single_tap: "Perform quick taps of the key as you would during normal gameplay.",
    long_hold: "Hold the key for what feels like a 'long' press. Think: charging an ability.",
    super_long_hold: "Hold the key for a 'very long' press. Longer than long, but not forever.",
    double_tap: "Double-tap the key at your natural speed.",
    triple_tap: "Triple-tap the key at your natural speed.",
    quadruple_tap: "Quadruple-tap the key at your natural speed.",
    complete: "Calibration complete!",
};
export const DEFAULT_CALIBRATION_CONFIG = {
    samplesPerStep: 10,
    outlierStdDevThreshold: 2,
    safetyMarginMs: 50,
    multiPressWindowMultiplier: 2.5,
    minThresholdGapMs: 10,
    quickMode: false,
    quickModeSamples: 5,
};
/**
 * D-key special configuration (single gestures only)
 */
export const D_KEY_SPECIAL_CONFIG = {
    key: "D",
    skipMultiTap: true,
    usePresetThresholds: false,
    note: "D key only supports single gestures (no multi-tap)",
};
/**
 * Get special configuration for a key if it exists
 */
export function getSpecialKeyConfig(key) {
    if (key === "D")
        return D_KEY_SPECIAL_CONFIG;
    return null;
}
export const DEFAULT_CLI_DISPLAY = {
    showRawTimings: true,
    showStatistics: true,
    showConfidence: true,
    useColors: true,
    progressBarWidth: 40,
};
// ============================================================================
// EXPORTS
// ============================================================================
export { INPUT_KEYS };
//# sourceMappingURL=calibrationTypes.js.map