import { ExecutorBackend } from "./executorFactory.js";
/**
 * Backend mode determines which workarounds are active:
 * - "software": Full RobotJS workarounds (RepeatPolice, pressure monitor, aggressive pacing)
 * - "teensy": No workarounds needed (hardware USB HID output, no queue contention)
 */
export type BackendMode = "software" | "teensy";
/**
 * Unified key output interface used by SequenceExecutor and SpecialKeyHandler
 */
export interface IKeyOutputAdapter {
    /** Which backend mode is active */
    readonly mode: BackendMode;
    /** Press key down with optional modifiers */
    keyToggle(key: string, direction: "down" | "up", modifiers?: string[]): void;
    /** Tap a key briefly with optional modifiers */
    keyTap(key: string, modifiers?: string[]): void;
    /** Scroll the mouse wheel */
    scrollMouse(x: number, y: number): void;
    /** Set keyboard delay (robotjs-specific, no-op for teensy) */
    setKeyboardDelay(ms: number): void;
    /**
     * Press a key for a specific duration (teensy-optimized path).
     * For robotjs, this is keyToggle down → sleep → keyToggle up.
     * For teensy, this is a single serial command with built-in duration.
     */
    pressKeyForDuration?(key: string, durationMs: number, modifiers?: string[]): Promise<void>;
}
/**
 * RobotJS adapter - wraps the robotjs module
 */
export declare class RobotJSAdapter implements IKeyOutputAdapter {
    readonly mode: BackendMode;
    private robot;
    constructor();
    /** Initialize with the robotjs module reference */
    init(robotModule: any): void;
    keyToggle(key: string, direction: "down" | "up", modifiers?: string[]): void;
    keyTap(key: string, modifiers?: string[]): void;
    scrollMouse(x: number, y: number): void;
    setKeyboardDelay(ms: number): void;
}
/**
 * Teensy adapter - wraps TeensyExecutor for serial communication
 */
export declare class TeensyAdapter implements IKeyOutputAdapter {
    readonly mode: BackendMode;
    private teensyExecutor;
    constructor(teensyExecutor: any);
    keyToggle(key: string, direction: "down" | "up", modifiers?: string[]): void;
    keyTap(key: string, modifiers?: string[]): void;
    scrollMouse(_x: number, _y: number): void;
    setKeyboardDelay(_ms: number): void;
    /**
     * Press a key for a specific duration - the primary Teensy output method.
     * Sends a single serial command; the Teensy handles the hold internally.
     */
    pressKeyForDuration(key: string, durationMs: number, modifiers?: string[]): Promise<void>;
}
/**
 * Determine backend mode from executor backend name
 */
export declare function getBackendMode(backend: ExecutorBackend): BackendMode;
//# sourceMappingURL=keyOutputAdapter.d.ts.map