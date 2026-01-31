import { MacroBinding, GestureType } from "./types.js";
import { OmegaMacroBinding } from "./omegaTypes.js";
/** GCD duration in milliseconds (1.275 seconds - corrected for SWTOR) */
export declare const GCD_DURATION_MS = 1275;
/**
 * Abilities that trigger the Global Cooldown.
 * All of these cause a 1.275s lockout before another GCD ability can fire.
 */
export declare const GCD_ABILITIES: Set<string>;
/**
 * Per-ability cooldowns in milliseconds.
 * Abilities not listed here only respect GCD (no additional cooldown).
 */
export declare const ABILITY_COOLDOWNS_MS: Record<string, number>;
export interface QueuedSequence {
    binding: MacroBinding;
    queuedAt: number;
    gcdAbility: string;
}
export interface GCDState {
    isActive: boolean;
    startedAt: number;
    endsAt: number;
    currentAbility: string | null;
}
export interface GCDManagerStats {
    gcdActive: boolean;
    gcdRemaining: number;
    queueSize: number;
    currentAbility: string | null;
    abilitiesOnCooldown: string[];
}
export declare class GCDManager {
    private gcdState;
    /** Tracks when each ability was last used (for per-ability cooldowns) */
    private abilityCooldowns;
    /** Queue of pending GCD sequences (only most recent will execute) */
    private gcdQueue;
    /** Callback to execute a binding when GCD ends */
    private executeCallback;
    /** Timer for GCD expiration */
    private gcdTimer;
    /** Shutdown flag */
    private isShutdown;
    /**
     * Per-ability cooldown tracking mode.
     * When false, only GCD is respected - individual ability cooldowns are ignored.
     * When true, abilities respect their in-game cooldowns (CB 7s, FS 11s, etc.)
     */
    private perAbilityCooldownsEnabled;
    constructor();
    /**
     * Enable or disable per-ability cooldown tracking.
     * When disabled, only GCD (1.275s) is enforced between abilities.
     */
    setPerAbilityCooldownsEnabled(enabled: boolean): void;
    /**
     * Check if per-ability cooldowns are enabled
     */
    isPerAbilityCooldownsEnabled(): boolean;
    /**
     * Reset cooldowns for abilities with duration less than specified threshold.
     * Default threshold is 20000ms (20 seconds).
     * Returns the list of abilities that were reset.
     */
    resetShortCooldowns(maxDurationMs?: number): string[];
    /**
     * Set the callback to execute bindings when GCD allows
     */
    setExecuteCallback(callback: (binding: MacroBinding) => void): void;
    /**
     * Detect the primary GCD ability in a macro binding by name pattern matching
     */
    detectGCDAbility(binding: MacroBinding): string | null;
    /**
     * Check if a binding contains a GCD ability
     */
    isGCDBinding(binding: MacroBinding): boolean;
    /**
     * Check if the GCD is currently active
     */
    isGCDActive(): boolean;
    /**
     * Get remaining GCD time in milliseconds
     */
    getGCDRemaining(): number;
    /**
     * Check if a specific ability is on its individual cooldown.
     * Always returns false if per-ability cooldowns are disabled.
     */
    isAbilityOnCooldown(abilityName: string): boolean;
    /**
     * Get remaining cooldown time for an ability in milliseconds
     */
    getAbilityCooldownRemaining(abilityName: string): number;
    /**
     * Try to execute a macro binding.
     * - Non-GCD bindings execute immediately
     * - GCD bindings either execute (if GCD not active) or queue (if GCD active)
     *
     * Returns: { executed: boolean, queued: boolean, reason?: string }
     */
    tryExecute(binding: MacroBinding): {
        executed: boolean;
        queued: boolean;
        reason?: string;
    };
    /**
     * Get current stats for debugging/display
     */
    getStats(): GCDManagerStats;
    /**
     * Clear the queue
     */
    clearQueue(): void;
    /**
     * Reset all cooldowns (e.g., for testing or combat reset)
     */
    resetCooldowns(): void;
    /**
     * Shutdown the manager
     */
    shutdown(): void;
    private queueSequence;
    private executeGCDBinding;
    private executeNonGCDBinding;
    private startGCD;
    private onGCDEnd;
    /**
     * Process the queue when GCD ends.
     * Executes the most recently queued sequence that's not on cooldown.
     * Discards all other queued sequences.
     */
    private processQueue;
}
/**
 * Get fallback gesture when the triggered gesture has no binding.
 *
 * Rules:
 * - If "long" triggered but unbound → try "super_long"
 * - If "super_long" triggered but unbound → try "long"
 *
 * Only applies to single/double/triple/quadruple tap variants.
 */
export declare function getGestureFallback(triggeredGesture: GestureType, hasBinding: (gesture: GestureType) => boolean): GestureType | null;
/**
 * Check if a binding is "empty" (placeholder with no real sequence)
 * Empty bindings have:
 * - Name containing "~"
 * - Empty sequence array
 * - Not enabled
 */
export declare function isEmptyBinding(binding: MacroBinding | OmegaMacroBinding | undefined | null): boolean;
export declare function getGCDManager(): GCDManager;
export declare function resetGCDManager(): void;
export default GCDManager;
//# sourceMappingURL=gcdManager.d.ts.map