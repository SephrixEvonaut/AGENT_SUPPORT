import { InputKey, GestureType, GestureSettings, GestureEvent, INPUT_KEYS } from "./types.js";
/**
 * Raw timing data collected during calibration for a single key
 */
export interface RawCalibrationData {
    key: InputKey;
    singleTaps: number[];
    longHolds: number[];
    superLongHolds: number[];
    doubleTapGaps: number[];
    tripleTapGaps: number[];
    quadrupleTapGaps: number[];
    collectedAt: string;
}
/**
 * Statistical analysis of calibration samples
 */
export interface CalibrationStatistics {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    percentile10: number;
    percentile90: number;
    sampleCount: number;
    outlierCount: number;
}
/**
 * Complete calibration data with metadata
 */
export interface CalibrationData {
    calibratedAt: string;
    sampleSize: number;
    outlierCount: number;
    confidence: number;
    averages: {
        singleTap: number;
        longHold: number;
        superLongHold: number;
        multiTapGap: number;
    };
    stdDeviations: {
        singleTap: number;
        longHold: number;
        superLongHold: number;
        multiTapGap: number;
    };
    ranges: {
        singleTap: [number, number];
        longHold: [number, number];
        superLongHold: [number, number];
        multiTapGap: [number, number];
    };
    reasoning: string[];
}
/**
 * Calculated thresholds from calibration analysis
 */
export interface CalculatedThresholds {
    key: InputKey;
    singleTapMax: number;
    longPressMin: number;
    longPressMax: number;
    superLongMin: number;
    superLongMax: number;
    cancelThreshold: number;
    multiPressWindow: number;
    extensionWindow: number;
    debounceDelay: number;
    confidence: number;
    sampleSize: number;
    outlierCount: number;
    reasoning: string[];
}
/**
 * Extended key profile with calibration data
 */
export interface KeyProfile extends GestureSettings {
    calibrationData?: CalibrationData;
    specialBehavior?: "singleGesturesOnly" | "noMultiTap";
}
/**
 * Extended macro profile with per-key calibration
 */
export interface CalibratedMacroProfile {
    name: string;
    description: string;
    calibrationVersion?: string;
    calibratedAt?: string;
    calibrationToolVersion?: string;
    gestureSettings: GestureSettings;
    keyProfiles?: Record<string, KeyProfile>;
    macros: any[];
}
/**
 * Current state of the calibration wizard
 */
export interface CalibrationWizardState {
    phase: "idle" | "collecting" | "analyzing" | "reviewing" | "complete";
    currentKey: InputKey | null;
    currentStep: CalibrationStep;
    stepProgress: number;
    totalKeysCalibrated: number;
    totalKeysRemaining: number;
    currentStepData: number[];
    error: string | null;
}
/**
 * Steps in the calibration process
 */
export type CalibrationStep = "single_tap" | "long_hold" | "super_long_hold" | "double_tap" | "triple_tap" | "quadruple_tap" | "complete";
export declare const CALIBRATION_STEPS: CalibrationStep[];
export declare const STEP_NAMES: Record<CalibrationStep, string>;
export declare const STEP_INSTRUCTIONS: Record<CalibrationStep, string>;
/**
 * WebSocket message types from server to client
 */
export type ServerMessage = {
    type: "GESTURE_DETECTED";
    key: InputKey;
    gesture: GestureType;
    timing?: number;
    timestamp: number;
} | {
    type: "PROFILE_UPDATED";
    key: InputKey;
    profile: KeyProfile;
    timestamp: number;
} | {
    type: "CALIBRATION_STARTED";
    keys: InputKey[] | "all";
    timestamp: number;
} | {
    type: "RECENT_GESTURES";
    key: InputKey;
    gestures: GestureEvent[];
} | {
    type: "KEY_PROFILE";
    key: InputKey;
    profile: GestureSettings;
} | {
    type: "ALL_PROFILES";
    profiles: Record<string, GestureSettings>;
} | {
    type: "SUBSCRIBED";
    key: InputKey;
} | {
    type: "SUCCESS";
    key?: InputKey;
    message: string;
} | {
    type: "ERROR";
    message: string;
} | {
    type: "EXPORT_COMPLETE";
    filename: string;
    path: string;
};
/**
 * WebSocket command types from client to server
 */
export type ClientCommand = {
    type: "UPDATE_KEY_PROFILE";
    key: InputKey;
    profile: Partial<GestureSettings>;
} | {
    type: "START_CALIBRATION";
    keys?: InputKey[];
} | {
    type: "GET_RECENT_GESTURES";
    key: InputKey;
    count?: number;
} | {
    type: "GET_CURRENT_PROFILE";
    key?: InputKey;
} | {
    type: "SUBSCRIBE_KEY";
    key: InputKey;
} | {
    type: "UNSUBSCRIBE_KEY";
    key: InputKey;
} | {
    type: "EXPORT_PROFILE";
    filename?: string;
} | {
    type: "LOAD_PROFILE";
    path: string;
};
/**
 * Configuration for the calibration process
 */
export interface CalibrationConfig {
    samplesPerStep: number;
    outlierStdDevThreshold: number;
    safetyMarginMs: number;
    multiPressWindowMultiplier: number;
    minThresholdGapMs: number;
    quickMode: boolean;
    quickModeSamples: number;
    preselectedKeys?: string[];
}
export declare const DEFAULT_CALIBRATION_CONFIG: CalibrationConfig;
/**
 * Keys with special calibration requirements
 */
export interface SpecialKeyConfig {
    key: InputKey;
    skipMultiTap: boolean;
    usePresetThresholds: boolean;
    presetProfile?: Partial<GestureSettings>;
    note?: string;
}
/**
 * D-key special configuration (single gestures only)
 */
export declare const D_KEY_SPECIAL_CONFIG: SpecialKeyConfig;
/**
 * Get special configuration for a key if it exists
 */
export declare function getSpecialKeyConfig(key: InputKey): SpecialKeyConfig | null;
/**
 * Complete calibration session results
 */
export interface CalibrationSessionResult {
    sessionId: string;
    startedAt: string;
    completedAt: string;
    toolVersion: string;
    globalDefaults: GestureSettings;
    keyProfiles: Record<string, KeyProfile>;
    keysCalibrated: InputKey[];
    keysSkipped: InputKey[];
    totalSamples: number;
    averageConfidence: number;
}
/**
 * Result of validating thresholds
 */
export interface ThresholdValidationResult {
    valid: boolean;
    warnings: string[];
    errors: string[];
    adjustments: string[];
}
/**
 * CLI command parsing result
 */
export interface ParsedCommand {
    command: string;
    args: string[];
    flags: Record<string, string | boolean>;
}
/**
 * CLI display configuration
 */
export interface CLIDisplayConfig {
    showRawTimings: boolean;
    showStatistics: boolean;
    showConfidence: boolean;
    useColors: boolean;
    progressBarWidth: number;
}
export declare const DEFAULT_CLI_DISPLAY: CLIDisplayConfig;
export { InputKey, GestureType, GestureSettings, GestureEvent, INPUT_KEYS };
//# sourceMappingURL=calibrationTypes.d.ts.map