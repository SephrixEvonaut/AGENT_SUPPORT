import { extractRawKey } from "./utils.js";
import { getHumanTrafficWait } from "./humanRandomizer.js";
/**
 * Sleep for a random duration using human-like randomization
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export class TrafficController {
    crossingKey = null;
    queue = [];
    compiledProfile;
    // Macros with supremacy bypass traffic control entirely
    supremacyMacros = new Set();
    // Stun Break cooldown tracking
    stunBreakCooldownEnd = 0;
    STUN_BREAK_COOLDOWN_MS = 120000; // 120 seconds
    // Callback to get current modifier state
    getModifierState = null;
    constructor(compiledProfile) {
        this.compiledProfile = compiledProfile;
    }
    /**
     * Set callback to get current modifier state for smart conflict detection
     */
    setModifierStateCallback(cb) {
        this.getModifierState = cb;
    }
    /**
     * Grant supremacy to a macro - it will bypass traffic control entirely
     */
    grantSupremacy(macroName) {
        this.supremacyMacros.add(macroName);
    }
    /**
     * Revoke supremacy from a macro
     */
    revokeSupremacy(macroName) {
        this.supremacyMacros.delete(macroName);
    }
    /**
     * Check if a macro has supremacy
     */
    hasSupremacy(macroName) {
        return this.supremacyMacros.has(macroName);
    }
    /**
     * Get all macros with supremacy
     */
    getSupremacyList() {
        return [...this.supremacyMacros];
    }
    /**
     * Check if Stun Break is blocked by cooldown
     * @returns null if available, BlockerInfo if on cooldown
     */
    isStunBreakBlocked() {
        const now = Date.now();
        if (now < this.stunBreakCooldownEnd) {
            const remainingMs = this.stunBreakCooldownEnd - now;
            return {
                reason: `Stun Break on cooldown`,
                cooldownMs: remainingMs,
            };
        }
        return null;
    }
    /**
     * Record Stun Break usage and start cooldown timer
     */
    recordStunBreakUsed() {
        this.stunBreakCooldownEnd = Date.now() + this.STUN_BREAK_COOLDOWN_MS;
    }
    async requestCrossing(key, macroName) {
        // Supremacy macros bypass traffic control
        if (macroName && this.supremacyMacros.has(macroName)) {
            return;
        }
        const raw = extractRawKey(key);
        // R key NEVER cares about traffic control (Retaliate spam)
        if (raw === "R") {
            return;
        }
        // TAB is ULTRA-SENSITIVE: never fire if ALT or CTRL are held
        if (raw === "TAB" && this.getModifierState) {
            const modState = this.getModifierState();
            while (modState.alt || modState.ctrl) {
                // Wait until ALT and CTRL are both released
                const waitMs = getHumanTrafficWait();
                await sleep(waitMs);
                // Re-check modifier state (callback returns fresh state)
                const freshState = this.getModifierState();
                if (!freshState.alt && !freshState.ctrl)
                    break;
            }
        }
        // Check if this key is a conundrum AND if the conflicting modifier is held
        const conflict = this.compiledProfile.conundrumConflicts.get(raw);
        if (!conflict) {
            // Not a conundrum key, no wait needed
            return;
        }
        // Smart conflict detection: only wait if the relevant modifier is held
        if (this.getModifierState) {
            const modState = this.getModifierState();
            // Check if the currently held modifier(s) conflict with this key
            const conflictsNow = this.hasActiveConflict(conflict, modState);
            if (!conflictsNow) {
                // The modifier that conflicts with this key is NOT held, safe to proceed
                return;
            }
        }
        this.queue.push({ key: raw, timestamp: Date.now() });
        while (this.shouldWait(raw)) {
            // Use human-like random wait time instead of fixed range
            const waitMs = getHumanTrafficWait();
            await sleep(waitMs);
        }
        this.crossingKey = raw;
    }
    /**
     * Check if there's an active conflict based on current modifier state
     */
    hasActiveConflict(conflict, modState) {
        switch (conflict) {
            case "shift":
                return modState.shift;
            case "alt":
                return modState.alt;
            case "both":
                return modState.shift || modState.alt;
        }
    }
    releaseCrossing(key) {
        const raw = extractRawKey(key);
        if (this.crossingKey === raw) {
            this.crossingKey = null;
        }
        // Remove any finished items from queue head
        if (this.queue.length > 0 && this.queue[0].key === raw) {
            this.queue.shift();
        }
    }
    shouldWait(key) {
        const raw = key.toUpperCase();
        return this.crossingKey !== null || this.queue[0]?.key !== raw;
    }
}
export default TrafficController;
//# sourceMappingURL=trafficController.js.map