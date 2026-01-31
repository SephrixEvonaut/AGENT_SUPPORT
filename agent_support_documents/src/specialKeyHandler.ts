// ============================================================================
// SPECIAL KEY HANDLER - Processes direct key outputs from Omega detector
// ============================================================================
//
// This module handles the special key output events from the Omega gesture
// detector, including:
// - D key Retaliate accumulator (outputs multiple R presses)
// - S key Group Member Toggle (outputs NUMPAD + NUMPAD_SUBTRACT sequences)
// - C key double-tap (outputs ESCAPE)
// - = key double-tap (outputs Smash → ])
//
// ============================================================================

import { SpecialKeyOutputEvent } from "./omegaGestureDetector.js";
import { getHumanDelay, getHumanKeyDownDuration } from "./humanRandomizer.js";

/**
 * Key press callback for executing actual key outputs
 */
export type KeyPressCallback = (
  key: string,
  holdDurationMs: number
) => Promise<void>;

/**
 * Configuration for special key handler
 */
export interface SpecialKeyHandlerConfig {
  /** Callback to press a key with specified hold duration */
  onKeyPress: KeyPressCallback;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Special Key Handler
 * Processes SpecialKeyOutputEvents from the Omega gesture detector
 */
export class SpecialKeyHandler {
  private config: SpecialKeyHandlerConfig;
  private isExecuting: boolean = false;
  private pendingQueue: SpecialKeyOutputEvent[] = [];
  private isShutdown: boolean = false;
  
  // D key overflow management - 500ms window after D release
  private dReleaseTime: number | null = null;
  private dReleased: boolean = false;  // Hard stop flag
  private readonly D_OVERFLOW_CUTOFF_MS = 500;  // 500ms to drain queue after D release

  constructor(config: SpecialKeyHandlerConfig) {
    this.config = config;
  }

  /**
   * Handle a special key output event
   */
  async handleEvent(event: SpecialKeyOutputEvent): Promise<void> {
    if (this.isShutdown) return;

    // D release MUST be handled immediately - don't queue it!
    // This sets the hard stop flag RIGHT when D is released
    if (event.source === "d_release") {
      this.handleDRelease();
      return;  // Don't queue or process further
    }

    // Reset flags when D accumulation starts/restarts
    if (event.source === "d_retaliate") {
      // If dReleased is true, D was just pressed again - reset flags
      if (this.dReleased) {
        this.dReleased = false;
        this.dReleaseTime = null;
      }
    }

    // Queue events if currently executing
    if (this.isExecuting) {
      // Don't queue d_retaliate if D was already released
      if (event.source === "d_retaliate" && this.dReleased) {
        console.log(`[SpecialKey] R blocked - D already released`);
        return;
      }
      this.pendingQueue.push(event);
      return;
    }

    await this.processEvent(event);
  }

  /**
   * Process a single event
   */
  private async processEvent(event: SpecialKeyOutputEvent): Promise<void> {
    if (this.isShutdown) return;

    this.isExecuting = true;

    try {
      switch (event.source) {
        case "d_retaliate":
          await this.processRetaliateOutput(event);
          break;
        case "d_release":
          // D key released - start 500ms cutoff timer
          this.handleDRelease();
          break;
        case "s_group_member":
          await this.processGroupMemberOutput(event);
          break;
        case "c_escape":
          await this.processEscapeOutput(event);
          break;
        case "equals_smash":
          await this.processSmashOutput(event);
          break;
        default:
          console.warn(`Unknown special key source: ${event.source}`);
      }
    } catch (error) {
      console.error(`Special key handler error:`, error);
    } finally {
      this.isExecuting = false;

      // Process any queued events
      if (this.pendingQueue.length > 0) {
        const nextEvent = this.pendingQueue.shift()!;
        await this.processEvent(nextEvent);
      }
    }
  }

  /**
   * Handle D key release - IMMEDIATELY stop all R processing
   */
  private handleDRelease(): void {
    this.dReleaseTime = performance.now();
    this.dReleased = true;  // Hard stop flag
    
    // IMMEDIATELY clear all pending d_retaliate events - don't wait!
    const beforeCount = this.pendingQueue.length;
    this.pendingQueue = this.pendingQueue.filter(e => e.source !== "d_retaliate");
    const cleared = beforeCount - this.pendingQueue.length;
    
    console.log(`[SpecialKey] D released - HARD STOP - cleared ${cleared} pending Rs`);
  }

  /**
   * Check if D overflow window has expired
   */
  private isDOverflowExpired(): boolean {
    // Hard stop when D is released
    if (this.dReleased) return true;
    
    if (this.dReleaseTime === null) return false;
    
    const elapsed = performance.now() - this.dReleaseTime;
    return elapsed > this.D_OVERFLOW_CUTOFF_MS;
  }

  /**
   * Process D key Retaliate output
   * Outputs [count] R presses with randomized timing
   */
  private async processRetaliateOutput(event: SpecialKeyOutputEvent): Promise<void> {
    // Check if D overflow window expired - drop this R press
    if (this.isDOverflowExpired()) {
      if (this.config.debug) {
        console.log(`[SpecialKey] R dropped - 150ms overflow expired`);
      }
      // Aggressively clear ALL remaining d_retaliate events from queue
      const beforeCount = this.pendingQueue.length;
      this.pendingQueue = this.pendingQueue.filter(e => e.source !== "d_retaliate");
      const cleared = beforeCount - this.pendingQueue.length;
      if (cleared > 0 && this.config.debug) {
        console.log(`[SpecialKey] Cleared ${cleared} overflow R events from queue`);
      }
      return;
    }

    const { keys, timings } = event;

    if (this.config.debug) {
      console.log(`[SpecialKey] Retaliate: ${keys.length} R presses`);
    }

    // Default timings if not provided (faster by ~30ms)
    const keyDownRange = timings?.keyDownMs ?? [20, 46];
    const gapRange = timings?.gapMs ?? [25, 40];

    for (let i = 0; i < keys.length; i++) {
      // Check overflow BEFORE each R press - stop immediately if expired
      if (this.isShutdown || this.isDOverflowExpired()) {
        if (this.isDOverflowExpired() && this.config.debug) {
          console.log(`[SpecialKey] R sequence stopped mid-execution - overflow expired`);
          // Clear any remaining in queue
          this.pendingQueue = this.pendingQueue.filter(e => e.source !== "d_retaliate");
        }
        break;
      }

      // Get randomized timing
      const holdDuration = getHumanDelay(keyDownRange[0], keyDownRange[1], "d_retaliate_hold");

      // Press the key
      await this.config.onKeyPress("R", holdDuration);

      if (this.config.debug) {
        console.log(`   R press ${i + 1}/${keys.length}: held ${holdDuration}ms`);
      }

      // Wait for gap before next press (except for last press)
      if (i < keys.length - 1) {
        const gap = getHumanDelay(gapRange[0], gapRange[1], "d_retaliate_gap");
        await this.sleep(gap);
      }
    }
  }

  /**
   * Process S key Group Member output
   * Outputs target key followed by NUMPAD_SUBTRACT
   */
  private async processGroupMemberOutput(event: SpecialKeyOutputEvent): Promise<void> {
    const { keys } = event;

    if (this.config.debug) {
      console.log(`[SpecialKey] Group Member: ${keys.join(" → ")}`);
    }

    // Press each key in sequence with short delays
    for (let i = 0; i < keys.length; i++) {
      if (this.isShutdown) break;

      const key = keys[i];
      const holdDuration = getHumanKeyDownDuration();

      await this.config.onKeyPress(key, holdDuration);

      // Short gap between keys
      if (i < keys.length - 1) {
        const gap = getHumanDelay(30, 50, "s_group_gap");
        await this.sleep(gap);
      }
    }
  }

  /**
   * Process C key ESCAPE output
   */
  private async processEscapeOutput(event: SpecialKeyOutputEvent): Promise<void> {
    if (this.config.debug) {
      console.log(`[SpecialKey] Escape: ESCAPE`);
    }

    const holdDuration = getHumanKeyDownDuration();
    await this.config.onKeyPress("ESCAPE", holdDuration);
  }

  /**
   * Process = key Smash output (handled via gesture, but could be direct)
   */
  private async processSmashOutput(event: SpecialKeyOutputEvent): Promise<void> {
    if (this.config.debug) {
      console.log(`[SpecialKey] Smash: ] (via gesture binding)`);
    }

    // Smash is typically handled through the normal gesture binding system
    // This is here for direct output if needed
    const holdDuration = getHumanKeyDownDuration();
    await this.config.onKeyPress("]", holdDuration);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Shutdown the handler
   */
  shutdown(): void {
    this.isShutdown = true;
    this.pendingQueue = [];
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a special key handler with RobotJS integration
 */
export async function createSpecialKeyHandler(
  debug?: boolean
): Promise<SpecialKeyHandler> {
  // Try to import robotjs
  let robot: any;
  try {
    robot = (await import("robotjs")).default;
    robot.setKeyboardDelay(1);
  } catch {
    console.warn("RobotJS not available for special key handler");
    robot = null;
  }

  return new SpecialKeyHandler({
    debug,
    onKeyPress: async (key: string, holdDurationMs: number) => {
      if (!robot) {
        console.log(`[MOCK] Key: ${key} (${holdDurationMs}ms)`);
        return;
      }

      // Map special key names to RobotJS format
      const keyMap: Record<string, string> = {
        NUMPAD1: "numpad_1",
        NUMPAD2: "numpad_2",
        NUMPAD3: "numpad_3",
        NUMPAD4: "numpad_4",
        NUMPAD5: "numpad_5",
        NUMPAD6: "numpad_6",
        NUMPAD7: "numpad_7",
        NUMPAD8: "numpad_8",
        NUMPAD9: "numpad_9",
        NUMPAD0: "numpad_0",
        NUMPAD_SUBTRACT: "numpad_-",
        NUMPAD_ADD: "numpad_+",
        NUMPAD_MULTIPLY: "numpad_*",
        NUMPAD_DECIMAL: "numpad_.",
        ESCAPE: "escape",
      };

      const robotKey = keyMap[key] || key.toLowerCase();

      try {
        robot.keyToggle(robotKey, "down");
        await new Promise((resolve) => setTimeout(resolve, holdDurationMs));
        robot.keyToggle(robotKey, "up");
      } catch (error) {
        // Fallback to keyTap
        try {
          robot.keyTap(robotKey);
        } catch {
          console.error(`Failed to press key: ${key}`);
        }
      }
    },
  });
}

export default SpecialKeyHandler;