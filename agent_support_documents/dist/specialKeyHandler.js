// ============================================================================
// SPECIAL KEY HANDLER - Processes direct key outputs from Omega detector
// ============================================================================
//
// This module handles the special key output events from the Omega gesture
// detector, including:
// - D key R streaming (1 R per event, called every 120ms while D held)
// - S key Group Member Toggle (outputs target key + cog)
// - C key double-tap (outputs ESCAPE)
// - = key double-tap (outputs Smash → ])
//
// ============================================================================
import { getHumanDelay, getHumanKeyDownDuration } from "./humanRandomizer.js";
import { getQueuePressureMonitor } from "./queuePressureMonitor.js";
/**
 * Special Key Handler
 * Processes SpecialKeyOutputEvents from the Omega gesture detector
 */
export class SpecialKeyHandler {
    config;
    isExecuting = false;
    pendingQueue = [];
    isShutdown = false;
    // D key stream state - simple flag to block Rs after release
    dStreamActive = false;
    // TTS state
    sayModule = null;
    ttsAvailable = false;
    ttsSpeaking = false;
    constructor(config) {
        this.config = config;
        this.initializeTTS();
    }
    /**
     * Initialize TTS module (say package)
     */
    async initializeTTS() {
        try {
            const sayImport = await import("say");
            this.sayModule = sayImport.default || sayImport;
            this.ttsAvailable = true;
            console.log("[SpecialKey] TTS module loaded successfully");
        }
        catch {
            console.warn("[SpecialKey] TTS module (say) not available");
            this.ttsAvailable = false;
        }
    }
    /**
     * Speak a TTS message. Returns a promise that resolves when done speaking.
     */
    speakTTS(message) {
        if (!this.ttsAvailable || !this.sayModule) {
            console.log(`[SpecialKey][TTS DISABLED] Would speak: "${message}"`);
            return;
        }
        try {
            this.ttsSpeaking = true;
            this.sayModule.speak(message, undefined, undefined, () => {
                this.ttsSpeaking = false;
            });
        }
        catch (error) {
            console.error(`[SpecialKey] TTS error:`, error);
            this.ttsSpeaking = false;
        }
    }
    /**
     * Check if TTS is currently speaking
     */
    isTTSSpeaking() {
        return this.ttsSpeaking;
    }
    /**
     * Handle a special key output event
     */
    async handleEvent(event) {
        if (this.isShutdown)
            return;
        // D release MUST be handled immediately - sets flag to block future Rs
        if (event.source === "d_release") {
            this.handleDRelease();
            return;
        }
        // D stream start - mark as active
        if (event.source === "d_stream") {
            this.dStreamActive = true;
        }
        // Queue events if currently executing
        if (this.isExecuting) {
            // Don't queue d_stream if D was already released
            if (event.source === "d_stream" && !this.dStreamActive) {
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
    async processEvent(event) {
        if (this.isShutdown)
            return;
        this.isExecuting = true;
        try {
            switch (event.source) {
                case "d_stream":
                    await this.processDStreamOutput(event);
                    break;
                case "d_release":
                    this.handleDRelease();
                    break;
                case "d_toggle_tts":
                    this.processDToggleTTS(event);
                    break;
                case "s_group_member":
                case "s_target_of_target":
                    await this.processGroupMemberOutput(event);
                    break;
                case "c_escape":
                    await this.processEscapeOutput(event);
                    break;
                case "equals_smash":
                    await this.processSmashOutput(event);
                    break;
                case "middle_click_zoom_out":
                    await this.processMiddleClickZoomOut(event);
                    break;
                default:
                    // Handle any direct_output with keys
                    if (event.keys && event.keys.length > 0) {
                        await this.processGroupMemberOutput(event);
                    }
                    // Handle TTS on any event with ttsMessage
                    if (event.ttsMessage) {
                        this.speakTTS(event.ttsMessage);
                    }
                    break;
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
     * Handle D key release - IMMEDIATELY stop all R processing
     */
    handleDRelease() {
        this.dStreamActive = false;
        // Clear all pending d_stream events from queue
        this.pendingQueue = this.pendingQueue.filter((e) => e.source !== "d_stream");
    }
    /**
     * Process D toggle TTS event ("on on on" / "off off off")
     */
    processDToggleTTS(event) {
        if (event.ttsMessage) {
            console.log(`[SpecialKey] D Toggle TTS: "${event.ttsMessage}"`);
            this.speakTTS(event.ttsMessage);
        }
        // Also process any keys if present
        if (event.keys && event.keys.length > 0) {
            this.processGroupMemberOutput(event);
        }
    }
    /**
     * Process D key stream output - sends a single R
     * Called every 290ms by the interval in omegaGestureDetector (after 120ms initial delay)
     * Each R is held for 36-41ms (randomized)
     */
    async processDStreamOutput(event) {
        // Safety check - don't send if D was released
        if (!this.dStreamActive) {
            return;
        }
        if (event.keys.length === 0) {
            return;
        }
        // Get hold duration from event timings (36-41ms)
        const keyDownRange = event.timings?.keyDownMs ?? [36, 41];
        const holdDuration = getHumanDelay(keyDownRange[0], keyDownRange[1], "d_stream_hold");
        // Final safety check before pressing
        if (!this.dStreamActive) {
            return;
        }
        // Press the R key
        await this.config.onKeyPress("R", holdDuration);
        // Record R stream output for pressure monitoring (software mode only)
        if (this.config.backendMode !== "teensy") {
            const pressureMonitor = getQueuePressureMonitor();
            pressureMonitor.recordOutput("R_Stream", "R", holdDuration);
        }
    }
    /**
     * Process S key Group Member output
     * Outputs target key followed by cog key
     */
    async processGroupMemberOutput(event) {
        const { keys } = event;
        const usePressureMonitor = this.config.backendMode !== "teensy";
        const pressureMonitor = usePressureMonitor
            ? getQueuePressureMonitor()
            : null;
        if (this.config.debug) {
            console.log(`[SpecialKey] Group Member: ${keys.join(" → ")}`);
        }
        // Press each key in sequence with short delays
        for (let i = 0; i < keys.length; i++) {
            if (this.isShutdown)
                break;
            const key = keys[i];
            const holdDuration = getHumanKeyDownDuration();
            // Suppress synthetic key to prevent re-detection by gesture detector
            // Parse base key from modifier combos like "CTRL+V" → suppress "V"
            const baseKey = key.includes("+") ? key.split("+").pop() : key;
            if (this.config.onSuppressKey) {
                this.config.onSuppressKey(baseKey, holdDuration + 100);
            }
            await this.config.onKeyPress(key, holdDuration);
            if (pressureMonitor) {
                pressureMonitor.recordOutput("S_GroupMember", key, holdDuration);
            }
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
        // Record for pressure monitoring (software mode only)
        if (this.config.backendMode !== "teensy") {
            const pressureMonitor = getQueuePressureMonitor();
            pressureMonitor.recordOutput("C_Escape", "ESCAPE", holdDuration);
        }
    }
    /**
     * Process = key Smash output (handled via gesture, but could be direct)
     */
    async processSmashOutput(event) {
        if (this.config.debug) {
            console.log(`[SpecialKey] Smash: ] (via gesture binding)`);
        }
        const holdDuration = getHumanKeyDownDuration();
        await this.config.onKeyPress("]", holdDuration);
        // Record for pressure monitoring (software mode only)
        if (this.config.backendMode !== "teensy") {
            const pressureMonitor = getQueuePressureMonitor();
            pressureMonitor.recordOutput("Equals_Smash", "]", holdDuration);
        }
    }
    /**
     * Process MIDDLE_CLICK double-tap Max Zoom Out (PAGEDOWN)
     */
    async processMiddleClickZoomOut(event) {
        console.log(`[SpecialKey] Middle Click Zoom Out: PAGEDOWN`);
        const holdDuration = getHumanKeyDownDuration();
        await this.config.onKeyPress("PAGEDOWN", holdDuration);
        // Record for pressure monitoring (software mode only)
        if (this.config.backendMode !== "teensy") {
            const pressureMonitor = getQueuePressureMonitor();
            pressureMonitor.recordOutput("MiddleClick_ZoomOut", "PAGEDOWN", holdDuration);
        }
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
        this.dStreamActive = false;
        this.pendingQueue = [];
    }
}
/**
 * Create a special key handler with RobotJS integration
 */
export async function createSpecialKeyHandler(optionsOrDebug) {
    // Support legacy boolean signature and new options object
    const options = typeof optionsOrDebug === "boolean"
        ? { debug: optionsOrDebug }
        : optionsOrDebug || {};
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
        debug: options.debug,
        onSuppressKey: options.onSuppressKey,
        backendMode: options.backendMode || "software",
        onKeyPress: async (key, holdDurationMs) => {
            // Map special key names to RobotJS format
            const keyMap = {
                // Punctuation keys
                GRAVE: "`",
                BACKSLASH: "\\",
                SLASH: "/",
                MINUS: "-",
                LBRACKET: "[",
                RBRACKET: "]",
                COMMA: ",",
                APOSTROPHE: "'",
                // Navigation/editing keys
                PAGEUP: "pageup",
                PAGEDOWN: "pagedown",
                DELETE: "delete",
                BACKSPACE: "backspace",
                TAB: "tab",
                // Function keys for group member targeting
                F10: "f10",
                F11: "f11",
                F12: "f12",
                INSERT: "insert",
                // Legacy numpad support
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
            // Parse modifier+key combos like "CTRL+B" or "SHIFT+Q"
            const parts = key.split("+").map((p) => p.trim());
            const modifiers = [];
            let baseKey = parts[parts.length - 1];
            // Collect modifiers (all parts except last)
            for (let i = 0; i < parts.length - 1; i++) {
                const m = parts[i].toUpperCase();
                if (m === "CTRL" || m === "CONTROL")
                    modifiers.push("control");
                else if (m === "SHIFT")
                    modifiers.push("shift");
                else if (m === "ALT")
                    modifiers.push("alt");
            }
            // Map the base key
            const robotKey = keyMap[baseKey] || baseKey.toLowerCase();
            // TEENSY PATH: route through hardware executor
            const teensy = options.teensyExecutor;
            if (options.backendMode === "teensy" && teensy) {
                try {
                    await teensy.pressKey(robotKey, holdDurationMs, modifiers);
                }
                catch (error) {
                    console.error(`[Teensy] Failed to press key: ${key}`, error);
                }
                return;
            }
            // SOFTWARE PATH: use RobotJS
            if (!robot) {
                console.log(`[MOCK] Key: ${key} (${holdDurationMs}ms)`);
                return;
            }
            try {
                // Press modifiers down first
                for (const mod of modifiers) {
                    robot.keyToggle(mod, "down");
                }
                robot.keyToggle(robotKey, "down");
                await new Promise((resolve) => setTimeout(resolve, holdDurationMs));
                robot.keyToggle(robotKey, "up");
                // Release modifiers
                for (const mod of modifiers) {
                    robot.keyToggle(mod, "up");
                }
            }
            catch (error) {
                // Fallback to keyTap with modifiers
                try {
                    robot.keyTap(robotKey, modifiers);
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