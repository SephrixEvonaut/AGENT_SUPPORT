import { MacroProfile, GestureSettings, CompiledProfile } from "./types.js";
export declare const DEFAULT_GESTURE_SETTINGS: GestureSettings;
interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export declare class ProfileLoader {
    private profileDir;
    private lastCompiled;
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
     */
    loadProfile(filename: string): MacroProfile | null;
    /**
     * Get the last compiled profile (if any)
     */
    getCompiledProfile(): CompiledProfile | null;
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
