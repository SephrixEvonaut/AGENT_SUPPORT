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
import { getHumanDelay, getHumanKeyDownDuration } from "./humanRandomizer.js";
/**
 * Special Key Handler
 * Processes SpecialKeyOutputEvents from the Omega gesture detector
 */
export class SpecialKeyHandler {
    config;
    isExecuting = false;
    pendingQueue = [];
    isShutdown = false;
    constructor(config) {
        this.config = config;
    }
    /**
     * Handle a special key output event
     */
    async handleEvent(event) {
        if (this.isShutdown)
            return;
        // Queue events if currently executing
        if (this.isExecuting) {
            this.pendingQueue.push(event);
            return;
        }
        await this.processEvent(event);
    }
    /**
     * Process a single event
     */
    async processEvent(event) {
        if (this.isShutdown)
            return;
        this.isExecuting = true;
        try {
            switch (event.source) {
                case "d_retaliate":
                    await this.processRetaliateOutput(event);
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
        }
        catch (error) {
            console.error(`Special key handler error:`, error);
        }
        finally {
            this.isExecuting = false;
            // Process any queued events
            if (this.pendingQueue.length > 0) {
                const nextEvent = this.pendingQueue.shift();
                await this.processEvent(nextEvent);
            }
        }
    }
    /**
     * Process D key Retaliate output
     * Outputs [count] R presses with randomized timing
     */
    async processRetaliateOutput(event) {
        const { keys, timings } = event;
        if (this.config.debug) {
            console.log(`[SpecialKey] Retaliate: ${keys.length} R presses`);
        }
        // Default timings if not provided
        const keyDownRange = timings?.keyDownMs ?? [34, 76];
        const gapRange = timings?.gapMs ?? [51, 63];
        for (let i = 0; i < keys.length; i++) {
            if (this.isShutdown)
                break;
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
    async processGroupMemberOutput(event) {
        const { keys } = event;
        if (this.config.debug) {
            console.log(`[SpecialKey] Group Member: ${keys.join(" → ")}`);
        }
        // Press each key in sequence with short delays
        for (let i = 0; i < keys.length; i++) {
            if (this.isShutdown)
                break;
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
    async processEscapeOutput(event) {
        if (this.config.debug) {
            console.log(`[SpecialKey] Escape: ESCAPE`);
        }
        const holdDuration = getHumanKeyDownDuration();
        await this.config.onKeyPress("ESCAPE", holdDuration);
    }
    /**
     * Process = key Smash output (handled via gesture, but could be direct)
     */
    async processSmashOutput(event) {
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
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    /**
     * Shutdown the handler
     */
    shutdown() {
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
export async function createSpecialKeyHandler(debug) {
    // Try to import robotjs
    let robot;
    try {
        robot = (await import("robotjs")).default;
        robot.setKeyboardDelay(1);
    }
    catch {
        console.warn("RobotJS not available for special key handler");
        robot = null;
    }
    return new SpecialKeyHandler({
        debug,
        onKeyPress: async (key, holdDurationMs) => {
            if (!robot) {
                console.log(`[MOCK] Key: ${key} (${holdDurationMs}ms)`);
                return;
            }
            // Map special key names to RobotJS format
            const keyMap = {
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
            }
            catch (error) {
                // Fallback to keyTap
                try {
                    robot.keyTap(robotKey);
                }
                catch {
                    console.error(`Failed to press key: ${key}`);
                }
            }
        },
    });
}
export default SpecialKeyHandler;
//# sourceMappingURL=specialKeyHandler.js.map