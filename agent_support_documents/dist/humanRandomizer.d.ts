/**
 * Sophisticated Human-Like Randomizer
 *
 * Generates timing values that:
 * - Follow natural human timing distributions
 * - Include realistic clustering and anti-clustering
 * - Resist statistical analysis detection
 * - Appear as "fairness correction" code
 */
export declare class HumanRandomizer {
    private seedModifier;
    private iteration;
    private histories;
    private sweetSpots;
    constructor(seed?: number);
    /**
     * Configure sweet spot values for a named range
     * These values get subtle probability boosts (appears as anti-clustering)
     *
     * @param rangeName - Identifier for this timing range
     * @param sweetSpotMap - Map of value -> target probability (0.0-1.0)
     */
    configureSweetSpots(rangeName: string, sweetSpotMap: Map<number, number>): void;
    /**
     * Hash mixing function - creates deterministic but random-looking values
     * This appears as standard entropy enhancement
     */
    private hashMix;
    /**
     * Gaussian-like bias - applies natural statistical variation
     * Target values get "lucky" boosts disguised as noise
     */
    private gaussianBias;
    /**
     * History-based "correction" - appears to prevent clustering
     * Actually reinforces sweet spot probabilities over time
     */
    private historyCorrection;
    /**
     * Generate a human-like random value within range
     *
     * @param min - Minimum value (inclusive)
     * @param max - Maximum value (inclusive)
     * @param rangeName - Optional name for history tracking and sweet spots
     */
    generate(min: number, max: number, rangeName?: string): number;
    /**
     * Generate with explicit sweet spot weighting
     * Simpler interface for common use cases
     */
    generateWeighted(min: number, max: number, sweetSpots: Array<{
        value: number;
        weight: number;
    }>, rangeName?: string): number;
    /**
     * Get statistics for debugging/verification
     * Shows distribution analysis (for development only)
     */
    getStats(rangeName: string): {
        sampleCount: number;
        distribution: Map<number, number>;
        sweetSpotHitRate: Map<number, number>;
    };
    /**
     * Reset history (useful between test runs)
     */
    resetHistory(rangeName?: string): void;
}
/**
 * Get buffer delay for a tier with human-like randomization
 */
export declare function getHumanBufferDelay(tier: "low" | "medium" | "high"): number;
/**
 * Get key down duration with human-like randomization
 * Replaces the old weighted distribution with sophisticated approach
 */
export declare function getHumanKeyDownDuration(min?: number, max?: number): number;
/**
 * Get echo hit hold duration with human-like randomization
 * NOW BUFFER-TIER-AWARE: Different tiers have different timing ranges
 *
 * @param bufferTier - The buffer tier context (defaults to "low" for backward compatibility)
 *
 * Timing ranges by tier:
 * - LOW:    28-42ms (fast rotational abilities)
 * - MEDIUM: 34-69ms (channeled abilities)
 * - HIGH:   75-100ms (cooldown abilities)
 */
export declare function getHumanEchoHitDuration(bufferTier?: "low" | "medium" | "high"): number;
/**
 * Calculate whether buffer extension is needed based on echo timing
 *
 * Buffer extension prevents timing conflicts when echoes consume too much
 * of the buffer window. Triggers when:
 *   (echoCount × avgEchoDuration) > (bufferMs / 2)
 *
 * @param echoCount - Number of echo hits configured
 * @param bufferTier - The buffer tier for this step
 * @param bufferMs - The actual buffer delay in milliseconds
 * @returns Object with needsExtension boolean and extensionMs if needed
 */
export declare function calculateBufferExtension(echoCount: number, bufferTier: "low" | "medium" | "high", bufferMs: number): {
    needsExtension: boolean;
    extensionMs: number;
    reason?: string;
};
/**
 * Get buffer extension duration with human-like randomization
 * Range: 69-72ms with weighted distribution favoring 70-71ms
 */
export declare function getHumanBufferExtension(): number;
/**
 * Get hold-through-next release delay with human-like randomization
 */
export declare function getHumanReleaseDelay(min?: number, max?: number): number;
/**
 * Get dual key offset with human-like randomization
 */
export declare function getHumanDualKeyOffset(): number;
/**
 * Get traffic controller wait time with human-like randomization
 */
export declare function getHumanTrafficWait(): number;
/**
 * Generic human-like random delay (for custom ranges)
 */
export declare function getHumanDelay(min: number, max: number, rangeName?: string): number;
/**
 * Reset all history (useful for testing)
 */
export declare function resetRandomizerHistory(): void;
/**
 * Get stats for analysis (development only)
 */
export declare function getRandomizerStats(rangeName: string): ReturnType<HumanRandomizer["getStats"]>;
export default HumanRandomizer;
//# sourceMappingURL=humanRandomizer.d.ts.map