import { CompiledProfile } from "./types.js";
/**
 * Modifier state for traffic control decisions
 */
export interface ModifierState {
    shift: boolean;
    alt: boolean;
    ctrl: boolean;
}
export declare class TrafficController {
    private crossingKey;
    private queue;
    private compiledProfile;
    private supremacyMacros;
    private stunBreakCooldownEnd;
    private readonly STUN_BREAK_COOLDOWN_MS;
    private getModifierState;
    constructor(compiledProfile: CompiledProfile);
    /**
     * Set callback to get current modifier state for smart conflict detection
     */
    setModifierStateCallback(cb: () => ModifierState): void;
    /**
     * Grant supremacy to a macro - it will bypass traffic control entirely
     */
    grantSupremacy(macroName: string): void;
    /**
     * Revoke supremacy from a macro
     */
    revokeSupremacy(macroName: string): void;
    /**
     * Check if a macro has supremacy
     */
    hasSupremacy(macroName: string): boolean;
    /**
     * Get all macros with supremacy
     */
    getSupremacyList(): string[];
    /**
     * Check if Stun Break is blocked by cooldown
     * @returns null if available, BlockerInfo if on cooldown
     */
    isStunBreakBlocked(): {
        reason: string;
        cooldownMs: number;
    } | null;
    /**
     * Record Stun Break usage and start cooldown timer
     */
    recordStunBreakUsed(): void;
    requestCrossing(key: string, macroName?: string): Promise<void>;
    /**
     * Check if there's an active conflict based on current modifier state
     */
    private hasActiveConflict;
    releaseCrossing(key: string): void;
    private shouldWait;
}
export default TrafficController;
//# sourceMappingURL=trafficController.d.ts.map