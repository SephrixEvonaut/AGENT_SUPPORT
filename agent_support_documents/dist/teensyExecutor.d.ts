interface TeensyConfig {
    baudRate?: number;
    timeout?: number;
}
export declare class TeensyExecutor {
    private port;
    private parser;
    private isReady;
    private pendingCommands;
    private config;
    private commandId;
    constructor(config?: TeensyConfig);
    connect(): Promise<void>;
    private findTeensyPort;
    private handleResponse;
    private sendCommand;
    /**
     * Press a key for a given duration with optional modifiers.
     * This is the primary method used by the sequence executor.
     */
    pressKey(key: string, durationMs?: number, modifiers?: string[]): Promise<void>;
    /**
     * Tap a key briefly (50ms default)
     */
    keyTap(key: string, modifiers?: string[]): Promise<void>;
    /**
     * Toggle a key down or up.
     * NOTE: The Teensy sketch currently only supports press-and-release in one command.
     * For hold-through-next patterns, we send a short press on "down" -
     * full hold/release protocol would need HOLD/RELEASE commands added to the sketch.
     */
    keyToggle(key: string, down: boolean, modifiers?: string[]): Promise<void>;
    /**
     * Ping the Teensy to verify connection
     */
    ping(): Promise<boolean>;
    /**
     * Release all currently held keys on the Teensy
     */
    releaseAll(): Promise<void>;
    /**
     * Map our key names to Teensy-compatible key names
     */
    private mapKeyName;
    /**
     * Disconnect from the Teensy serial port
     */
    disconnect(): Promise<void>;
    /**
     * Check if the Teensy is currently connected and ready
     */
    get connected(): boolean;
    /**
     * List all available serial ports (diagnostic utility)
     */
    static listPorts(): Promise<void>;
}
/**
 * Get or create the singleton TeensyExecutor instance
 */
export declare function getTeensyExecutor(config?: TeensyConfig): Promise<TeensyExecutor>;
/**
 * Disconnect and clear the singleton instance
 */
export declare function disconnectTeensy(): Promise<void>;
/**
 * Check if a Teensy 4.0 is connected to any serial port
 */
export declare function isTeensyAvailable(): Promise<boolean>;
export {};
//# sourceMappingURL=teensyExecutor.d.ts.map