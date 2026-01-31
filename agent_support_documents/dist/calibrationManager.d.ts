import { InputKey, GestureSettings, RawCalibrationData, CalibrationStatistics, CalculatedThresholds, KeyProfile, CalibrationConfig, ThresholdValidationResult } from "./calibrationTypes.js";
/**
 * Calculate the mean (average) of an array of numbers
 */
export declare function calculateMean(values: number[]): number;
/**
 * Calculate the median of an array of numbers
 */
export declare function calculateMedian(values: number[]): number;
/**
 * Calculate the standard deviation of an array of numbers
 */
export declare function calculateStdDev(values: number[], mean?: number): number;
/**
 * Calculate a percentile value from an array
 */
export declare function calculatePercentile(values: number[], percentile: number): number;
/**
 * Remove outliers using standard deviation method
 * Returns array of values within threshold standard deviations of mean
 */
export declare function removeOutliers(values: number[], stdDevThreshold?: number): {
    cleaned: number[];
    outlierCount: number;
};
/**
 * Calculate comprehensive statistics for a dataset
 */
export declare function calculateStatistics(values: number[], config?: CalibrationConfig): CalibrationStatistics;
/**
 * Calculate optimal thresholds from raw calibration data
 */
export declare function calculateThresholds(data: RawCalibrationData, config?: CalibrationConfig): CalculatedThresholds;
/**
 * Validate calculated thresholds for consistency and safety
 */
export declare function validateThresholds(thresholds: CalculatedThresholds): ThresholdValidationResult;
/**
 * Convert calculated thresholds to a KeyProfile
 */
export declare function thresholdsToKeyProfile(thresholds: CalculatedThresholds): KeyProfile;
/**
 * Convert KeyProfile to GestureSettings (for use in GestureDetector)
 */
export declare function keyProfileToGestureSettings(profile: KeyProfile): GestureSettings;
/**
 * Main calibration manager for handling calibration sessions
 */
export declare class CalibrationManager {
    private config;
    private rawData;
    private calculatedThresholds;
    private keyProfiles;
    constructor(config?: Partial<CalibrationConfig>);
    /**
     * Start collecting data for a key
     */
    startKeyCalibration(key: InputKey): void;
    /**
     * Record a single tap sample
     */
    recordSingleTap(key: InputKey, durationMs: number): void;
    /**
     * Record a long hold sample
     */
    recordLongHold(key: InputKey, durationMs: number): void;
    /**
     * Record a super long hold sample
     */
    recordSuperLongHold(key: InputKey, durationMs: number): void;
    /**
     * Record a double tap gap sample
     */
    recordDoubleTapGap(key: InputKey, gapMs: number): void;
    /**
     * Record triple tap gaps (2 gaps per triple tap)
     */
    recordTripleTapGaps(key: InputKey, gaps: number[]): void;
    /**
     * Record quadruple tap gaps (3 gaps per quadruple tap)
     */
    recordQuadrupleTapGaps(key: InputKey, gaps: number[]): void;
    /**
     * Get current sample counts for a key
     */
    getSampleCounts(key: InputKey): Record<string, number> | null;
    /**
     * Get raw data for a key
     */
    getRawData(key: InputKey): RawCalibrationData | null;
    /**
     * Analyze collected data and calculate thresholds
     */
    analyzeKey(key: InputKey): CalculatedThresholds | null;
    /**
     * Get calculated thresholds for a key
     */
    getThresholds(key: InputKey): CalculatedThresholds | null;
    /**
     * Get key profile
     */
    getKeyProfile(key: InputKey): KeyProfile | null;
    /**
     * Get all key profiles
     */
    getAllKeyProfiles(): Map<InputKey, KeyProfile>;
    /**
     * Import existing key profile
     */
    importKeyProfile(key: InputKey, profile: KeyProfile): void;
    /**
     * Clear all data
     */
    reset(): void;
    /**
     * Clear data for a specific key
     */
    resetKey(key: InputKey): void;
    /**
     * Get configuration
     */
    getConfig(): CalibrationConfig;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<CalibrationConfig>): void;
    /**
     * Export all profiles to JSON format compatible with existing profile structure
     */
    exportProfiles(globalDefaults: GestureSettings, existingProfile?: any): any;
}
export declare function getCalibrationManager(config?: Partial<CalibrationConfig>): CalibrationManager;
export declare function resetCalibrationManager(): void;
export default CalibrationManager;
//# sourceMappingURL=calibrationManager.d.ts.map