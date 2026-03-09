// ============================================================================
// KEY OUTPUT ADAPTER - Abstraction layer for keyboard output backends
// ============================================================================
//
// This module defines a common interface for keyboard output, allowing
// the SequenceExecutor and SpecialKeyHandler to work with either:
//   - RobotJS (software injection via SendInput API)
//   - Teensy 4.0 (hardware USB HID keyboard via serial)
//
// The adapter also carries backend metadata so consumers can conditionally
// enable/disable RobotJS-specific workarounds (RepeatPolice, queue pressure
// monitoring, aggressive output pacing).
//
// ============================================================================
/**
 * RobotJS adapter - wraps the robotjs module
 */
export class RobotJSAdapter {
    mode = "software";
    robot;
    constructor() {
        // Dynamic import would be async, so we do sync require-style
        // robotjs is already imported at the top of sequenceExecutor.ts
        // This adapter is constructed with the already-imported robot
        this.robot = null;
    }
    /** Initialize with the robotjs module reference */
    init(robotModule) {
        this.robot = robotModule;
    }
    keyToggle(key, direction, modifiers) {
        if (!this.robot)
            return;
        this.robot.keyToggle(key, direction, modifiers);
    }
    keyTap(key, modifiers) {
        if (!this.robot)
            return;
        this.robot.keyTap(key, modifiers);
    }
    scrollMouse(x, y) {
        if (!this.robot)
            return;
        this.robot.scrollMouse(x, y);
    }
    setKeyboardDelay(ms) {
        if (!this.robot)
            return;
        this.robot.setKeyboardDelay(ms);
    }
}
/**
 * Teensy adapter - wraps TeensyExecutor for serial communication
 */
export class TeensyAdapter {
    mode = "teensy";
    teensyExecutor; // TeensyExecutor instance
    constructor(teensyExecutor) {
        this.teensyExecutor = teensyExecutor;
    }
    keyToggle(key, direction, modifiers) {
        // Teensy doesn't support separate down/up - it does press+hold+release atomically
        // For "down", we send a minimal press; for "up", it's a no-op
        if (direction === "down") {
            // Fire and forget a minimal press - the actual hold duration is handled by pressKeyForDuration
            this.teensyExecutor
                .pressKey(key, 10, modifiers || [])
                .catch((err) => {
                console.error(`[Teensy] keyToggle error: ${err.message}`);
            });
        }
        // "up" is a no-op - Teensy auto-releases after duration
    }
    keyTap(key, modifiers) {
        this.teensyExecutor
            .pressKey(key, 50, modifiers || [])
            .catch((err) => {
            console.error(`[Teensy] keyTap error: ${err.message}`);
        });
    }
    scrollMouse(_x, _y) {
        // Teensy doesn't handle mouse scroll - this stays on the host
        // For scroll steps, we fall back to robotjs if available
        try {
            const robot = require("robotjs");
            robot.scrollMouse(_x, _y);
        }
        catch {
            console.warn("[Teensy] scrollMouse not available (no robotjs fallback)");
        }
    }
    setKeyboardDelay(_ms) {
        // No-op for Teensy
    }
    /**
     * Press a key for a specific duration - the primary Teensy output method.
     * Sends a single serial command; the Teensy handles the hold internally.
     */
    async pressKeyForDuration(key, durationMs, modifiers) {
        await this.teensyExecutor.pressKey(key, durationMs, modifiers || []);
    }
}
/**
 * Determine backend mode from executor backend name
 */
export function getBackendMode(backend) {
    return backend === "teensy" ? "teensy" : "software";
}
//# sourceMappingURL=keyOutputAdapter.js.map