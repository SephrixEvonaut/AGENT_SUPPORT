import { MacroProfile, GestureSettings, CompiledProfile } from "./types.js";
import { KeyProfile } from "./calibrationTypes.js";
export declare const DEFAULT_GESTURE_SETTINGS: GestureSettings;
interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export declare class ProfileLoader {
    private profileDir;
    private lastCompiled;
    private keyProfiles;
    private groupMemberMappings;
    constructor(profileDir?: string);
    /**
     * Validate a macro binding
     */
    private validateBinding;
    /**
     * Validate a complete profile
     */
    validateProfile(profile: MacroProfile): ValidationResult;
    /**
     * Load a profile from JSON file
     * Supports both legacy profiles and calibrated profiles with keyProfiles
     * Also supports Omega-style profiles with 'bindings' instead of 'macros'
     */
    loadProfile(filename: string): MacroProfile | null;
    /**
     * Get the last compiled profile (if any)
     */
    getCompiledProfile(): CompiledProfile | null;
    /**
     * Get loaded key profiles for gesture detector
     */
    getKeyProfiles(): Map<string, KeyProfile>;
    /**
     * Get group member toggle mappings from profile (if present)
     * Returns null if profile doesn't define custom mappings
     */
    getGroupMemberMappings(): Record<string, [string, string]> | null;
    /**
     * Check if profile has calibration data
     */
    hasCalibrationData(): boolean;
    /**
     * Get calibration confidence for a specific key
     */
    getKeyConfidence(key: string): number | null;
    /**
     * List all available profiles
     */
    listProfiles(): string[];
    /**
     * Save a profile to JSON file
     */
    saveProfile(profile: MacroProfile, filename: string): boolean;
}
export {};
//# sourceMappingURL=profileLoader.d.ts.map