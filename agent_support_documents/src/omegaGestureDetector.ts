// ============================================================================
// OMEGA GESTURE DETECTOR - Enhanced with Special Key Behaviors
// ============================================================================
//
// ARCHITECTURE:
// - 4 base gestures: quick, long, quick_toggle, long_toggle
// - Long gestures fire IMMEDIATELY when threshold is crossed (no keyUp wait)
// - W and Y act as toggle activators (first to cross threshold wins)
// - Per-key calibrated thresholds
//
// SPECIAL KEY BEHAVIORS:
// - D: Retaliate Accumulator (counts trigger keys, outputs R for each)
// - S: Dual-purpose (quick=Guard, long=Group Member Toggle)
// - C: Quick/long + double-tap ESCAPE detection
// - =: Gap-based only (tap count, ignores hold duration)
// - F2: Gap-based only (tap count, ignores hold duration)
// - 6: Custom threshold based on toggle state (415ms vs 320ms)
// - W/Y: Toggle activators with quick fallback if released early
//
// ============================================================================

import { InputKey, GestureSettings, INPUT_KEYS } from "./types.js";
import {
  OmegaGestureType,
  OmegaGestureEvent,
  OmegaGestureCallback,
  OmegaState,
  ActiveKeyState,
  OmegaConfig,
  DEFAULT_OMEGA_CONFIG,
  IGestureDetector,
  createInitialOmegaState,
  getKeyThreshold,
  isToggleKey,
  TOGGLE_KEYS,
  OMEGA_KEY_THRESHOLDS,
} from "./omegaTypes.js";
import { performance } from "perf_hooks";

// ============================================================================
// SPECIAL KEY CONSTANTS
// ============================================================================

/** D key trigger keys that count toward Retaliate accumulator */
const D_TRIGGER_KEYS = new Set<string>([
  "E",
  "F",
  "G",
  "1",
  "2",
]);

/** Temporary input keys only active during D hold */
const D_ONLY_INPUT_KEYS = new Set<string>(["E", "F", "G"]);

/** S key group member toggle outputs: key -> [target key, then NUMPAD_SUBTRACT] */
const S_GROUP_MEMBER_OUTPUTS: Record<string, [string, string]> = {
  "1": ["NUMPAD1", "NUMPAD_SUBTRACT"],
  "2": ["NUMPAD2", "NUMPAD_SUBTRACT"],
  "3": ["NUMPAD3", "NUMPAD_SUBTRACT"],
  "4": ["NUMPAD7", "NUMPAD_SUBTRACT"],
};

/** Keys that intercept during S group member toggle */
const S_INTERCEPT_KEYS = new Set<string>(["1", "2", "3", "4"]);

/** C key multi-press window for double-tap detection */
const C_MULTIPRESS_WINDOW = 337;

/** = key multi-press window (gap-based only) */
const EQUALS_MULTIPRESS_WINDOW = 419;

/** F2 key multi-press window (gap-based only) */
const F2_MULTIPRESS_WINDOW = 307;

/** Key 6 thresholds */
const KEY_6_NORMAL_THRESHOLD = 415;
const KEY_6_TOGGLE_THRESHOLD = 320;

// ============================================================================
// EXTENDED STATE INTERFACES
// ============================================================================

/**
 * D key accumulator state
 */
interface DKeyAccumulatorState {
  active: boolean;
  startTime: number;
  count: number;  // Total count for logging
  pendingROutputs: number;
  // Cycle tracking: max 7 Rs per 2.85s cycle
  cycleStartTime: number;  // When current 7-R cycle started
  cycleCount: number;       // Rs sent in current cycle (max 7)
}

/** D accumulator constants */
const D_MAX_RS_PER_CYCLE = 7;
const D_CYCLE_REFRESH_MS = 2850;  // 2.85 seconds

/**
 * S key group member toggle state
 */
interface SKeyToggleState {
  active: boolean;
  startTime: number | null;
}

/**
 * Gap-based detection state (for =, F2)
 */
interface GapBasedState {
  tapCount: number;
  lastTapTime: number;
  windowTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * C key hybrid state (quick/long + double-tap)
 */
interface CKeyState {
  tapCount: number;
  lastTapTime: number;
  windowTimer: ReturnType<typeof setTimeout> | null;
  pendingQuick: boolean;
}

/**
 * Extended Omega state with special key tracking
 */
interface ExtendedOmegaState extends OmegaState {
  dKey: DKeyAccumulatorState;
  sKey: SKeyToggleState;
  cKey: CKeyState;
  equalsKey: GapBasedState;
  f2Key: GapBasedState;
}

/**
 * Create extended initial state
 */
function createExtendedOmegaState(): ExtendedOmegaState {
  return {
    ...createInitialOmegaState(),
    dKey: {
      active: false,
      startTime: 0,
      count: 0,
      pendingROutputs: 0,
      cycleStartTime: 0,
      cycleCount: 0,
    },
    sKey: {
      active: false,
      startTime: null,
    },
    cKey: {
      tapCount: 0,
      lastTapTime: 0,
      windowTimer: null,
      pendingQuick: false,
    },
    equalsKey: {
      tapCount: 0,
      lastTapTime: 0,
      windowTimer: null,
    },
    f2Key: {
      tapCount: 0,
      lastTapTime: 0,
      windowTimer: null,
    },
  };
}

// ============================================================================
// SPECIAL KEY OUTPUT EVENT
// ============================================================================

/**
 * Special output event for direct key emission (bypasses gesture system)
 */
export interface SpecialKeyOutputEvent {
  type: "direct_output";
  keys: string[];
  timings?: {
    keyDownMs: [number, number];
    gapMs: [number, number];
  };
  source: "d_retaliate" | "d_release" | "s_group_member" | "c_escape" | "equals_smash";
}

export type SpecialKeyCallback = (event: SpecialKeyOutputEvent) => void;

// ============================================================================
// OMEGA GESTURE DETECTOR CLASS (ENHANCED)
// ============================================================================

export class OmegaGestureDetector implements IGestureDetector {
  // Core state
  private state: ExtendedOmegaState;
  private config: OmegaConfig;
  private globalSettings: GestureSettings;
  private keySpecificSettings: Map<InputKey, GestureSettings> = new Map();

  // Callbacks
  private gestureCallback: OmegaGestureCallback;
  private specialKeyCallback: SpecialKeyCallback | null = null;
  private listeners: Set<OmegaGestureCallback> = new Set();

  // Timers and intervals
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private pendingQuickTimers: Map<InputKey, ReturnType<typeof setTimeout>> =
    new Map();

  // Event queue for burst handling
  private eventQueue: Array<{
    type: "down" | "up";
    key: string;
    timestamp: number;
  }> = [];
  private processingQueue: boolean = false;

  // Shutdown flag
  private isStopped: boolean = false;

  constructor(
    settings: GestureSettings,
    gestureCallback: OmegaGestureCallback,
    config?: Partial<OmegaConfig>,
    specialKeyCallback?: SpecialKeyCallback,
  ) {
    this.globalSettings = settings;
    this.gestureCallback = gestureCallback;
    this.specialKeyCallback = specialKeyCallback || null;
    this.config = { ...DEFAULT_OMEGA_CONFIG, ...config };
    this.state = createExtendedOmegaState();

    // Start the high-frequency interval for checking thresholds
    this.startCheckInterval();
  }

  /**
   * Set callback for special key outputs (D retaliate, S group member, etc.)
   */
  setSpecialKeyCallback(callback: SpecialKeyCallback): void {
    this.specialKeyCallback = callback;
  }

  // ==========================================================================
  // INTERVAL MANAGEMENT
  // ==========================================================================

  private startCheckInterval(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      if (this.isStopped) return;
      this.checkAllThresholds();
    }, this.config.checkIntervalMs);
  }

  /**
   * Check all active key holds for threshold crossing
   */
  private checkAllThresholds(): void {
    const now = performance.now();

    // Check S key for group member toggle activation
    this.checkSKeyToggleActivation(now);

    // Check standard keys for long-press threshold crossing
    for (const [key, keyState] of this.state.activeKeyDowns) {
      // Skip special handling keys (D, S, =, F2 have custom logic)
      if (key === "D" || key === "S" || key === "=" || key === "F2") continue;

      // Skip toggle keys (W, Y) - they use checkToggleActivation instead
      if (key === "W" || key === "Y") continue;

      // Skip if long already fired
      if (keyState.longFired) continue;

      // C key has special handling
      if (key === "C") {
        this.checkCKeyLongPress(now, keyState);
        continue;
      }

      // Standard long-press detection
      const holdDuration = now - keyState.startTime;
      const isToggled = this.state.toggleActive && !isToggleKey(key);
      const threshold = this.getEffectiveThreshold(key, isToggled);

      if (holdDuration >= threshold) {
        this.fireLongGesture(key, holdDuration, isToggled);
      }
    }

    // Check toggle activators for toggle activation
    this.checkToggleActivation(now);
  }

  /**
   * Get effective threshold for a key, accounting for special cases
   */
  private getEffectiveThreshold(key: InputKey, isToggled: boolean): number {
    // Key 6 has custom thresholds based on toggle state
    if (key === "6") {
      return isToggled ? KEY_6_TOGGLE_THRESHOLD : KEY_6_NORMAL_THRESHOLD;
    }

    // Use standard threshold lookup
    return getKeyThreshold(key, isToggled);
  }

  // ==========================================================================
  // D KEY - RETALIATE ACCUMULATOR
  // ==========================================================================

  /**
   * Handle D key down - start accumulation phase
   */
  private handleDKeyDown(): void {
    const now = performance.now();

    this.state.dKey = {
      active: true,
      startTime: now,
      count: 0,
      pendingROutputs: 0,
      cycleStartTime: now,  // Start first 7-R cycle
      cycleCount: 0,
    };

    // Record in active keys (for consistency)
    this.state.activeKeyDowns.set("D", {
      startTime: now,
      longFired: false,
    });

    console.log("🔴 D key: Accumulation phase started (max 7 Rs per 2.85s cycle)");
  }

  /**
   * Handle D key up - signal to special key handler to stop after 980ms
   */
  private handleDKeyUp(): void {
    if (!this.state.dKey.active) return;

    const count = this.state.dKey.count;

    console.log(
      `🔴 D key: Accumulation complete - ${count} R triggers sent`,
    );

    // Signal special key handler to clear overflow after 500ms
    if (this.specialKeyCallback) {
      this.specialKeyCallback({
        type: "direct_output",
        keys: [],  // Empty keys signals D release
        timings: { keyDownMs: [0, 0], gapMs: [0, 0] },
        source: "d_release",  // Special source to trigger 500ms cutoff
      });
    }

    // Reset D key state
    this.state.dKey = {
      active: false,
      startTime: 0,
      count: 0,
      pendingROutputs: 0,
      cycleStartTime: 0,
      cycleCount: 0,
    };

    this.state.activeKeyDowns.delete("D");
  }

  /**
   * Handle trigger key during D accumulation - immediately output R
   * Max 7 Rs per 2.85s cycle
   */
  private handleDTriggerKey(key: string): boolean {
    if (!this.state.dKey.active) return false;
    if (!D_TRIGGER_KEYS.has(key)) return false;

    const now = performance.now();
    
    // Check if we need to start a new cycle (2.85s elapsed)
    const cycleElapsed = now - this.state.dKey.cycleStartTime;
    if (cycleElapsed >= D_CYCLE_REFRESH_MS) {
      // Reset cycle
      this.state.dKey.cycleStartTime = now;
      this.state.dKey.cycleCount = 0;
      console.log(`   D accumulator: New 7-R cycle started (held ${Math.round(cycleElapsed)}ms)`);
    }
    
    // Check if we've hit the 7 R limit for this cycle
    if (this.state.dKey.cycleCount >= D_MAX_RS_PER_CYCLE) {
      console.log(`   D accumulator: Cycle limit reached (7 Rs) - ignoring ${key}`);
      return true;  // Still consume the key, just don't output R
    }

    this.state.dKey.count++;
    this.state.dKey.cycleCount++;
    console.log(
      `   D accumulator: +1 (${key}) → cycle: ${this.state.dKey.cycleCount}/${D_MAX_RS_PER_CYCLE}, total: ${this.state.dKey.count}`,
    );

    // IMMEDIATELY output R on each trigger tap (don't wait for D release)
    if (this.specialKeyCallback) {
      this.specialKeyCallback({
        type: "direct_output",
        keys: ["R"],
        timings: {
          keyDownMs: [20, 46],  // Reduced from [34, 76] - faster hold
          gapMs: [25, 40],       // Reduced from [51, 63] - faster gap
        },
        source: "d_retaliate",
      });
      console.log(`   → R output immediately`);
    }

    // Return true to PREVENT normal gesture processing for trigger keys
    return true;
  }

  // ==========================================================================
  // S KEY - DUAL PURPOSE WITH GROUP MEMBER TOGGLE
  // ==========================================================================

  /**
   * Handle S key down
   */
  private handleSKeyDown(): void {
    const now = performance.now();

    this.state.sKey.startTime = now;

    this.state.activeKeyDowns.set("S", {
      startTime: now,
      longFired: false,
    });
  }

  /**
   * Check S key for group member toggle activation
   */
  private checkSKeyToggleActivation(now: number): void {
    const sKeyState = this.state.activeKeyDowns.get("S");
    if (!sKeyState || this.state.sKey.active) return;

    const holdDuration = now - sKeyState.startTime;
    const threshold = OMEGA_KEY_THRESHOLDS["S"] || 512;

    if (holdDuration >= threshold) {
      // Activate group member toggle
      this.state.sKey.active = true;
      sKeyState.longFired = true; // Prevent normal long gesture

      console.log("🟢 S key: Group Member Toggle ACTIVATED");
    }
  }

  /**
   * Handle S key up
   */
  private handleSKeyUp(): void {
    const sKeyState = this.state.activeKeyDowns.get("S");
    if (!sKeyState) return;

    const now = performance.now();
    const holdDuration = now - sKeyState.startTime;

    // If group member toggle was active, just deactivate
    if (this.state.sKey.active) {
      console.log("🟢 S key: Group Member Toggle DEACTIVATED");
      this.state.sKey.active = false;
      this.state.sKey.startTime = null;
      this.state.activeKeyDowns.delete("S");
      return;
    }

    // Quick gesture (Guard) - S is independent of W/Y toggle
    if (holdDuration < this.config.cancelThreshold) {
      this.emitGesture({
        inputKey: "S",
        gesture: "quick", // S always uses quick, ignores W/Y toggle
        timestamp: now,
        holdDuration,
        wasToggled: false,
      });
    }

    this.state.activeKeyDowns.delete("S");
    this.state.sKey.startTime = null;
  }

  /**
   * Handle key during S group member toggle - intercept 1/2/3/4
   */
  private handleSInterceptKey(key: string): boolean {
    if (!this.state.sKey.active) return false;
    if (!S_INTERCEPT_KEYS.has(key)) return false;

    const outputs = S_GROUP_MEMBER_OUTPUTS[key];
    if (!outputs) return false;

    console.log(`   S intercept: ${key} → ${outputs.join(" → ")}`);

    if (this.specialKeyCallback) {
      this.specialKeyCallback({
        type: "direct_output",
        keys: outputs,
        source: "s_group_member",
      });
    }

    // Return true to PREVENT normal gesture processing
    return true;
  }

  // ==========================================================================
  // C KEY - QUICK/LONG + DOUBLE-TAP ESCAPE
  // ==========================================================================

  /**
   * Handle C key down
   */
  private handleCKeyDown(): void {
    const now = performance.now();

    // Check if within multi-press window for double-tap
    if (
      this.state.cKey.tapCount > 0 &&
      now - this.state.cKey.lastTapTime < C_MULTIPRESS_WINDOW
    ) {
      // Cancel pending quick timer
      if (this.state.cKey.windowTimer) {
        clearTimeout(this.state.cKey.windowTimer);
        this.state.cKey.windowTimer = null;
      }
    }

    this.state.activeKeyDowns.set("C", {
      startTime: now,
      longFired: false,
    });
  }

  /**
   * Check C key for long-press threshold
   */
  private checkCKeyLongPress(now: number, keyState: ActiveKeyState): void {
    if (keyState.longFired) return;

    const holdDuration = now - keyState.startTime;
    const isToggled = this.state.toggleActive;
    const threshold = OMEGA_KEY_THRESHOLDS["C"] || 349;

    if (holdDuration >= threshold) {
      // Long press detected - fire immediately
      // Long press cannot be part of double-tap, so no need to wait
      this.state.cKey.tapCount = 0; // Reset tap count
      if (this.state.cKey.windowTimer) {
        clearTimeout(this.state.cKey.windowTimer);
        this.state.cKey.windowTimer = null;
      }

      this.fireLongGesture("C", holdDuration, isToggled);
    }
  }

  /**
   * Handle C key up
   */
  private handleCKeyUp(): void {
    const cKeyState = this.state.activeKeyDowns.get("C");
    if (!cKeyState) return;

    const now = performance.now();
    const holdDuration = now - cKeyState.startTime;

    this.state.activeKeyDowns.delete("C");

    // If long already fired, nothing more to do
    if (cKeyState.longFired) {
      return;
    }

    // Check cancel threshold
    if (holdDuration >= this.config.cancelThreshold) {
      console.log(`⛔ C cancelled (held ${Math.round(holdDuration)}ms)`);
      return;
    }

    // Increment tap count
    this.state.cKey.tapCount++;
    this.state.cKey.lastTapTime = now;

    // Clear existing window timer
    if (this.state.cKey.windowTimer) {
      clearTimeout(this.state.cKey.windowTimer);
    }

    // Check for double-tap immediately
    if (this.state.cKey.tapCount >= 2) {
      // Double-tap detected - emit ESCAPE
      console.log("🟡 C key: Double-tap → ESCAPE");

      this.state.cKey.tapCount = 0;
      this.state.cKey.windowTimer = null;

      if (this.specialKeyCallback) {
        this.specialKeyCallback({
          type: "direct_output",
          keys: ["ESCAPE"],
          source: "c_escape",
        });
      }
      return;
    }

    // Schedule single-tap (quick) after window expires
    const isToggled = this.state.toggleActive;
    this.state.cKey.windowTimer = setTimeout(() => {
      if (this.isStopped) return;

      // Window expired with single tap - fire quick gesture
      if (this.state.cKey.tapCount === 1) {
        this.state.cKey.tapCount = 0;
        this.fireQuickGesture("C", holdDuration, isToggled);
      }
      this.state.cKey.windowTimer = null;
    }, C_MULTIPRESS_WINDOW);
  }

  // ==========================================================================
  // = KEY - GAP-BASED ONLY (NO QUICK/LONG)
  // ==========================================================================

  /**
   * Handle = key down
   */
  private handleEqualsKeyDown(): void {
    const now = performance.now();

    // Check if within multi-press window
    if (
      this.state.equalsKey.tapCount > 0 &&
      now - this.state.equalsKey.lastTapTime < EQUALS_MULTIPRESS_WINDOW
    ) {
      // Cancel pending timer
      if (this.state.equalsKey.windowTimer) {
        clearTimeout(this.state.equalsKey.windowTimer);
        this.state.equalsKey.windowTimer = null;
      }
    }

    this.state.activeKeyDowns.set("=", {
      startTime: now,
      longFired: false, // Not used for = key
    });
  }

  /**
   * Handle = key up
   */
  private handleEqualsKeyUp(): void {
    const keyState = this.state.activeKeyDowns.get("=");
    if (!keyState) return;

    const now = performance.now();
    this.state.activeKeyDowns.delete("=");

    // Increment tap count (ignore hold duration)
    this.state.equalsKey.tapCount++;
    this.state.equalsKey.lastTapTime = now;

    // Clear existing timer
    if (this.state.equalsKey.windowTimer) {
      clearTimeout(this.state.equalsKey.windowTimer);
    }

    // Check for double-tap immediately
    if (this.state.equalsKey.tapCount >= 2) {
      // Double-tap: Smash → ]
      console.log("🟣 = key: Double-tap → Smash + ]");

      this.state.equalsKey.tapCount = 0;
      this.state.equalsKey.windowTimer = null;

      // Emit special gesture event for Smash sequence
      this.emitGesture({
        inputKey: "=",
        gesture: "quick", // Map to quick for binding lookup (will be "double" in profile)
        timestamp: now,
        wasToggled: false,
      });
      return;
    }

    // Schedule window expiration (single tap = no action)
    this.state.equalsKey.windowTimer = setTimeout(() => {
      if (this.isStopped) return;

      // Single tap - no output for = key
      console.log("🟣 = key: Single tap (no action)");
      this.state.equalsKey.tapCount = 0;
      this.state.equalsKey.windowTimer = null;
    }, EQUALS_MULTIPRESS_WINDOW);
  }

  // ==========================================================================
  // F2 KEY - GAP-BASED ONLY (NO QUICK/LONG)
  // ==========================================================================

  /**
   * Handle F2 key down
   */
  private handleF2KeyDown(): void {
    const now = performance.now();

    // Check if within multi-press window
    if (
      this.state.f2Key.tapCount > 0 &&
      now - this.state.f2Key.lastTapTime < F2_MULTIPRESS_WINDOW
    ) {
      if (this.state.f2Key.windowTimer) {
        clearTimeout(this.state.f2Key.windowTimer);
        this.state.f2Key.windowTimer = null;
      }
    }

    this.state.activeKeyDowns.set("F2", {
      startTime: now,
      longFired: false,
    });
  }

  /**
   * Handle F2 key up
   */
  private handleF2KeyUp(): void {
    const keyState = this.state.activeKeyDowns.get("F2");
    if (!keyState) return;

    const now = performance.now();
    this.state.activeKeyDowns.delete("F2");

    // Increment tap count (ignore hold duration)
    this.state.f2Key.tapCount++;
    this.state.f2Key.lastTapTime = now;

    // Clear existing timer
    if (this.state.f2Key.windowTimer) {
      clearTimeout(this.state.f2Key.windowTimer);
    }

    // Check for double-tap
    if (this.state.f2Key.tapCount >= 2) {
      // Double-tap detected (no output assigned yet)
      console.log("🟤 F2 key: Double-tap (no binding)");

      this.state.f2Key.tapCount = 0;
      this.state.f2Key.windowTimer = null;
      return;
    }

    // Schedule window expiration
    this.state.f2Key.windowTimer = setTimeout(() => {
      if (this.isStopped) return;

      // Single tap (no output assigned)
      console.log("🟤 F2 key: Single tap (no binding)");
      this.state.f2Key.tapCount = 0;
      this.state.f2Key.windowTimer = null;
    }, F2_MULTIPRESS_WINDOW);
  }

  // ==========================================================================
  // W/Y TOGGLE ACTIVATORS WITH QUICK FALLBACK
  // ==========================================================================

  /**
   * Check if a toggle key has been held long enough to activate toggle mode
   */
  private checkToggleActivation(now: number): void {
    // If toggle is already active, nothing to do
    if (this.state.toggleActive) return;

    // Check W and Y for potential toggle activation
    for (const toggleKey of TOGGLE_KEYS) {
      const keyState = this.state.activeKeyDowns.get(toggleKey);
      if (!keyState) continue;

      // Skip if this key already fired its long gesture
      if (keyState.longFired) continue;

      const holdDuration = now - keyState.startTime;
      const threshold = getKeyThreshold(toggleKey, false);

      if (holdDuration >= threshold) {
        // Activate toggle mode
        this.activateToggle(toggleKey as "W" | "Y", keyState.startTime);

        // Mark as fired to prevent quick gesture on release
        keyState.longFired = true;
      }
    }
  }

  /**
   * Activate toggle mode
   */
  private activateToggle(activator: "W" | "Y", startTime: number): void {
    if (this.state.toggleActive) return;

    this.state.toggleActive = true;
    this.state.toggleActivator = activator;
    this.state.toggleStartTime = startTime;

    console.log(`🔀 Toggle ACTIVATED by ${activator}`);
  }

  /**
   * Deactivate toggle mode
   */
  private deactivateToggle(): void {
    if (!this.state.toggleActive) return;

    console.log(`🔀 Toggle DEACTIVATED (was ${this.state.toggleActivator})`);

    this.state.toggleActive = false;
    this.state.toggleActivator = null;
    this.state.toggleStartTime = null;
  }

  /**
   * Handle toggle key up (W or Y)
   */
  private handleToggleKeyUp(key: "W" | "Y"): void {
    const keyState = this.state.activeKeyDowns.get(key);
    if (!keyState) return;

    const now = performance.now();
    const holdDuration = now - keyState.startTime;

    this.state.activeKeyDowns.delete(key);

    // Check if this key was the toggle activator
    if (this.state.toggleActive && this.state.toggleActivator === key) {
      this.deactivateToggle();
    }

    // If long already fired (became toggle), no gesture output
    if (keyState.longFired) {
      return;
    }

    // Quick gesture fallback (released before threshold)
    // Check if the OTHER toggle key was active
    const otherToggleKey = key === "W" ? "Y" : "W";
    const wasOtherToggling =
      this.state.activeKeyDowns.has(otherToggleKey) &&
      this.state.toggleActive &&
      this.state.toggleActivator === otherToggleKey;

    const gesture: OmegaGestureType = wasOtherToggling
      ? "quick_toggle"
      : "quick";

    this.emitGesture({
      inputKey: key,
      gesture,
      timestamp: now,
      holdDuration,
      wasToggled: wasOtherToggling,
      toggleActivator: wasOtherToggling ? otherToggleKey : undefined,
    });
  }

  // ==========================================================================
  // GESTURE EMISSION
  // ==========================================================================

  /**
   * Fire a long gesture (called when threshold is crossed, BEFORE keyUp)
   */
  private fireLongGesture(
    key: InputKey,
    holdDuration: number,
    isToggled: boolean,
  ): void {
    const keyState = this.state.activeKeyDowns.get(key);
    if (!keyState || keyState.longFired) return;

    // Mark as fired to prevent duplicate emissions
    keyState.longFired = true;

    const gesture: OmegaGestureType = isToggled ? "long_toggle" : "long";

    this.emitGesture({
      inputKey: key,
      gesture,
      timestamp: performance.now(),
      holdDuration,
      wasToggled: isToggled,
      toggleActivator: this.state.toggleActivator ?? undefined,
    });
  }

  /**
   * Fire a quick gesture (called on keyUp if threshold wasn't crossed)
   */
  private fireQuickGesture(
    key: InputKey,
    holdDuration: number,
    isToggled: boolean,
  ): void {
    const gesture: OmegaGestureType = isToggled ? "quick_toggle" : "quick";

    this.emitGesture({
      inputKey: key,
      gesture,
      timestamp: performance.now(),
      holdDuration,
      wasToggled: isToggled,
      toggleActivator: this.state.toggleActivator ?? undefined,
    });
  }

  /**
   * Emit a gesture event to all listeners
   */
  private emitGesture(event: OmegaGestureEvent): void {
    if (this.isStopped) return;

    queueMicrotask(() => {
      if (this.isStopped) return;

      try {
        this.gestureCallback(event);
      } catch {
        // Swallow callback errors
      }

      for (const listener of this.listeners) {
        try {
          listener(event);
        } catch {
          // Swallow listener errors
        }
      }
    });
  }

  // ==========================================================================
  // KEY EVENT HANDLING
  // ==========================================================================

  handleKeyDown(key: string): void {
    this.queueEvent("down", key);
  }

  handleKeyUp(key: string): void {
    this.queueEvent("up", key);
  }

  handleMouseDown(button: string): void {
    if (button === "MIDDLE_CLICK") {
      this.queueEvent("down", button);
    }
  }

  handleMouseUp(button: string): void {
    if (button === "MIDDLE_CLICK") {
      this.queueEvent("up", button);
    }
  }

  private queueEvent(type: "down" | "up", key: string): void {
    if (this.isStopped) return;

    if (this.eventQueue.length >= 100) {
      console.error("❌ Event queue overflow, dropping event");
      return;
    }

    const event = { type, key, timestamp: Date.now() };

    if (!this.processingQueue) {
      this.processEvent(event);
    } else {
      this.eventQueue.push(event);
    }
  }

  private processEvent(event: {
    type: "down" | "up";
    key: string;
    timestamp: number;
  }): void {
    this.processingQueue = true;

    try {
      const upperKey = event.key.toUpperCase();

      // Handle D-only input keys (E, F, G)
      if (D_ONLY_INPUT_KEYS.has(upperKey)) {
        if (this.state.dKey.active && event.type === "down") {
          this.handleDTriggerKey(upperKey);
        }
        // D-only keys don't process further
        return;
      }

      // Validate key is one we track
      if (!INPUT_KEYS.includes(upperKey as InputKey)) {
        return;
      }

      const inputKey = upperKey as InputKey;

      if (event.type === "down") {
        this.processKeyDown(inputKey);
      } else {
        this.processKeyUp(inputKey);
      }

      // Process queued events
      while (this.eventQueue.length > 0) {
        const nextEvent = this.eventQueue.shift()!;
        const nextKey = nextEvent.key.toUpperCase();

        // Handle D-only keys
        if (D_ONLY_INPUT_KEYS.has(nextKey)) {
          if (this.state.dKey.active && nextEvent.type === "down") {
            this.handleDTriggerKey(nextKey);
          }
          continue;
        }

        if (!INPUT_KEYS.includes(nextKey as InputKey)) continue;

        const nextInputKey = nextKey as InputKey;

        if (nextEvent.type === "down") {
          this.processKeyDown(nextInputKey);
        } else {
          this.processKeyUp(nextInputKey);
        }
      }
    } finally {
      this.processingQueue = false;
    }
  }

  private processKeyDown(key: InputKey): void {
    const now = performance.now();

    // Ignore key repeat (key already held)
    if (this.state.activeKeyDowns.has(key)) {
      return;
    }

    // STATE MACHINE PRIORITY ORDER:
    // 1. D accumulation > 2. S group member intercept > 3. Normal processing

    // Check for D trigger key during accumulation
    if (this.state.dKey.active && D_TRIGGER_KEYS.has(key)) {
      this.handleDTriggerKey(key);
      // Continue to normal processing (triggers fire their own gestures too)
    }

    // Check for S intercept during group member toggle
    if (this.handleSInterceptKey(key)) {
      return; // Intercepted, don't process further
    }

    // Special key handling
    switch (key) {
      case "D":
        this.handleDKeyDown();
        return;
      case "S":
        this.handleSKeyDown();
        return;
      case "C":
        this.handleCKeyDown();
        return;
      case "=":
        this.handleEqualsKeyDown();
        return;
      case "F2":
        this.handleF2KeyDown();
        return;
      case "W":
      case "Y":
        // Toggle keys have standard key down
        break;
    }

    // Standard key down
    this.state.activeKeyDowns.set(key, {
      startTime: now,
      longFired: false,
    });

    // Cancel any pending quick timer for this key
    const pendingTimer = this.pendingQuickTimers.get(key);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.pendingQuickTimers.delete(key);
    }
  }

  private processKeyUp(key: InputKey): void {
    // Special key handling
    switch (key) {
      case "D":
        this.handleDKeyUp();
        return;
      case "S":
        this.handleSKeyUp();
        return;
      case "C":
        this.handleCKeyUp();
        return;
      case "=":
        this.handleEqualsKeyUp();
        return;
      case "F2":
        this.handleF2KeyUp();
        return;
      case "W":
      case "Y":
        this.handleToggleKeyUp(key);
        return;
    }

    // Standard key up processing
    const keyState = this.state.activeKeyDowns.get(key);
    if (!keyState) return;

    const now = performance.now();
    const holdDuration = now - keyState.startTime;

    this.state.activeKeyDowns.delete(key);

    // Check if toggle activator releasing
    if (this.state.toggleActive && isToggleKey(key) && this.state.toggleActivator === key) {
      this.deactivateToggle();
    }

    // Determine toggle state for this key
    const wasToggled = this.state.toggleActive && !isToggleKey(key);

    // If long already fired, nothing more to do
    if (keyState.longFired) {
      return;
    }

    // Check cancel threshold
    if (holdDuration >= this.config.cancelThreshold) {
      console.log(`⛔ ${key} cancelled (held ${Math.round(holdDuration)}ms)`);
      return;
    }

    // Fire quick gesture
    this.fireQuickGesture(key, holdDuration, wasToggled);
  }

  // ==========================================================================
  // IGestureDetector INTERFACE IMPLEMENTATION
  // ==========================================================================

  reset(): void {
    this.state = createExtendedOmegaState();

    for (const timer of this.pendingQuickTimers.values()) {
      clearTimeout(timer);
    }
    this.pendingQuickTimers.clear();

    this.eventQueue.length = 0;
  }

  updateSettings(settings: GestureSettings): void {
    this.globalSettings = settings;

    if (settings.multiPressWindow) {
      this.config.multiPressWindow = settings.multiPressWindow;
    }

    this.startCheckInterval();
  }

  updateKeyProfile(key: InputKey, settings: GestureSettings): void {
    this.keySpecificSettings.set(key, settings);
    console.log(`✅ Updated ${key} profile (Omega)`);
  }

  clearKeyProfile(key: InputKey): void {
    this.keySpecificSettings.delete(key);
    console.log(`🔄 Cleared ${key} profile (Omega)`);
  }

  getKeyProfile(key: InputKey): GestureSettings | null {
    return this.keySpecificSettings.get(key) ?? this.globalSettings;
  }

  getAllProfiles(): Record<string, GestureSettings> {
    const profiles: Record<string, GestureSettings> = {};

    for (const key of INPUT_KEYS) {
      profiles[key] = this.keySpecificSettings.get(key) ?? this.globalSettings;
    }

    return profiles;
  }

  getCustomizedKeys(): InputKey[] {
    return Array.from(this.keySpecificSettings.keys());
  }

  loadKeyProfiles(profiles: Record<string, GestureSettings>): void {
    for (const [key, settings] of Object.entries(profiles)) {
      this.keySpecificSettings.set(key as InputKey, settings);
    }
    console.log(
      `🎯 Loaded ${Object.keys(profiles).length} key profiles (Omega)`,
    );
  }

  getGlobalSettings(): GestureSettings {
    return { ...this.globalSettings };
  }

  destroy(): void {
    this.isStopped = true;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    for (const timer of this.pendingQuickTimers.values()) {
      clearTimeout(timer);
    }
    this.pendingQuickTimers.clear();

    // Clear special key timers
    if (this.state.cKey.windowTimer) {
      clearTimeout(this.state.cKey.windowTimer);
    }
    if (this.state.equalsKey.windowTimer) {
      clearTimeout(this.state.equalsKey.windowTimer);
    }
    if (this.state.f2Key.windowTimer) {
      clearTimeout(this.state.f2Key.windowTimer);
    }

    this.eventQueue.length = 0;
    this.listeners.clear();
    this.state = createExtendedOmegaState();

    console.log("🛑 Omega Gesture Detector destroyed");
  }

  // ==========================================================================
  // ADDITIONAL METHODS
  // ==========================================================================

  onGesture(cb: OmegaGestureCallback): void {
    this.listeners.add(cb);
  }

  offGesture(cb: OmegaGestureCallback): void {
    this.listeners.delete(cb);
  }

  getToggleState(): { active: boolean; activator: "W" | "Y" | null } {
    return {
      active: this.state.toggleActive,
      activator: this.state.toggleActivator,
    };
  }

  getActiveKeys(): InputKey[] {
    return Array.from(this.state.activeKeyDowns.keys());
  }

  isKeyHeld(key: InputKey): boolean {
    return this.state.activeKeyDowns.has(key);
  }

  getKeyHoldDuration(key: InputKey): number | null {
    const keyState = this.state.activeKeyDowns.get(key);
    if (!keyState) return null;
    return performance.now() - keyState.startTime;
  }

  /**
   * Get D key accumulator state
   */
  getDKeyState(): { active: boolean; count: number } {
    return {
      active: this.state.dKey.active,
      count: this.state.dKey.count,
    };
  }

  /**
   * Get S key group member toggle state
   */
  getSKeyToggleState(): boolean {
    return this.state.sKey.active;
  }

  setGroupMemberToggle(active: boolean): void {
    this.state.groupMemberToggleActive = active;
  }

  getGroupMemberToggle(): boolean {
    return this.state.groupMemberToggleActive;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createOmegaGestureDetector(
  settings: GestureSettings,
  gestureCallback: OmegaGestureCallback,
  config?: Partial<OmegaConfig>,
  specialKeyCallback?: SpecialKeyCallback,
): OmegaGestureDetector {
  return new OmegaGestureDetector(
    settings,
    gestureCallback,
    config,
    specialKeyCallback,
  );
}
