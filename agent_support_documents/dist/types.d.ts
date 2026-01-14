export declare const INPUT_KEYS: readonly ["W", "A", "S", "D", "B", "I", "Y", "U", "T", "C", "H", "P", "F2", "1", "2", "3", "4", "5", "6", "7", "8", "9", "MIDDLE_CLICK"];
export type InputKey = (typeof INPUT_KEYS)[number];
export declare const OUTPUT_KEYS: readonly ["J", "K", "L", "M", "N", "O", "Q", "R", "V", "X", "Z", ",", ".", "'", ";", "]", "[", "F6", "F7", "F8", "F9", "NUMPAD0", "NUMPAD1", "NUMPAD2", "NUMPAD3", "NUMPAD4", "NUMPAD5", "NUMPAD6", "NUMPAD7", "NUMPAD8", "NUMPAD9", "NUMPAD_ADD", "NUMPAD_MULTIPLY", "NUMPAD_DECIMAL", "NUMPAD_SUBTRACT", "BACKSPACE", "END", "ESCAPE"];
export type OutputKey = (typeof OUTPUT_KEYS)[number];
export declare const GESTURE_TYPES: readonly ["single", "single_long", "single_super_long", "double", "double_long", "double_super_long", "triple", "triple_long", "triple_super_long", "quadruple", "quadruple_long", "quadruple_super_long"];
export type GestureType = (typeof GESTURE_TYPES)[number];
export interface SequenceStep {
    key: string;
    name?: string;
    minDelay: number;
    maxDelay: number;
    /**
     * How long to hold the key down (inclusive range in ms).
     * Defaults to [23, 38] if omitted.
     * Uses weighted distribution: 37ms=10%, 29ms=10%, 23ms=10%, rest=70% uniform
     */
    keyDownDuration?: [number, number];
    /**
     * Buffer tier after this key press: determines inter-key randomized delay.
     * If omitted, falls back to using minDelay/maxDelay behavior.
     */
    bufferTier?: "low" | "medium" | "high";
    /**
     * Optional second key to press simultaneously (dual key press).
     * Must be a valid OutputKey.
     */
    dualKey?: OutputKey;
    /**
     * Delay in ms before pressing the second key (after primary key down).
     * Must be >= 1ms if provided. Defaults to 6ms.
     */
    dualKeyOffsetMs?: number;
    /**
     * How long to hold the dual key down (inclusive range in ms).
     * Defaults to same as keyDownDuration if omitted.
     */
    dualKeyDownDuration?: [number, number];
    /**
     * If true, this key will be held down through the next step's execution
     * and released during the next step's buffer period.
     * Used for focus target modifiers (e.g., Shift+R) that need to remain
     * held while the next ability executes.
     */
    holdThroughNext?: boolean;
    /**
     * Minimum delay (ms) before releasing a held modifier during next step's buffer.
     * Only applies if holdThroughNext is true.
     * Must be >= 1ms. Defaults to 7ms.
     */
    releaseDelayMin?: number;
    /**
     * Maximum delay (ms) before releasing a held modifier during next step's buffer.
     * Only applies if holdThroughNext is true.
     * Must be >= releaseDelayMin. Defaults to 18ms.
     */
    releaseDelayMax?: number;
}
export interface MacroBinding {
    name: string;
    trigger: {
        key: InputKey;
        gesture: GestureType;
    };
    sequence: SequenceStep[];
    enabled: boolean;
}
export interface GestureSettings {
    multiPressWindow: number;
    debounceDelay: number;
    longPressMin: number;
    longPressMax: number;
    superLongMin: number;
    superLongMax: number;
    cancelThreshold: number;
}
export interface MacroProfile {
    name: string;
    description: string;
    gestureSettings: GestureSettings;
    macros: MacroBinding[];
}
/**
 * Compiled profile for fast runtime lookup
 * - conundrumKeys: raw keys that also appear with modifiers
 * - safeKeys: raw keys that do not appear with modifiers
 */
export interface CompiledProfile {
    conundrumKeys: Set<string>;
    safeKeys: Set<string>;
}
export interface GestureEvent {
    inputKey: InputKey;
    gesture: GestureType;
    timestamp: number;
    holdDuration?: number;
}
export declare const SEQUENCE_CONSTRAINTS: {
    readonly MIN_DELAY: 25;
    readonly MIN_VARIANCE: 4;
    readonly MAX_UNIQUE_KEYS: 6;
    readonly MAX_STEPS_PER_KEY: 6;
};
