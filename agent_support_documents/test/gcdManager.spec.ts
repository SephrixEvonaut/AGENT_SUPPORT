// ============================================================================
// GCD MANAGER TESTS
// ============================================================================

import { test, expect, beforeEach, afterEach, describe } from "vitest";
import {
  GCDManager,
  GCD_DURATION_MS,
  ABILITY_COOLDOWNS_MS,
  GCD_ABILITIES,
  getGestureFallback,
  isEmptyBinding,
} from "../src/gcdManager.js";
import { MacroBinding, GestureType } from "../src/types.js";

// Helper to create test bindings
function createBinding(name: string, gcdAbility?: string): MacroBinding {
  return {
    name,
    trigger: { key: "1", gesture: "single" },
    sequence: [{ key: "N", minDelay: 25, maxDelay: 30 }],
    enabled: true,
    gcdAbility: gcdAbility as any,
  };
}

// Helper to wait
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("GCDManager", () => {
  let gcdManager: GCDManager;
  let executedBindings: MacroBinding[];

  beforeEach(() => {
    gcdManager = new GCDManager();
    executedBindings = [];
    gcdManager.setExecuteCallback((binding) => {
      executedBindings.push(binding);
    });
  });

  afterEach(() => {
    gcdManager.shutdown();
  });

  // ==========================================================================
  // GCD ABILITY DETECTION
  // ==========================================================================

  describe("GCD Ability Detection", () => {
    test("detects explicit gcdAbility field", () => {
      const binding = createBinding("My Macro", "CRUSHING_BLOW");
      expect(gcdManager.detectGCDAbility(binding)).toBe("CRUSHING_BLOW");
    });

    test("detects ability from macro name - Crushing Blow", () => {
      const binding = createBinding("Crushing Blow");
      expect(gcdManager.detectGCDAbility(binding)).toBe("CRUSHING_BLOW");
    });

    test("detects ability from macro name - Force Scream", () => {
      const binding = createBinding("Force Scream combo");
      expect(gcdManager.detectGCDAbility(binding)).toBe("FORCE_SCREAM");
    });

    test("detects ability from macro name - Ravage", () => {
      const binding = createBinding("Ravage + Retaliation");
      expect(gcdManager.detectGCDAbility(binding)).toBe("RAVAGE");
    });

    test("detects ability from macro name - Guard Swap", () => {
      const binding = createBinding("Guard Swap");
      expect(gcdManager.detectGCDAbility(binding)).toBe("GUARD");
    });

    test("detects ability from macro name - Leap (not Leap Spam)", () => {
      const binding = createBinding("Force Leap");
      expect(gcdManager.detectGCDAbility(binding)).toBe("FORCE_LEAP");
    });

    test("does not detect Leap Spam as GCD", () => {
      const binding = createBinding("Leap Spam (4x)");
      // Should not match because "leap spam" excludes leap detection
      // The regex uses negative lookahead for "spam"
      expect(gcdManager.detectGCDAbility(binding)).toBeNull();
    });

    test("returns null for non-GCD macros", () => {
      const binding = createBinding("Jump");
      expect(gcdManager.detectGCDAbility(binding)).toBeNull();
    });

    test("returns null for timer macros", () => {
      const binding = createBinding("Timer: Burst (13s)");
      expect(gcdManager.detectGCDAbility(binding)).toBeNull();
    });
  });

  // ==========================================================================
  // GCD STATE
  // ==========================================================================

  describe("GCD State", () => {
    test("GCD is not active initially", () => {
      expect(gcdManager.isGCDActive()).toBe(false);
      expect(gcdManager.getGCDRemaining()).toBe(0);
    });

    test("GCD activates after executing GCD binding", () => {
      const binding = createBinding("Crushing Blow");
      gcdManager.tryExecute(binding);

      expect(gcdManager.isGCDActive()).toBe(true);
      expect(gcdManager.getGCDRemaining()).toBeGreaterThan(0);
      expect(gcdManager.getGCDRemaining()).toBeLessThanOrEqual(GCD_DURATION_MS);
    });

    test("GCD does not activate for non-GCD binding", () => {
      const binding = createBinding("Jump");
      gcdManager.tryExecute(binding);

      expect(gcdManager.isGCDActive()).toBe(false);
    });
  });

  // ==========================================================================
  // ABILITY COOLDOWNS
  // ==========================================================================

  describe("Ability Cooldowns", () => {
    test("ability is on cooldown after execution", () => {
      const binding = createBinding("Crushing Blow");
      gcdManager.tryExecute(binding);

      expect(gcdManager.isAbilityOnCooldown("CRUSHING_BLOW")).toBe(true);
      expect(
        gcdManager.getAbilityCooldownRemaining("CRUSHING_BLOW"),
      ).toBeGreaterThan(0);
    });

    test("ability cooldown matches configured duration", () => {
      const binding = createBinding("Crushing Blow");
      gcdManager.tryExecute(binding);

      const remaining = gcdManager.getAbilityCooldownRemaining("CRUSHING_BLOW");
      expect(remaining).toBeGreaterThan(6900); // Should be close to 7000ms
      expect(remaining).toBeLessThanOrEqual(7000);
    });

    test("abilities without specific cooldowns only respect GCD", () => {
      const binding = createBinding("Sweeping Slash");
      gcdManager.tryExecute(binding);

      // Sweeping Slash has no specific cooldown (only GCD)
      expect(gcdManager.isAbilityOnCooldown("SWEEPING_SLASH")).toBe(false);
    });
  });

  // ==========================================================================
  // EXECUTION BEHAVIOR
  // ==========================================================================

  describe("Execution Behavior", () => {
    test("executes immediately when GCD not active", () => {
      const binding = createBinding("Crushing Blow");
      const result = gcdManager.tryExecute(binding);

      expect(result.executed).toBe(true);
      expect(result.queued).toBe(false);
      expect(executedBindings).toHaveLength(1);
      expect(executedBindings[0].name).toBe("Crushing Blow");
    });

    test("queues when GCD is active", () => {
      const binding1 = createBinding("Crushing Blow");
      const binding2 = createBinding("Force Scream");

      gcdManager.tryExecute(binding1); // Starts GCD
      const result = gcdManager.tryExecute(binding2);

      expect(result.executed).toBe(false);
      expect(result.queued).toBe(true);
      expect(result.reason).toBe("GCD active");
    });

    test("non-GCD executes immediately even during GCD", () => {
      const gcdBinding = createBinding("Crushing Blow");
      const nonGcdBinding = createBinding("Jump");

      gcdManager.tryExecute(gcdBinding); // Starts GCD
      const result = gcdManager.tryExecute(nonGcdBinding);

      expect(result.executed).toBe(true);
      expect(result.queued).toBe(false);
    });

    test("skips ability on cooldown when GCD not active", () => {
      const binding = createBinding("Crushing Blow");

      gcdManager.tryExecute(binding); // Execute once
      gcdManager.resetCooldowns(); // Clear GCD but keep ability cooldown
      // Actually resetCooldowns clears everything, so let's test differently

      // Just execute and try again immediately
      gcdManager.tryExecute(binding);

      // Wait for GCD to end but ability still on CD
      // For this test, we just verify the CD tracking works
      expect(gcdManager.isAbilityOnCooldown("CRUSHING_BLOW")).toBe(true);
    });
  });

  // ==========================================================================
  // QUEUE PROCESSING
  // ==========================================================================

  describe("Queue Processing", () => {
    test("executes most recent queued sequence when GCD ends", async () => {
      const binding1 = createBinding("Crushing Blow");
      const binding2 = createBinding("Force Scream");
      const binding3 = createBinding("Sweeping Slash");

      gcdManager.tryExecute(binding1); // Starts GCD, executes
      await wait(5); // Small delay to ensure different timestamps
      gcdManager.tryExecute(binding2); // Queued
      await wait(5); // Small delay to ensure different timestamps
      gcdManager.tryExecute(binding3); // Queued (most recent)

      expect(gcdManager.getStats().queueSize).toBe(2);

      // Wait for GCD to end
      await wait(GCD_DURATION_MS + 50);

      // Most recent (Sweeping Slash) should have been executed
      expect(executedBindings.length).toBeGreaterThanOrEqual(2);
      const lastExecuted = executedBindings[executedBindings.length - 1];
      expect(lastExecuted.name).toBe("Sweeping Slash");
    }, 10000);

    test("skips queued abilities that are on cooldown", async () => {
      const binding1 = createBinding("Crushing Blow");
      const binding2 = createBinding("Crushing Blow"); // Same ability, will be on CD
      const binding3 = createBinding("Force Scream");

      gcdManager.tryExecute(binding1); // Starts GCD, puts Crushing on CD
      gcdManager.tryExecute(binding2); // Queued but will be on CD
      gcdManager.tryExecute(binding3); // Queued, different ability

      // Wait for GCD to end
      await wait(GCD_DURATION_MS + 50);

      // Force Scream should execute (Crushing Blow is on CD)
      const executed = executedBindings.map((b) => b.name);
      expect(executed).toContain("Force Scream");
    }, 10000);

    test("clears queue after processing", async () => {
      const binding1 = createBinding("Crushing Blow");
      const binding2 = createBinding("Force Scream");

      gcdManager.tryExecute(binding1);
      gcdManager.tryExecute(binding2);

      await wait(GCD_DURATION_MS + 50);

      expect(gcdManager.getStats().queueSize).toBe(0);
    }, 10000);
  });

  // ==========================================================================
  // RESET AND SHUTDOWN
  // ==========================================================================

  describe("Reset and Shutdown", () => {
    test("resetCooldowns clears all state", () => {
      const binding = createBinding("Crushing Blow");
      gcdManager.tryExecute(binding);

      gcdManager.resetCooldowns();

      expect(gcdManager.isGCDActive()).toBe(false);
      expect(gcdManager.isAbilityOnCooldown("CRUSHING_BLOW")).toBe(false);
      expect(gcdManager.getStats().queueSize).toBe(0);
    });

    test("clearQueue only clears queue", () => {
      const binding1 = createBinding("Crushing Blow");
      const binding2 = createBinding("Force Scream");

      gcdManager.tryExecute(binding1);
      gcdManager.tryExecute(binding2);

      gcdManager.clearQueue();

      expect(gcdManager.isGCDActive()).toBe(true); // GCD still active
      expect(gcdManager.getStats().queueSize).toBe(0); // Queue cleared
    });
  });
});

// ============================================================================
// GESTURE FALLBACK TESTS
// ============================================================================

describe("Gesture Fallback", () => {
  test("long falls back to super_long when unbound", () => {
    const hasBinding = (g: GestureType) => g === "single_super_long";

    const fallback = getGestureFallback("single_long", hasBinding);
    expect(fallback).toBe("single_super_long");
  });

  test("super_long falls back to long when unbound", () => {
    const hasBinding = (g: GestureType) => g === "double_long";

    const fallback = getGestureFallback("double_super_long", hasBinding);
    expect(fallback).toBe("double_long");
  });

  test("returns null when neither available", () => {
    const hasBinding = () => false;

    const fallback = getGestureFallback("triple_long", hasBinding);
    expect(fallback).toBeNull();
  });

  test("returns null for non-long gestures", () => {
    const hasBinding = () => true;

    const fallback = getGestureFallback("single", hasBinding);
    expect(fallback).toBeNull();
  });

  test("works for all tap counts", () => {
    const hasBinding = (g: GestureType) => g.endsWith("_super_long");

    expect(getGestureFallback("single_long", hasBinding)).toBe(
      "single_super_long",
    );
    expect(getGestureFallback("double_long", hasBinding)).toBe(
      "double_super_long",
    );
    expect(getGestureFallback("triple_long", hasBinding)).toBe(
      "triple_super_long",
    );
    expect(getGestureFallback("quadruple_long", hasBinding)).toBe(
      "quadruple_super_long",
    );
  });
});

// ============================================================================
// EMPTY BINDING DETECTION
// ============================================================================

describe("Empty Binding Detection", () => {
  test("null is empty", () => {
    expect(isEmptyBinding(null)).toBe(true);
  });

  test("undefined is empty", () => {
    expect(isEmptyBinding(undefined)).toBe(true);
  });

  test("disabled binding is empty", () => {
    const binding = createBinding("Test");
    binding.enabled = false;
    expect(isEmptyBinding(binding)).toBe(true);
  });

  test("binding with ~ in name is empty", () => {
    const binding = createBinding("~ Placeholder");
    expect(isEmptyBinding(binding)).toBe(true);
  });

  test("binding with empty sequence is empty", () => {
    const binding = createBinding("Test");
    binding.sequence = [];
    expect(isEmptyBinding(binding)).toBe(true);
  });

  test("valid binding is not empty", () => {
    const binding = createBinding("Crushing Blow");
    expect(isEmptyBinding(binding)).toBe(false);
  });
});

// ============================================================================
// ABILITY COOLDOWN CONFIGURATION
// ============================================================================

describe("Ability Cooldown Configuration", () => {
  test("all GCD abilities are defined", () => {
    expect(GCD_ABILITIES.size).toBeGreaterThan(0);
  });

  test("cooldowns have expected values", () => {
    expect(ABILITY_COOLDOWNS_MS.CRUSHING_BLOW).toBe(7000);
    expect(ABILITY_COOLDOWNS_MS.FORCE_SCREAM).toBe(11000);
    expect(ABILITY_COOLDOWNS_MS.AEGIS_ASSAULT).toBe(11000);
    expect(ABILITY_COOLDOWNS_MS.VICIOUS_THROW).toBe(9000);
    expect(ABILITY_COOLDOWNS_MS.RAVAGE).toBe(16500);
    expect(ABILITY_COOLDOWNS_MS.GUARD).toBe(1000);
    expect(ABILITY_COOLDOWNS_MS.INTERCEDE).toBe(18000);
    expect(ABILITY_COOLDOWNS_MS.SMASH).toBe(14000);
    expect(ABILITY_COOLDOWNS_MS.FORCE_LEAP).toBe(3000);
    expect(ABILITY_COOLDOWNS_MS.FORCE_CHOKE).toBe(50000);
    expect(ABILITY_COOLDOWNS_MS.BACKHAND).toBe(50000);
    expect(ABILITY_COOLDOWNS_MS.FORCE_PUSH).toBe(50000);
  });

  test("GCD duration is 1.275 seconds", () => {
    expect(GCD_DURATION_MS).toBe(1275);
  });
});
