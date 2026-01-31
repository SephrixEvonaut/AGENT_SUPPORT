// ============================================================================
// OMEGA MAPPINGS - Complete Input→Output Ability Mapping
// ============================================================================
//
// This module defines all gesture→output mappings for the Omega system.
// Uses 4 gesture types: quick, long, quick_toggle, long_toggle
//
// BUFFER TIER REFERENCE:
// - low:    129-163ms (same-category abilities, rapid fire)
// - medium: 229-263ms (after targeting, before abilities)
// - high:   513-667ms (major transitions, cooldowns)
//
// ICON SEQUENCING RULES:
// - 🎯 Cog (NUMPAD_SUBTRACT): AFTER targeting abilities
// - 🛡️ Shield (NUMPAD_MULTIPLY): AFTER guard (dual-key with L)
// - 🔫 Gun (NUMPAD_ADD): BEFORE focus target
//
// ============================================================================

import { MacroBinding, SequenceStep, InputKey, GCDAbilityType } from "./types.js";
import { OmegaGestureType } from "./omegaTypes.js";

// ============================================================================
// TYPES
// ============================================================================

export type BufferTier = "low" | "medium" | "high";

export interface OmegaSequenceStep {
  /** Output key (e.g., "N", "SHIFT+J", "NUMPAD_SUBTRACT") */
  key?: string;

  /** Buffer tier for delay before next step */
  bufferTier?: BufferTier;

  /** Custom delay range (overrides bufferTier) */
  minDelay?: number;
  maxDelay?: number;

  /** Echo hits for ability confirmation */
  echoHits?: { count: 2 | 3 | 4; windowMs: number };

  /** Hold through next step (for modifiers like SHIFT+R) */
  holdThroughNext?: boolean;
  releaseDelayMin?: number;
  releaseDelayMax?: number;

  /** Timer action */
  timer?: {
    id: string;
    durationSeconds: number;
    message: string;
  };

  /** Scroll action */
  scrollDirection?: "up" | "down";
  scrollMagnitude?: number;

  /** Step name for logging */
  name?: string;
}

export interface OmegaBinding {
  name: string;
  inputKey: InputKey;
  gesture: OmegaGestureType;
  sequence: OmegaSequenceStep[];
  enabled: boolean;
  gcdAbility?: GCDAbilityType;
}

export type OmegaBindingLookup = Map<
  InputKey,
  Map<OmegaGestureType, OmegaBinding>
>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function step(
  key: string,
  bufferTier: BufferTier = "low",
  opts: Partial<OmegaSequenceStep> = {},
): OmegaSequenceStep {
  return { key, bufferTier, ...opts };
}

function targetWithCog(targetKey: string): OmegaSequenceStep[] {
  return [step(targetKey, "medium"), step("NUMPAD_SUBTRACT", "low")];
}

function timerStep(
  id: string,
  durationSeconds: number,
  message: string,
): OmegaSequenceStep {
  return {
    timer: { id, durationSeconds, message },
    bufferTier: "low",
  };
}

function holdModifier(
  key: string,
  releaseDelayMin = 7,
  releaseDelayMax = 18,
): OmegaSequenceStep {
  return {
    key,
    bufferTier: "medium",
    holdThroughNext: true,
    releaseDelayMin,
    releaseDelayMax,
  };
}

function scrollStep(
  direction: "up" | "down",
  magnitude: number,
): OmegaSequenceStep {
  return {
    scrollDirection: direction,
    scrollMagnitude: magnitude,
    bufferTier: "low",
  };
}

// ============================================================================
// OMEGA BINDING DEFINITIONS
// ============================================================================

export const OMEGA_BINDINGS: OmegaBinding[] = [
  // ==========================================================================
  // KEY: 1
  // ==========================================================================
  {
    name: "Crushing Blow",
    inputKey: "1",
    gesture: "quick",
    sequence: [step("N", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
    gcdAbility: "CRUSHING_BLOW",
  },
  {
    name: "Close Enemy + Cog",
    inputKey: "1",
    gesture: "long",
    sequence: targetWithCog("Q"),
    enabled: true,
  },
  {
    name: "Crushing Blow (toggled)",
    inputKey: "1",
    gesture: "quick_toggle",
    sequence: [step("N", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
    gcdAbility: "CRUSHING_BLOW",
  },
  {
    name: "Close Enemy + Cog (toggled)",
    inputKey: "1",
    gesture: "long_toggle",
    sequence: targetWithCog("Q"),
    enabled: true,
  },

  // ==========================================================================
  // KEY: 2
  // ==========================================================================
  {
    name: "Force Scream",
    inputKey: "2",
    gesture: "quick",
    sequence: [step("O", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
    gcdAbility: "FORCE_SCREAM",
  },
  {
    name: "Sweeping Slash",
    inputKey: "2",
    gesture: "long",
    sequence: [
      step("SHIFT+J", "low", { echoHits: { count: 2, windowMs: 170 } }),
    ],
    enabled: true,
    gcdAbility: "SWEEPING_SLASH",
  },
  // 2 quick_toggle: none
  // 2 long_toggle: none

  // ==========================================================================
  // KEY: 3
  // ==========================================================================
  {
    name: "Aegis Assault",
    inputKey: "3",
    gesture: "quick",
    sequence: [step("Z", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
    gcdAbility: "AEGIS_ASSAULT",
  },
  {
    name: "Vicious Slash",
    inputKey: "3",
    gesture: "long",
    sequence: [step("SHIFT+L", "low")],
    enabled: true,
    gcdAbility: "VICIOUS_SLASH",
  },
  {
    name: "Mad Dash / Awe",
    inputKey: "3",
    gesture: "quick_toggle",
    sequence: [step("ALT+Q", "low")],
    enabled: true,
  },
  // 3 long_toggle: none

  // ==========================================================================
  // KEY: 4
  // ==========================================================================
  {
    name: "Interrupt",
    inputKey: "4",
    gesture: "quick",
    sequence: [step("K", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Close Enemy + Cog + Interrupt",
    inputKey: "4",
    gesture: "long",
    sequence: [
      step("Q", "medium"),
      step("NUMPAD_SUBTRACT", "low"),
      step("K", "low"),
    ],
    enabled: true,
  },
  {
    name: "Force Choke",
    inputKey: "4",
    gesture: "quick_toggle",
    sequence: [step("SHIFT+Z", "low")],
    enabled: true,
    gcdAbility: "FORCE_CHOKE",
  },
  {
    name: "Electro Stun Grenade",
    inputKey: "4",
    gesture: "long_toggle",
    sequence: [step("ALT+NUMPAD6", "low")],
    enabled: true,
    gcdAbility: "ELECTRO_STUN",
  },

  // ==========================================================================
  // KEY: 5
  // ==========================================================================
  {
    name: "Vicious Throw",
    inputKey: "5",
    gesture: "quick",
    sequence: [step("[", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
    gcdAbility: "VICIOUS_THROW",
  },
  {
    name: "Basic Attack",
    inputKey: "5",
    gesture: "long",
    sequence: [
      step("SHIFT+Q", "low", { echoHits: { count: 2, windowMs: 170 } }),
    ],
    enabled: true,
    gcdAbility: "BASIC_ATTACK",
  },
  {
    name: "Backhand",
    inputKey: "5",
    gesture: "quick_toggle",
    sequence: [step("ALT+R", "low")],
    enabled: true,
    gcdAbility: "BACKHAND",
  },
  {
    name: "Seismic Grenade",
    inputKey: "5",
    gesture: "long_toggle",
    sequence: [step("ALT+NUMPAD4", "low")],
    enabled: true,
    gcdAbility: "SEISMIC_GRENADE",
  },

  // ==========================================================================
  // KEY: 6 (Custom toggle thresholds: 415ms normal, 320ms toggled)
  // ==========================================================================
  {
    name: "Ravage",
    inputKey: "6",
    gesture: "quick",
    sequence: [
      step("SHIFT+K", "low", { echoHits: { count: 2, windowMs: 170 } }),
    ],
    enabled: true,
    gcdAbility: "RAVAGE",
  },
  {
    name: "Endure Pain + Drop Timer",
    inputKey: "6",
    gesture: "long",
    sequence: [step("SHIFT+,", "low"), timerStep("drop", 16, "drop")],
    enabled: true,
  },
  {
    name: "Force Push",
    inputKey: "6",
    gesture: "quick_toggle",
    sequence: [step("ALT+L", "low")],
    enabled: true,
    gcdAbility: "FORCE_PUSH",
  },
  {
    name: "Stun Break",
    inputKey: "6",
    gesture: "long_toggle",
    sequence: [step("SHIFT+V", "low")],
    enabled: true,
  },

  // ==========================================================================
  // KEY: W (Toggle activator at 260ms)
  // ==========================================================================
  {
    name: "Center Target + Cog",
    inputKey: "W",
    gesture: "quick",
    sequence: [step("SHIFT+O", "medium"), step("NUMPAD_SUBTRACT", "low")],
    enabled: true,
  },
  {
    name: "Next Friend + Cog",
    inputKey: "W",
    gesture: "quick_toggle",
    sequence: [step(".", "medium"), step("NUMPAD_SUBTRACT", "low")],
    enabled: true,
  },
  // W long/long_toggle: none (becomes toggle activator)

  // ==========================================================================
  // KEY: Y (Toggle activator at 308ms)
  // ==========================================================================
  {
    name: "Next Target + Cog",
    inputKey: "Y",
    gesture: "quick",
    sequence: [step("V", "medium"), step("NUMPAD_SUBTRACT", "low")],
    enabled: true,
  },
  {
    name: "Close Friend + Cog",
    inputKey: "Y",
    gesture: "quick_toggle",
    sequence: [step("'", "medium"), step("NUMPAD_SUBTRACT", "low")],
    enabled: true,
  },
  // Y long/long_toggle: none (becomes toggle activator)

  // ==========================================================================
  // KEY: A
  // ==========================================================================
  {
    name: "Leap",
    inputKey: "A",
    gesture: "quick",
    sequence: [step("F9", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
    gcdAbility: "FORCE_LEAP",
  },
  {
    name: "Single Taunt",
    inputKey: "A",
    gesture: "long",
    sequence: [step("F6", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Saber Throw",
    inputKey: "A",
    gesture: "quick_toggle",
    sequence: [step("SHIFT+M", "low")],
    enabled: true,
    gcdAbility: "SABER_THROW",
  },
  // A long_toggle: none

  // ==========================================================================
  // KEY: S (Dual-purpose: quick=Guard, long=Group Member Toggle)
  // Group member toggle intercepts handled by detector
  // ==========================================================================
  {
    name: "Guard + Shield",
    inputKey: "S",
    gesture: "quick",
    sequence: [
      { key: "L", bufferTier: "low", name: "Guard" },
      {
        key: "NUMPAD_MULTIPLY",
        minDelay: 4,
        maxDelay: 10,
        name: "Shield Icon (dual-key)",
      },
    ],
    enabled: true,
    gcdAbility: "GUARD",
  },
  // S long: Group Member Toggle (handled by detector, not a binding)
  // S quick_toggle / long_toggle: S ignores W/Y toggle system

  // ==========================================================================
  // KEY: D (Retaliate Accumulator - handled by detector)
  // No bindings needed - D key behavior is fully in omegaGestureDetector.ts
  // ==========================================================================

  // ==========================================================================
  // KEY: B
  // ==========================================================================
  {
    name: "Medpack",
    inputKey: "B",
    gesture: "quick",
    sequence: [step("ALT+O", "low")],
    enabled: true,
  },
  {
    name: "Endure Pain + Drop Timer + Medpack",
    inputKey: "B",
    gesture: "long",
    sequence: [
      step("SHIFT+,", "low"),
      timerStep("drop", 16, "drop"),
      step("ALT+O", "medium"),
    ],
    enabled: true,
  },
  {
    name: "Adrenal",
    inputKey: "B",
    gesture: "quick_toggle",
    sequence: [step("ALT+N", "low")],
    enabled: true,
  },
  // B long_toggle: none

  // ==========================================================================
  // KEY: I
  // ==========================================================================
  {
    name: "Gun Icon + Focus Target + Cog",
    inputKey: "I",
    gesture: "quick",
    sequence: [
      step("NUMPAD_ADD", "low", { name: "Gun Icon" }),
      step("X", "medium", { name: "Set Focus Target" }),
      step("NUMPAD_SUBTRACT", "low", { name: "Cog Icon" }),
    ],
    enabled: true,
  },
  {
    name: "Relic",
    inputKey: "I",
    gesture: "long",
    sequence: [step("SHIFT+X", "low")],
    enabled: true,
  },
  {
    name: "Focus Mod + Single Taunt",
    inputKey: "I",
    gesture: "quick_toggle",
    sequence: [holdModifier("SHIFT+R"), step("F6", "low")],
    enabled: true,
  },
  {
    name: "Mass Taunt + Focus Mod + Single Taunt + Enrage",
    inputKey: "I",
    gesture: "long_toggle",
    sequence: [
      step("F7", "low", { name: "Mass Taunt" }),
      holdModifier("SHIFT+R"),
      step("F6", "medium", { name: "Single Taunt (to focus)" }),
      {
        key: "F8",
        minDelay: 1200,
        maxDelay: 1300,
        name: "Enrage (1.3s delay)",
      },
    ],
    enabled: true,
  },

  // ==========================================================================
  // KEY: T
  // ==========================================================================
  {
    name: "Previous Target + Cog",
    inputKey: "T",
    gesture: "quick",
    sequence: [step("SHIFT+N", "medium"), step("NUMPAD_SUBTRACT", "low")],
    enabled: true,
  },
  {
    name: "Previous Friend + Cog",
    inputKey: "T",
    gesture: "long",
    sequence: [step("ALT+.", "medium"), step("NUMPAD_SUBTRACT", "low")],
    enabled: true,
  },
  {
    name: "Target of Target + Cog",
    inputKey: "T",
    gesture: "quick_toggle",
    sequence: [step("M", "medium"), step("NUMPAD_SUBTRACT", "low")],
    enabled: true,
  },
  {
    name: "Focus Target's Target of Target + Cog",
    inputKey: "T",
    gesture: "long_toggle",
    sequence: [step("J", "medium"), step("NUMPAD_SUBTRACT", "low")],
    enabled: true,
  },

  // ==========================================================================
  // KEY: U
  // ==========================================================================
  {
    name: "Saber Ward",
    inputKey: "U",
    gesture: "quick",
    sequence: [step(",", "low")],
    enabled: true,
  },
  {
    name: "Invincible",
    inputKey: "U",
    gesture: "long",
    sequence: [step("ALT+M", "low")],
    enabled: true,
  },
  {
    name: "Enraged Defense",
    inputKey: "U",
    gesture: "quick_toggle",
    sequence: [step("SHIFT+.", "low")],
    enabled: true,
  },
  // U long_toggle: none

  // ==========================================================================
  // KEY: H
  // ==========================================================================
  {
    name: "Intercede",
    inputKey: "H",
    gesture: "quick",
    sequence: [step(";", "low")],
    enabled: true,
    gcdAbility: "INTERCEDE",
  },
  // H long, quick_toggle, long_toggle: none

  // ==========================================================================
  // KEY: C (Quick/Long + Double-tap ESCAPE)
  // Double-tap handled by detector's special output callback
  // ==========================================================================
  {
    name: "Burst Timer (13s)",
    inputKey: "C",
    gesture: "quick",
    sequence: [timerStep("burst", 13, "burst")],
    enabled: true,
  },
  {
    name: "Laze Timer (31s)",
    inputKey: "C",
    gesture: "long",
    sequence: [timerStep("laze", 31, "laze")],
    enabled: true,
  },
  {
    name: "Yield Timer (45s)",
    inputKey: "C",
    gesture: "quick_toggle",
    sequence: [timerStep("yield", 45, "yield")],
    enabled: true,
  },
  {
    name: "Fuel Timer (103s)",
    inputKey: "C",
    gesture: "long_toggle",
    sequence: [timerStep("fuel", 103, "fuel")],
    enabled: true,
  },
  // C double-tap: ESCAPE (handled by detector special key callback)

  // ==========================================================================
  // KEY: = (Gap-based only)
  // ==========================================================================
  // = single: none
  {
    name: "Smash",
    inputKey: "=",
    gesture: "quick", // Maps from double-tap detection
    sequence: [step("]", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
    gcdAbility: "SMASH",
  },

  // ==========================================================================
  // KEY: F2 (Gap-based only)
  // ==========================================================================
  // F2 single: none
  // F2 double: none (no binding assigned yet)

  // ==========================================================================
  // KEY: MIDDLE_CLICK
  // ==========================================================================
  {
    name: "Max Zoom In + Delay + Scroll Out",
    inputKey: "MIDDLE_CLICK",
    gesture: "quick",
    sequence: [
      step("CTRL+V", "low", { name: "Max Zoom In" }),
      { minDelay: 420, maxDelay: 480, name: "Zoom delay" },
      scrollStep("down", 20),
    ],
    enabled: true,
  },
  {
    name: "Scroll In (20 ticks)",
    inputKey: "MIDDLE_CLICK",
    gesture: "long",
    sequence: [scrollStep("up", 20)],
    enabled: true,
  },
  // MIDDLE_CLICK quick_toggle / long_toggle: none
  // MIDDLE_CLICK double-tap: Max Zoom Out (would need detector support)
];

// ============================================================================
// BINDING LOOKUP BUILDER
// ============================================================================

/**
 * Build a lookup map for fast gesture→binding resolution
 */
export function buildOmegaBindingLookup(
  bindings: OmegaBinding[] = OMEGA_BINDINGS,
): OmegaBindingLookup {
  const lookup: OmegaBindingLookup = new Map();

  for (const binding of bindings) {
    if (!binding.enabled) continue;

    let keyMap = lookup.get(binding.inputKey);
    if (!keyMap) {
      keyMap = new Map();
      lookup.set(binding.inputKey, keyMap);
    }

    keyMap.set(binding.gesture, binding);
  }

  return lookup;
}

/**
 * Get a binding for a specific key and gesture
 */
export function getOmegaBinding(
  lookup: OmegaBindingLookup,
  inputKey: InputKey,
  gesture: OmegaGestureType,
): OmegaBinding | null {
  const keyMap = lookup.get(inputKey);
  if (!keyMap) return null;
  return keyMap.get(gesture) ?? null;
}

/**
 * Convert OmegaBinding to MacroBinding for executor compatibility
 */
export function omegaBindingToMacro(binding: OmegaBinding): MacroBinding {
  const sequence: SequenceStep[] = binding.sequence.map((step) => {
    const result: SequenceStep = {
      key: step.key || "",
      minDelay: step.minDelay ?? 0,
      maxDelay: step.maxDelay ?? 0,
    };

    if (step.bufferTier) {
      result.bufferTier = step.bufferTier;
    }

    if (step.echoHits) {
      result.echoHits = step.echoHits;
    }

    if (step.holdThroughNext) {
      result.holdThroughNext = step.holdThroughNext;
      result.releaseDelayMin = step.releaseDelayMin;
      result.releaseDelayMax = step.releaseDelayMax;
    }

    if (step.timer) {
      // Timer steps use the timer field
      result.timer = step.timer;
    }

    if (step.scrollDirection) {
      result.scrollDirection = step.scrollDirection;
      result.scrollMagnitude = step.scrollMagnitude;
    }

    if (step.name) {
      result.name = step.name;
    }

    return result;
  });

  return {
    name: binding.name,
    sequence,
    enabled: binding.enabled,
    gcdAbility: binding.gcdAbility,
  };
}

// ============================================================================
// PROFILE EXPORT
// ============================================================================

/**
 * Export all bindings as a JSON profile
 */
export function exportOmegaProfile(): object {
  return {
    name: "SWTOR Vengeance Juggernaut - Omega Profile",
    description:
      "Omega gesture system with 4-gesture detection (quick/long/quick_toggle/long_toggle)",
    system: "omega",
    gestureSettings: {
      multiPressWindow: 355,
      debounceDelay: 10,
      cancelThreshold: 1500,
    },
    keyThresholds: {
      "1": 312,
      "2": 408,
      "3": 355,
      "4": 298,
      "5": 470,
      "6": { normal: 415, toggled: 320 },
      W: 260,
      A: 251,
      S: 512,
      B: 391,
      I: 597,
      Y: 308,
      U: 558,
      T: 238,
      C: 349,
      H: 452,
      MIDDLE_CLICK: 442,
    },
    specialKeys: {
      D: {
        type: "retaliate_accumulator",
        triggerKeys: ["E", "F", "G", "NUMPAD8", "1", "2", "3", "4", "5", "6"],
      },
      S: {
        type: "dual_purpose",
        quickThreshold: 512,
        longBehavior: "group_member_toggle",
      },
      C: { type: "hybrid", doubleWindow: 337, doubleOutput: "ESCAPE" },
      "=": { type: "gap_based", window: 419 },
      F2: { type: "gap_based", window: 307 },
    },
    toggleActivators: {
      W: { threshold: 260 },
      Y: { threshold: 308 },
    },
    bindings: OMEGA_BINDINGS.map((b) => ({
      inputKey: b.inputKey,
      gesture: b.gesture,
      name: b.name,
      sequence: b.sequence,
      enabled: b.enabled,
      gcdAbility: b.gcdAbility,
    })),
  };
}

// ============================================================================
// STATISTICS
// ============================================================================

export function getOmegaStats(): {
  totalBindings: number;
  byKey: Record<string, number>;
  byGesture: Record<string, number>;
  gcdAbilities: string[];
} {
  const byKey: Record<string, number> = {};
  const byGesture: Record<string, number> = {};
  const gcdAbilities: string[] = [];

  for (const binding of OMEGA_BINDINGS) {
    byKey[binding.inputKey] = (byKey[binding.inputKey] || 0) + 1;
    byGesture[binding.gesture] = (byGesture[binding.gesture] || 0) + 1;

    if (binding.gcdAbility && !gcdAbilities.includes(binding.gcdAbility)) {
      gcdAbilities.push(binding.gcdAbility);
    }
  }

  return {
    totalBindings: OMEGA_BINDINGS.length,
    byKey,
    byGesture,
    gcdAbilities,
  };
}

export default OMEGA_BINDINGS;
