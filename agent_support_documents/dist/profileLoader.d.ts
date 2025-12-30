import { MacroProfile, GestureSettings } from './types.js';
export declare const DEFAULT_GESTURE_SETTINGS: GestureSettings;
interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export declare class ProfileLoader {
    private profileDir;
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
     * List all available profiles
     */
    listProfiles(): string[];
    /**
     * Save a profile to JSON file
     */
    saveProfile(profile: MacroProfile, filename: string): boolean;
}
export {};
