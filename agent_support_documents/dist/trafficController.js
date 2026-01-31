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
    constructor(compiledProfile) {
        this.compiledProfile = compiledProfile;
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
    async requestCrossing(key, macroName) {
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