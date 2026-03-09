export interface OutputEvent {
    timestamp: number;
    abilityName: string;
    keyPressed: string;
    blockingDurationMs: number;
    isEchoHit: boolean;
    isRStream: boolean;
    pressureContribution: number;
}
export interface PressureSnapshot {
    timestamp: number;
    currentPressure: number;
    peakPressure: number;
    outputsInWindow: number;
    estimatedRecoveryMs: number;
    topContributors: {
        ability: string;
        contribution: number;
    }[];
}
export interface AbilityPressureStats {
    abilityName: string;
    totalOutputs: number;
    totalPressure: number;
    avgPressurePerOutput: number;
    maxSinglePressure: number;
    appearsInSpikes: number;
}
export interface SequencePattern {
    abilities: string[];
    occurrences: number;
    avgPressureGenerated: number;
    spikeCorrelation: number;
}
export interface PressureReport {
    sessionDuration: number;
    totalOutputs: number;
    totalPressure: number;
    peakPressure: number;
    peakTimestamp: number;
    spikeCount: number;
    avgPressure: number;
    abilityStats: AbilityPressureStats[];
    problematicSequences: SequencePattern[];
    recommendedGaps: {
        afterAbility: string;
        gapMs: number;
        reason: string;
    }[];
}
export declare class QueuePressureMonitor {
    private events;
    private snapshots;
    private sessionStartTime;
    private currentPressure;
    private peakPressure;
    private peakTimestamp;
    private lastDrainTime;
    private spikeCount;
    private inSpike;
    private spikeStartTime;
    private spikeAbilities;
    private recentAbilities;
    private sequencePatterns;
    private abilityPressure;
    private adaptiveGapMs;
    private consecutiveHighPressure;
    constructor();
    /**
     * Simulate queue draining over time
     * Called periodically to reduce pressure as the system catches up
     */
    private startDrainSimulation;
    /**
     * Record an output event and calculate its pressure contribution
     */
    recordOutput(abilityName: string, keyPressed: string, blockingDurationMs: number, isEchoHit?: boolean, isRStream?: boolean): void;
    /**
     * Start tracking a pressure spike
     */
    private startSpike;
    /**
     * End spike tracking and analyze
     */
    private endSpike;
    /**
     * Update statistics for an ability
     */
    private updateAbilityStats;
    /**
     * Track ability sequences for pattern detection
     */
    private trackSequence;
    /**
     * Analyze the sequence that led to a spike
     */
    private analyzeSequenceForSpike;
    /**
     * Take a pressure snapshot for historical analysis
     */
    private takeSnapshot;
    /**
     * Remove old events to prevent memory growth
     */
    private pruneOldEvents;
    /**
     * Get current pressure level (0-1 normalized)
     */
    getCurrentPressureLevel(): number;
    /**
     * Get recommended additional delay based on current pressure
     * Returns 0 if no additional delay needed
     */
    getAdaptiveDelay(): number;
    /**
     * Check if we should skip/delay a duplicate ability
     * Returns delay in ms, or -1 to skip entirely
     */
    shouldThrottleAbility(abilityName: string): number;
    /**
     * Generate a comprehensive pressure report
     */
    generateReport(): PressureReport;
    /**
     * Print a summary to console
     */
    printSummary(): void;
    /**
     * Get real-time status string
     */
    getStatusString(): string;
}
export declare function getQueuePressureMonitor(): QueuePressureMonitor;
export declare function resetQueuePressureMonitor(): void;
//# sourceMappingURL=queuePressureMonitor.d.ts.map