import { CompiledProfile } from "./types.js";
import { extractRawKey } from "./utils.js";
import { getHumanTrafficWait } from "./humanRandomizer.js";

/**
 * Sleep for a random duration using human-like randomization
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class TrafficController {
  private crossingKey: string | null = null;
  private queue: Array<{ key: string; timestamp: number }> = [];
  private compiledProfile: CompiledProfile;

  // Macros with supremacy bypass traffic control entirely
  private supremacyMacros: Set<string> = new Set();

  constructor(compiledProfile: CompiledProfile) {
    this.compiledProfile = compiledProfile;
  }

  /**
   * Grant supremacy to a macro - it will bypass traffic control entirely
   */
  grantSupremacy(macroName: string): void {
    this.supremacyMacros.add(macroName);
  }

  /**
   * Revoke supremacy from a macro
   */
  revokeSupremacy(macroName: string): void {
    this.supremacyMacros.delete(macroName);
  }

  /**
   * Check if a macro has supremacy
   */
  hasSupremacy(macroName: string): boolean {
    return this.supremacyMacros.has(macroName);
  }

  /**
   * Get all macros with supremacy
   */
  getSupremacyList(): string[] {
    return [...this.supremacyMacros];
  }

  async requestCrossing(key: string, macroName?: string): Promise<void> {
    // Supremacy macros bypass traffic control
    if (macroName && this.supremacyMacros.has(macroName)) {
      return;
    }

    const raw = extractRawKey(key);
    const isConundrum = this.compiledProfile.conundrumKeys.has(raw);

    if (!isConundrum) {
      return;
    }

    this.queue.push({ key: raw, timestamp: Date.now() });

    while (this.shouldWait(raw)) {
      // Use human-like random wait time instead of fixed range
      const waitMs = getHumanTrafficWait();
      await sleep(waitMs);
    }

    this.crossingKey = raw;
  }

  releaseCrossing(key: string): void {
    const raw = extractRawKey(key);
    if (this.crossingKey === raw) {
      this.crossingKey = null;
    }

    // Remove any finished items from queue head
    if (this.queue.length > 0 && this.queue[0].key === raw) {
      this.queue.shift();
    }
  }

  private shouldWait(key: string): boolean {
    const raw = key.toUpperCase();
    return this.crossingKey !== null || this.queue[0]?.key !== raw;
  }
}

export default TrafficController;