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

import { InputKey, INPUT_KEYS } from "./types.js";

export interface KeyEvent {
  key: string;
  type: "down" | "up";
  timestamp: number;
}

export interface MouseEvent {
  button: "LEFT_CLICK" | "RIGHT_CLICK" | "MIDDLE_CLICK";
  type: "down" | "up";
  timestamp: number;
}

export type InputCallback = (event: KeyEvent | MouseEvent) => void;

// Key name mapping from node-global-key-listener to our InputKey format
const KEY_NAME_MAP: Record<string, string> = {
  SPACE: "SPACE",
  RETURN: "ENTER",
  ESCAPE: "ESCAPE",
  // Letters are already uppercase
};

// Interface for the listener
export interface IInputListener {
  start(): void;
  stop(): void;
  isActive(): boolean;
}

// ============================================================================
// STDIN-BASED INPUT LISTENER (for testing)
// ============================================================================

export class StdinInputListener implements IInputListener {
  private callback: InputCallback;
  private isListening: boolean = false;

  constructor(callback: InputCallback) {
    this.callback = callback;
  }

  start(): void {
    if (this.isListening) return;
    this.isListening = true;

    console.log("\n🎧 Input Listener started (stdin mode - for testing)");
    console.log("   Press keys to test gesture detection");
    console.log("   Press Ctrl+C to exit\n");

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");

      process.stdin.on("data", (data: string) => {
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
    } else {
      console.log("⚠️  stdin not in TTY mode, using line-based input");
      process.stdin.resume();
      process.stdin.setEncoding("utf8");

      process.stdin.on("data", (data: string) => {
        const key = data.toString().trim().toUpperCase();
        if (!key) return;

        this.callback({ key, type: "down", timestamp: Date.now() });
        setTimeout(() => {
          this.callback({ key, type: "up", timestamp: Date.now() });
        }, 50);
      });
    }
  }

  stop(): void {
    this.isListening = false;
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    console.log("🛑 Input Listener stopped");
  }

  isActive(): boolean {
    return this.isListening;
  }
}

// ============================================================================
// GLOBAL INPUT LISTENER (using node-global-key-listener)
// ============================================================================

export class GlobalInputListener implements IInputListener {
  private callback: InputCallback;
  private isListening: boolean = false;
  private listener: any = null;

  constructor(callback: InputCallback) {
    this.callback = callback;
  }

  async start(): Promise<void> {
    if (this.isListening) return;

    try {
      // Dynamic import of node-global-key-listener
      const { GlobalKeyboardListener } = await import(
        "node-global-key-listener"
      );

      this.listener = new GlobalKeyboardListener();

      this.listener.addListener((e: any, down: Record<string, boolean>) => {
        // Map the key name
        const keyName = KEY_NAME_MAP[e.name] || e.name;

        // Only process keys we care about (22 input keys)
        if (!INPUT_KEYS.includes(keyName as InputKey)) {
          // Check if it's a key we recognize
          const upperName = keyName.toUpperCase();
          if (!INPUT_KEYS.includes(upperName as InputKey)) {
            return; // Ignore keys we don't track
          }
        }

        const eventType = e.state === "DOWN" ? "down" : "up";

        this.callback({
          key: keyName.toUpperCase(),
          type: eventType,
          timestamp: Date.now(),
        });
      });

      this.isListening = true;
      console.log(
        "\n🎧 Global Input Listener started (node-global-key-listener)"
      );
      console.log("   Listening for global keyboard events...");
      console.log("   Recognized keys:", INPUT_KEYS.slice(0, 18).join(", "));
      console.log("   Press Ctrl+C to exit\n");
    } catch (error: any) {
      console.error("❌ Failed to start global listener:", error.message);
      console.log("");
      console.log(
        "📦 To enable global key capture, install node-global-key-listener:"
      );
      console.log("   npm install node-global-key-listener");
      console.log("");
      console.log(
        "⚠️  Falling back to stdin mode (only works when terminal is focused)"
      );
      console.log("");

      // Fall back to stdin listener
      const fallback = new StdinInputListener(this.callback);
      fallback.start();
      this.isListening = true;
    }
  }

  stop(): void {
    if (this.listener) {
      // GlobalKeyboardListener doesn't have a stop method, it's garbage collected
      this.listener = null;
    }
    this.isListening = false;
    console.log("🛑 Global Input Listener stopped");
  }

  isActive(): boolean {
    return this.isListening;
  }
}

// ============================================================================
// INPUT LISTENER FACTORY
// ============================================================================

export type ListenerMode = "auto" | "global" | "stdin";

export async function createInputListener(
  callback: InputCallback,
  mode: ListenerMode = "auto"
): Promise<IInputListener> {
  if (mode === "stdin") {
    return new StdinInputListener(callback);
  }

  if (mode === "global" || mode === "auto") {
    // Try to create global listener
    try {
      await import("node-global-key-listener");
      return new GlobalInputListener(callback);
    } catch {
      if (mode === "global") {
        console.warn(
          "⚠️  node-global-key-listener not available, install with:"
        );
        console.warn("   npm install node-global-key-listener");
      }
      return new StdinInputListener(callback);
    }
  }

  return new StdinInputListener(callback);
}

// Default export for backward compatibility
export class InputListener implements IInputListener {
  private delegate: IInputListener;
  private callback: InputCallback;
  private initialized: boolean = false;

  constructor(callback: InputCallback) {
    this.callback = callback;
    this.delegate = new StdinInputListener(callback);
  }

  async start(): Promise<void> {
    if (!this.initialized) {
      this.delegate = await createInputListener(this.callback, "auto");
      this.initialized = true;
    }

    if ("start" in this.delegate) {
      const startFn = this.delegate.start.bind(this.delegate);
      if (startFn.constructor.name === "AsyncFunction") {
        await startFn();
      } else {
        startFn();
      }
    }
  }

  stop(): void {
    this.delegate.stop();
  }

  isActive(): boolean {
    return this.delegate.isActive();
  }
}
