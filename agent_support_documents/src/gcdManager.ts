// ============================================================================
// GCD MANAGER - Global Cooldown & Ability Cooldown System
// ============================================================================
//
// Emulates SWTOR's GCD (Global Cooldown) system:
// - 1.275 second global cooldown after any GCD ability
// - Per-ability cooldowns that must expire before reuse
// - Queue system that executes most recent GCD sequence when GCD ends
// - Long/Super Long gesture fallback when one is unbound
//
// ============================================================================

import { MacroBinding, GestureType } from "./types.js";
import { OmegaMacroBinding } from "./omegaTypes.js";

// Create a simple logger if the real one isn't available
const logger = {
  info: (msg: string) => console.log(`[GCD] ${msg}`),
  debug: (msg: string) => {
    if (process.env.DEBUG_GCD) console.log(`[GCD:DEBUG] ${msg}`);
  },
  warn: (msg: string) => console.warn(`[GCD:WARN] ${msg}`),
  error: (msg: string) => console.error(`[GCD:ERROR] ${msg}`),
};

// ============================================================================
// CONFIGURATION
// ============================================================================

/** GCD duration in milliseconds (1.275 seconds - corrected for SWTOR) */
export const GCD_DURATION_MS = 1275;

/**
 * Abilities that trigger the Global Cooldown.
 * All of these cause a 1.275s lockout before another GCD ability can fire.
 */
export const GCD_ABILITIES = new Set([
  "SWEEPING_SLASH",
  "VICIOUS_THROW",
  "RAVAGE",
  "CRUSHING_BLOW",
  "FORCE_SCREAM",
  "SABER_THROW",
  "FORCE_PUSH",
  "FORCE_CHOKE",
  "BACKHAND",
  "VICIOUS_SLASH",
  "BASIC_ATTACK",
  "SMASH",
  "ELECTRO_STUN",
  "SEISMIC_GRENADE",
  "INTERCEDE",
  "GUARD",
  "AEGIS_ASSAULT",
  "FORCE_LEAP",
]);

/**
 * Per-ability cooldowns in milliseconds.
 * Abilities not listed here only respect GCD (no additional cooldown).
 */
export const ABILITY_COOLDOWNS_MS: Record<string, number> = {
  CRUSHING_BLOW: 7000,
  FORCE_SCREAM: 11000,
  AEGIS_ASSAULT: 11000,
  VICIOUS_THROW: 9000,
  RAVAGE: 16500,
  GUARD: 1000,
  INTERCEDE: 18000,
  SMASH: 14000,
  FORCE_LEAP: 3000,
  FORCE_CHOKE: 50000,
  BACKHAND: 50000,
  FORCE_PUSH: 50000,
};

/**
 * Keywords in macro names that identify which GCD ability they contain.
 * Order matters - more specific matches should come first.
 */
const ABILITY_NAME_PATTERNS: Array<{ pattern: RegExp; ability: string }> = [
  { pattern: /crushing\s*blow/i, ability: "CRUSHING_BLOW" },
  { pattern: /force\s*scream/i, ability: "FORCE_SCREAM" },
  { pattern: /aegis\s*assault|aegis/i, ability: "AEGIS_ASSAULT" },
  { pattern: /vicious\s*throw/i, ability: "VICIOUS_THROW" },
  { pattern: /vicious\s*slash/i, ability: "VICIOUS_SLASH" },
  { pattern: /sweeping\s*slash|sweeping/i, ability: "SWEEPING_SLASH" },
  { pattern: /basic\s*attack/i, ability: "BASIC_ATTACK" },
  { pattern: /ravage/i, ability: "RAVAGE" },
  { pattern: /smash/i, ability: "SMASH" },
  { pattern: /saber\s*throw/i, ability: "SABER_THROW" },
  { pattern: /force\s*choke|choke/i, ability: "FORCE_CHOKE" },
  { pattern: /backhand/i, ability: "BACKHAND" },
  { pattern: /force\s*push/i, ability: "FORCE_PUSH" },
  { pattern: /electro\s*stun/i, ability: "ELECTRO_STUN" },
  { pattern: /seismic\s*grenade|seismic/i, ability: "SEISMIC_GRENADE" },
  { pattern: /intercede/i, ability: "INTERCEDE" },
  { pattern: /guard\s*swap|guard/i, ability: "GUARD" },
  { pattern: /force\s*leap|leap(?!\s*spam)/i, ability: "FORCE_LEAP" },
];

// ============================================================================
// TYPES
// ============================================================================

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

// ============================================================================
// GCD MANAGER CLASS
// ============================================================================

export class GCDManager {
  private gcdState: GCDState = {
    isActive: false,
    startedAt: 0,
    endsAt: 0,
    currentAbility: null,
  };

  /** Tracks when each ability was last used (for per-ability cooldowns) */
  private abilityCooldowns: Map<string, number> = new Map();

  /** Queue of pending GCD sequences (only most recent will execute) */
  private gcdQueue: QueuedSequence[] = [];

  /** Callback to execute a binding when GCD ends */
  private executeCallback: ((binding: MacroBinding) => void) | null = null;

  /** Timer for GCD expiration */
  private gcdTimer: NodeJS.Timeout | null = null;

  /** Shutdown flag */
  private isShutdown: boolean = false;

  /**
   * Per-ability cooldown tracking mode.
   * When false, only GCD is respected - individual ability cooldowns are ignored.
   * When true, abilities respect their in-game cooldowns (CB 7s, FS 11s, etc.)
   */
  private perAbilityCooldownsEnabled: boolean = true;

  constructor() {
    logger.info(
      `Initialized - GCD: ${GCD_DURATION_MS}ms, Abilities: ${GCD_ABILITIES.size}`,
    );
  }

  /**
   * Enable or disable per-ability cooldown tracking.
   * When disabled, only GCD (1.275s) is enforced between abilities.
   */
  setPerAbilityCooldownsEnabled(enabled: boolean): void {
    this.perAbilityCooldownsEnabled = enabled;
    if (enabled) {
      logger.info("Per-ability cooldowns ENABLED (CB 7s, FS 11s, etc.)");
    } else {
      logger.info("Per-ability cooldowns DISABLED (GCD only mode)");
      this.abilityCooldowns.clear(); // Clear any existing cooldowns
    }
  }

  /**
   * Check if per-ability cooldowns are enabled
   */
  isPerAbilityCooldownsEnabled(): boolean {
    return this.perAbilityCooldownsEnabled;
  }

  /**
   * Reset cooldowns for abilities with duration less than specified threshold.
   * Default threshold is 20000ms (20 seconds).
   * Returns the list of abilities that were reset.
   */
  resetShortCooldowns(maxDurationMs: number = 20000): string[] {
    const resetAbilities: string[] = [];

    for (const [ability, lastUsed] of this.abilityCooldowns) {
      const cooldownMs = ABILITY_COOLDOWNS_MS[ability];
      if (cooldownMs && cooldownMs < maxDurationMs) {
        // Check if this ability is actually on cooldown
        const elapsed = Date.now() - lastUsed;
        if (elapsed < cooldownMs) {
          resetAbilities.push(ability);
        }
      }
    }

    // Clear the cooldowns for short-duration abilities
    for (const ability of resetAbilities) {
      this.abilityCooldowns.delete(ability);
    }

    if (resetAbilities.length > 0) {
      logger.info(
        `Reset ${resetAbilities.length} short cooldowns: ${resetAbilities.join(", ")}`,
      );
    } else {
      logger.debug("No short cooldowns to reset");
    }

    return resetAbilities;
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Set the callback to execute bindings when GCD allows
   */
  setExecuteCallback(callback: (binding: MacroBinding) => void): void {
    this.executeCallback = callback;
  }

  /**
   * Detect the primary GCD ability in a macro binding by name pattern matching
   */
  detectGCDAbility(binding: MacroBinding): string | null {
    // First check if binding has explicit gcdAbility field
    if ((binding as any).gcdAbility) {
      return (binding as any).gcdAbility.toUpperCase();
    }

    // Fall back to name pattern matching
    const name = binding.name;

    for (const { pattern, ability } of ABILITY_NAME_PATTERNS) {
      if (pattern.test(name)) {
        return ability;
      }
    }

    return null;
  }

  /**
   * Check if a binding contains a GCD ability
   */
  isGCDBinding(binding: MacroBinding): boolean {
    return this.detectGCDAbility(binding) !== null;
  }

  /**
   * Check if the GCD is currently active
   */
  isGCDActive(): boolean {
    if (!this.gcdState.isActive) return false;

    // Check if GCD has expired
    if (Date.now() >= this.gcdState.endsAt) {
      this.gcdState.isActive = false;
      return false;
    }

    return true;
  }

  /**
   * Get remaining GCD time in milliseconds
   */
  getGCDRemaining(): number {
    if (!this.isGCDActive()) return 0;
    return Math.max(0, this.gcdState.endsAt - Date.now());
  }

  /**
   * Check if a specific ability is on its individual cooldown.
   * Always returns false if per-ability cooldowns are disabled.
   */
  isAbilityOnCooldown(abilityName: string): boolean {
    // If per-ability cooldowns are disabled, only GCD matters
    if (!this.perAbilityCooldownsEnabled) {
      return false;
    }

    const upperName = abilityName.toUpperCase();
    const lastUsed = this.abilityCooldowns.get(upperName);

    if (!lastUsed) return false;

    const cooldownMs = ABILITY_COOLDOWNS_MS[upperName];
    if (!cooldownMs) return false; // No specific cooldown for this ability

    const elapsed = Date.now() - lastUsed;
    return elapsed < cooldownMs;
  }

  /**
   * Get remaining cooldown time for an ability in milliseconds
   */
  getAbilityCooldownRemaining(abilityName: string): number {
    const upperName = abilityName.toUpperCase();
    const lastUsed = this.abilityCooldowns.get(upperName);

    if (!lastUsed) return 0;

    const cooldownMs = ABILITY_COOLDOWNS_MS[upperName];
    if (!cooldownMs) return 0;

    const elapsed = Date.now() - lastUsed;
    return Math.max(0, cooldownMs - elapsed);
  }

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
  } {
    if (this.isShutdown) {
      return { executed: false, queued: false, reason: "shutdown" };
    }

    const gcdAbility = this.detectGCDAbility(binding);

    // Non-GCD binding - execute immediately (bypass GCD system)
    if (!gcdAbility) {
      logger.debug(`Non-GCD: ${binding.name} - executing immediately`);
      this.executeNonGCDBinding(binding);
      return { executed: true, queued: false };
    }

    // GCD binding - check ability cooldown first
    if (this.isAbilityOnCooldown(gcdAbility)) {
      const remaining = this.getAbilityCooldownRemaining(gcdAbility);
      logger.debug(
        `${gcdAbility} on cooldown (${(remaining / 1000).toFixed(1)}s remaining)`,
      );

      // Still queue it - might become available by the time GCD processes
      if (this.isGCDActive()) {
        this.queueSequence(binding, gcdAbility);
        return {
          executed: false,
          queued: true,
          reason: `${gcdAbility} on cooldown, queued`,
        };
      }

      // GCD not active but ability on cooldown - skip
      return {
        executed: false,
        queued: false,
        reason: `${gcdAbility} on cooldown`,
      };
    }

    // Check if GCD is active
    if (this.isGCDActive()) {
      const remaining = this.getGCDRemaining();
      logger.debug(
        `GCD active (${remaining}ms remaining) - queueing ${binding.name}`,
      );
      this.queueSequence(binding, gcdAbility);
      return { executed: false, queued: true, reason: "GCD active" };
    }

    // GCD not active, ability not on cooldown - execute now
    logger.info(`Executing: ${binding.name} (${gcdAbility})`);
    this.executeGCDBinding(binding, gcdAbility);
    return { executed: true, queued: false };
  }

  /**
   * Get current stats for debugging/display
   */
  getStats(): GCDManagerStats {
    const abilitiesOnCooldown: string[] = [];

    for (const [ability] of this.abilityCooldowns) {
      if (this.isAbilityOnCooldown(ability)) {
        abilitiesOnCooldown.push(ability);
      }
    }

    return {
      gcdActive: this.isGCDActive(),
      gcdRemaining: this.getGCDRemaining(),
      queueSize: this.gcdQueue.length,
      currentAbility: this.gcdState.currentAbility,
      abilitiesOnCooldown,
    };
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    const count = this.gcdQueue.length;
    this.gcdQueue = [];
    if (count > 0) {
      logger.debug(`Cleared ${count} queued sequences`);
    }
  }

  /**
   * Reset all cooldowns (e.g., for testing or combat reset)
   */
  resetCooldowns(): void {
    this.abilityCooldowns.clear();
    this.gcdState = {
      isActive: false,
      startedAt: 0,
      endsAt: 0,
      currentAbility: null,
    };
    if (this.gcdTimer) {
      clearTimeout(this.gcdTimer);
      this.gcdTimer = null;
    }
    this.clearQueue();
    logger.info("All cooldowns reset");
  }

  /**
   * Shutdown the manager
   */
  shutdown(): void {
    this.isShutdown = true;
    if (this.gcdTimer) {
      clearTimeout(this.gcdTimer);
      this.gcdTimer = null;
    }
    this.clearQueue();
    logger.info("Shutdown complete");
  }

  // ==========================================================================
  // INTERNAL METHODS
  // ==========================================================================

  private queueSequence(binding: MacroBinding, gcdAbility: string): void {
    this.gcdQueue.push({
      binding,
      queuedAt: Date.now(),
      gcdAbility,
    });
    logger.debug(
      `Queued: ${binding.name} (${gcdAbility}) - queue size: ${this.gcdQueue.length}`,
    );
  }

  private executeGCDBinding(binding: MacroBinding, gcdAbility: string): void {
    // Start GCD timer
    this.startGCD(gcdAbility);

    // Execute via callback
    if (this.executeCallback) {
      this.executeCallback(binding);
    }
  }

  private executeNonGCDBinding(binding: MacroBinding): void {
    if (this.executeCallback) {
      this.executeCallback(binding);
    }
  }

  private startGCD(abilityName: string): void {
    const now = Date.now();
    const upperName = abilityName.toUpperCase();

    // Set GCD state
    this.gcdState = {
      isActive: true,
      startedAt: now,
      endsAt: now + GCD_DURATION_MS,
      currentAbility: upperName,
    };

    // Record ability usage for per-ability cooldown
    this.abilityCooldowns.set(upperName, now);

    logger.debug(`GCD started: ${upperName} (ends in ${GCD_DURATION_MS}ms)`);

    // Clear any existing timer
    if (this.gcdTimer) {
      clearTimeout(this.gcdTimer);
    }

    // Set timer to process queue when GCD ends
    this.gcdTimer = setTimeout(() => {
      this.onGCDEnd();
    }, GCD_DURATION_MS + 5); // Small buffer for timing precision
  }

  private onGCDEnd(): void {
    if (this.isShutdown) return;

    this.gcdState.isActive = false;
    this.gcdTimer = null;

    logger.debug(`GCD ended, processing queue (${this.gcdQueue.length} items)`);

    // Process the queue - execute most recent valid sequence
    this.processQueue();
  }

  /**
   * Process the queue when GCD ends.
   * Executes the most recently queued sequence that's not on cooldown.
   * Discards all other queued sequences.
   */
  private processQueue(): void {
    if (this.gcdQueue.length === 0) {
      return;
    }

    // Sort by queuedAt descending (most recent first)
    this.gcdQueue.sort((a, b) => b.queuedAt - a.queuedAt);

    logger.debug(
      `Processing queue: most recent = ${this.gcdQueue[0].binding.name}`,
    );

    // Find the most recent sequence that's not on cooldown
    for (const entry of this.gcdQueue) {
      if (!this.isAbilityOnCooldown(entry.gcdAbility)) {
        logger.info(
          `Executing queued: ${entry.binding.name} (${entry.gcdAbility})`,
        );

        // Clear queue first (discard all others)
        this.gcdQueue = [];

        // Execute this one
        this.executeGCDBinding(entry.binding, entry.gcdAbility);
        return;
      } else {
        const remaining = this.getAbilityCooldownRemaining(entry.gcdAbility);
        logger.debug(
          `Skipping ${entry.gcdAbility} - on cooldown (${(remaining / 1000).toFixed(1)}s)`,
        );
      }
    }

    // All queued abilities on cooldown - clear queue
    logger.debug("All queued abilities on cooldown, clearing queue");
    this.gcdQueue = [];
  }
}

// ============================================================================
// GESTURE FALLBACK LOGIC
// ============================================================================

/**
 * Get fallback gesture when the triggered gesture has no binding.
 *
 * Rules:
 * - If "long" triggered but unbound → try "super_long"
 * - If "super_long" triggered but unbound → try "long"
 *
 * Only applies to single/double/triple/quadruple tap variants.
 */
export function getGestureFallback(
  triggeredGesture: GestureType,
  hasBinding: (gesture: GestureType) => boolean,
): GestureType | null {
  // Extract base (single, double, triple, quadruple) and suffix
  const longMatch = triggeredGesture.match(
    /^(single|double|triple|quadruple)_long$/,
  );
  const superLongMatch = triggeredGesture.match(
    /^(single|double|triple|quadruple)_super_long$/,
  );

  if (longMatch) {
    // "long" triggered - try "super_long"
    const base = longMatch[1];
    const fallback = `${base}_super_long` as GestureType;
    if (hasBinding(fallback)) {
      return fallback;
    }
  } else if (superLongMatch) {
    // "super_long" triggered - try "long"
    const base = superLongMatch[1];
    const fallback = `${base}_long` as GestureType;
    if (hasBinding(fallback)) {
      return fallback;
    }
  }

  return null;
}

/**
 * Check if a binding is "empty" (placeholder with no real sequence)
 * Empty bindings have:
 * - Name containing "~"
 * - Empty sequence array
 * - Not enabled
 */
export function isEmptyBinding(
  binding: MacroBinding | OmegaMacroBinding | undefined | null,
): boolean {
  if (!binding) return true;
  if (!binding.enabled) return true;
  if (binding.name.includes("~")) return true;
  if (!binding.sequence || binding.sequence.length === 0) return true;
  return false;
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let gcdManagerInstance: GCDManager | null = null;

export function getGCDManager(): GCDManager {
  if (!gcdManagerInstance) {
    gcdManagerInstance = new GCDManager();
  }
  return gcdManagerInstance;
}

export function resetGCDManager(): void {
  if (gcdManagerInstance) {
    gcdManagerInstance.shutdown();
    gcdManagerInstance = null;
  }
}

export default GCDManager;
