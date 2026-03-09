// ============================================================================
// INPUT LISTENER - Global keyboard/mouse capture
// ============================================================================
//
// This module provides both a test listener (stdin) and a production global
// listener using node-global-key-listener.
//
// INSTALLATION (for production use):
//   npm install node-global-key-listener
//
// The GlobalInputListener will automatically detect if the package is
// available and fall back to stdin mode if not.
//
// ============================================================================
import { INPUT_KEYS } from "./types.js";
// Key name mapping from node-global-key-listener to our InputKey format
const KEY_NAME_MAP = {
    SPACE: "SPACEBAR",
    " ": "SPACEBAR",
    RETURN: "ENTER",
    ESCAPE: "ESCAPE",
    // Azeron joystick keys
    "NUMPAD 4": "NUMPAD4",
    "NUMPAD 5": "NUMPAD5",
    "NUMPAD 6": "NUMPAD6",
    // Semicolon for forward movement (replaces NUMPAD8)
    SEMICOLON: ";",
    OEM_1: ";", // Windows virtual key for semicolon
    // Venus mouse middle click
    "MOUSE MIDDLE": "MIDDLE_CLICK",
    // Equals key variants
    EQUAL: "=",
    EQUALS: "=",
    OEM_PLUS: "=", // Windows virtual key name
    // Group member keys (for config mode)
    F10: "F10",
    F11: "F11",
    F12: "F12",
    INSERT: "INSERT",
    // Letters are already uppercase
};
// ============================================================================
// STDIN-BASED INPUT LISTENER (for testing)
// ============================================================================
export class StdinInputListener {
    callback;
    isListening = false;
    constructor(callback) {
        this.callback = callback;
    }
    start() {
        if (this.isListening)
            return;
        this.isListening = true;
        console.log("\n🎧 Input Listener started (stdin mode - for testing)");
        console.log("   Press keys to test gesture detection");
        console.log("   Press Ctrl+C to exit\n");
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.setEncoding("utf8");
            process.stdin.on("data", (data) => {
                const key = data.toString();
                if (key === "\u0003") {
                    console.log("\n👋 Exiting...");
                    process.exit();
                }
                const upperKey = key.toUpperCase();
                this.callback({
                    key: upperKey,
                    type: "down",
                    timestamp: Date.now(),
                });
                setTimeout(() => {
                    this.callback({
                        key: upperKey,
                        type: "up",
                        timestamp: Date.now(),
                    });
                }, 50);
            });
        }
        else {
            console.log("⚠️  stdin not in TTY mode, using line-based input");
            process.stdin.resume();
            process.stdin.setEncoding("utf8");
            process.stdin.on("data", (data) => {
                const key = data.toString().trim().toUpperCase();
                if (!key)
                    return;
                this.callback({ key, type: "down", timestamp: Date.now() });
                setTimeout(() => {
                    this.callback({ key, type: "up", timestamp: Date.now() });
                }, 50);
            });
        }
    }
    stop() {
        this.isListening = false;
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }
        console.log("🛑 Input Listener stopped");
    }
    isActive() {
        return this.isListening;
    }
}
export class GlobalInputListener {
    callback;
    isListening = false;
    isStopped = false; // Guard against events after stop
    listener = null;
    rawEventCallback = null;
    hotkeyCallback = null;
    // Track current modifier state
    currentModifierState = {
        shift: false,
        alt: false,
        ctrl: false,
    };
    constructor(callback) {
        this.callback = callback;
    }
    /**
     * Set a callback to receive ALL raw key events (for debugging peripherals)
     */
    setRawEventCallback(cb) {
        this.rawEventCallback = cb;
    }
    /**
     * Set a callback for special hotkey combinations (e.g., CTRL+SHIFT+G)
     */
    setHotkeyCallback(cb) {
        this.hotkeyCallback = cb;
    }
    /**
     * Get current modifier state (for traffic control)
     */
    getModifierState() {
        return { ...this.currentModifierState };
    }
    async start() {
        if (this.isListening)
            return;
        try {
            // Dynamic import of node-global-key-listener (optional dependency)
            const { GlobalKeyboardListener } = await import("node-global-key-listener");
            this.listener = new GlobalKeyboardListener();
            this.listener.addListener((e, down) => {
                // CRITICAL: Ignore ALL events after stop() is called
                if (this.isStopped) {
                    return;
                }
                // Update modifier state from the down record
                this.currentModifierState = {
                    shift: !!(down["LEFT SHIFT"] || down["RIGHT SHIFT"]),
                    alt: !!(down["LEFT ALT"] || down["RIGHT ALT"]),
                    ctrl: !!(down["LEFT CTRL"] || down["RIGHT CTRL"]),
                };
                // If raw event callback is set, forward ALL events for debugging
                if (this.rawEventCallback) {
                    this.rawEventCallback(e.name, e.state, e);
                }
                // Check for hotkeys (CTRL+SHIFT+G for config mode)
                if (this.hotkeyCallback && e.state === "DOWN") {
                    const ctrlHeld = down["LEFT CTRL"] || down["RIGHT CTRL"];
                    const shiftHeld = down["LEFT SHIFT"] || down["RIGHT SHIFT"];
                    if (ctrlHeld && shiftHeld && e.name === "G") {
                        this.hotkeyCallback("CTRL+SHIFT+G");
                        return; // Don't process further
                    }
                }
                // Early exit filter: check if event name is in INPUT_KEYS (saves 80% of processing)
                const keyName = KEY_NAME_MAP[e.name] || e.name;
                const upperName = keyName.toUpperCase();
                if (!INPUT_KEYS.includes(upperName)) {
                    return; // Ignore keys we don't track
                }
                const eventType = e.state === "DOWN" ? "down" : "up";
                this.callback({
                    key: upperName,
                    type: eventType,
                    timestamp: Date.now(),
                });
            });
            this.isListening = true;
            console.log("\n🎧 Global Input Listener started (node-global-key-listener)");
            console.log("   Listening for global keyboard events...");
            console.log("   Recognized keys:", INPUT_KEYS.slice(0, 18).join(", "));
            console.log("   Press Ctrl+C to exit\n");
        }
        catch (error) {
            console.error("❌ Failed to start global listener:", error.message);
            console.log("");
            console.log("📦 To enable global key capture, install node-global-key-listener:");
            console.log("   npm install node-global-key-listener");
            console.log("");
            console.log("⚠️  Falling back to stdin mode (only works when terminal is focused)");
            console.log("");
            // Fall back to stdin listener
            const fallback = new StdinInputListener(this.callback);
            fallback.start();
            this.isListening = true;
        }
    }
    stop() {
        // Set flag FIRST to block any in-flight events immediately
        this.isStopped = true;
        if (this.listener) {
            // GlobalKeyboardListener doesn't have a stop method, it's garbage collected
            this.listener = null;
        }
        this.isListening = false;
        console.log("🛑 Global Input Listener stopped");
    }
    isActive() {
        return this.isListening;
    }
}
export async function createInputListener(callback, mode = "auto") {
    if (mode === "stdin") {
        return new StdinInputListener(callback);
    }
    if (mode === "global" || mode === "auto") {
        // Try to create global listener
        try {
            await import("node-global-key-listener");
            return new GlobalInputListener(callback);
        }
        catch {
            if (mode === "global") {
                console.warn("⚠️  node-global-key-listener not available, install with:");
                console.warn("   npm install node-global-key-listener");
            }
            return new StdinInputListener(callback);
        }
    }
    return new StdinInputListener(callback);
}
// Default export for backward compatibility
export class InputListener {
    delegate;
    callback;
    initialized = false;
    rawEventCallback = null;
    hotkeyCallback = null;
    forceStdin;
    constructor(callback) {
        this.callback = callback;
        this.delegate = new StdinInputListener(callback);
        // Check environment variable to force stdin mode
        this.forceStdin =
            process.env.INPUT_MODE === "stdin" || process.argv.includes("--stdin");
    }
    /**
     * Enable raw event debugging - shows ALL key events including unrecognized ones
     */
    setRawEventCallback(cb) {
        this.rawEventCallback = cb;
    }
    /**
     * Set callback for special hotkeys (e.g., CTRL+SHIFT+G for config mode)
     */
    setHotkeyCallback(cb) {
        this.hotkeyCallback = cb;
    }
    /**
     * Get current modifier state (for traffic control)
     * Returns shift/alt state from the underlying GlobalInputListener
     */
    getModifierState() {
        if (this.delegate instanceof GlobalInputListener) {
            return this.delegate.getModifierState();
        }
        // Stdin mode doesn't track modifiers
        return { shift: false, alt: false, ctrl: false };
    }
    async start() {
        if (!this.initialized) {
            const mode = this.forceStdin ? "stdin" : "auto";
            this.delegate = await createInputListener(this.callback, mode);
            this.initialized = true;
            // If raw callback was set before start, apply it to the GlobalInputListener
            if (this.rawEventCallback &&
                this.delegate instanceof GlobalInputListener) {
                this.delegate.setRawEventCallback(this.rawEventCallback);
            }
            // If hotkey callback was set before start, apply it to the GlobalInputListener
            if (this.hotkeyCallback && this.delegate instanceof GlobalInputListener) {
                this.delegate.setHotkeyCallback(this.hotkeyCallback);
            }
        }
        if ("start" in this.delegate) {
            const startFn = this.delegate.start.bind(this.delegate);
            if (startFn.constructor.name === "AsyncFunction") {
                await startFn();
            }
            else {
                startFn();
            }
        }
    }
    stop() {
        this.delegate.stop();
    }
    isActive() {
        return this.delegate.isActive();
    }
}
//# sourceMappingURL=inputListener.js.map