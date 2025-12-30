export declare const INPUT_KEYS: readonly ["W", "A", "S", "D", "B", "I", "T", "C", "H", "Y", "U", "P", "1", "2", "3", "4", "5", "6", "LEFT_CLICK", "RIGHT_CLICK", "MIDDLE_CLICK", "SCROLL_UP"];
export type InputKey = typeof INPUT_KEYS[number];
export declare const GESTURE_TYPES: readonly ["single", "single_long", "single_super_long", "double", "double_long", "double_super_long", "triple", "triple_long", "triple_super_long", "quadruple", "quadruple_long", "quadruple_super_long"];
export type GestureType = typeof GESTURE_TYPES[number];
export interface SequenceStep {
    key: string;
    name?: string;
    minDelay: number;
    maxDelay: number;
    echoHits?: number;
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
export interface GestureEvent {
    inputKey: InputKey;
    gesture: GestureType;
    timestamp: number;
    holdDuration?: number;
}
export declare const SEQUENCE_CONSTRAINTS: {
    readonly MIN_DELAY: 25;
    readonly MIN_VARIANCE: 4;
    readonly MAX_UNIQUE_KEYS: 4;
    readonly MAX_STEPS_PER_KEY: 6;
    readonly MAX_ECHO_HITS: 6;
    readonly MAX_REPEATS_PER_KEY: 6;
};
