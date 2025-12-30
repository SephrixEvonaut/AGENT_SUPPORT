// ============================================================================
// SWTOR MACRO AGENT - TYPE DEFINITIONS
// ============================================================================

// 22 Input Keys for gesture detection
export const INPUT_KEYS = [
  "W",
  "A",
  "S",
  "D",
  "B",
  "I",
  "T",
  "C",
  "H",
  "Y",
  "U",
  "P",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "LEFT_CLICK",
  "RIGHT_CLICK",
  "MIDDLE_CLICK",
  "SCROLL_UP",
] as const;

export type InputKey = (typeof INPUT_KEYS)[number];

// 37 Output keys available for emission (letters, punctuation, function, numpad, special)
export const OUTPUT_KEYS = [
  // Letters (11 keys)
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "Q",
  "R",
  "V",
  "X",
  "Z",

  // Punctuation (6 keys)
  ",",
  ".",
  "'",
  ";",
  "]",
  "[",

  // Function Keys (4 keys)
  "F6",
  "F7",
  "F8",
  "F9",

  // Numpad (14 keys)
  "NUMPAD0",
  "NUMPAD1",
  "NUMPAD2",
  "NUMPAD3",
  "NUMPAD4",
  "NUMPAD5",
  "NUMPAD6",
  "NUMPAD7",
  "NUMPAD8",
  "NUMPAD9",
  "NUMPAD_ADD",
  "NUMPAD_MULTIPLY",
  "NUMPAD_DECIMAL",
  "NUMPAD_SUBTRACT",

  // Special Keys (2 keys)
  "BACKSPACE",
  "END",
] as const;

export type OutputKey = (typeof OUTPUT_KEYS)[number];

// 12 Gesture Types (expanded: single/double/triple/quadruple with long + super_long variants)
export const GESTURE_TYPES = [
  "single",
  "single_long",
  "single_super_long",

  "double",
  "double_long",
  "double_super_long",

  "triple",
  "triple_long",
  "triple_super_long",

  "quadruple",
  "quadruple_long",
  "quadruple_super_long",
] as const;

export type GestureType = (typeof GESTURE_TYPES)[number];

// Timing configuration for a single keypress in a sequence
export interface SequenceStep {
  key: string; // The key to press (e.g., "a", "b", "f1")
  name?: string; // Optional step name for display/debugging
  minDelay: number; // Minimum ms before next press (>= 25ms)
  maxDelay: number; // Maximum ms before next press (variance >= 4ms)
  echoHits?: number; // Number of times to repeat this key (1-6, default 1)
  /**
   * How long to hold the key down (inclusive range in ms).
   * Defaults to [15, 27] if omitted.
   */
  keyDownDuration?: [number, number];

  /**
   * Buffer tier after this key press: determines inter-key randomized delay.
   * If omitted, falls back to using minDelay/maxDelay behavior.
   */
  bufferTier?: "low" | "medium" | "high";
}

// A macro binding: gesture triggers a sequence
export interface MacroBinding {
  name: string;
  trigger: {
    key: InputKey;
    gesture: GestureType;
  };
  sequence: SequenceStep[];
  enabled: boolean;
}

// Gesture detection timing settings
export interface GestureSettings {
  multiPressWindow: number; // Window for detecting multi-presses (ms)
  debounceDelay: number; // Debounce for key events (ms)
  longPressMin: number; // Minimum for long press (ms)
  longPressMax: number; // Maximum for long press (ms)
  superLongMin: number; // Minimum for super long (ms)
  superLongMax: number; // Maximum for super long (ms)
  cancelThreshold: number; // Hold time to trigger cancel (ms)
}

// Complete macro profile
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

// Gesture detection event
export interface GestureEvent {
  inputKey: InputKey;
  gesture: GestureType;
  timestamp: number;
  holdDuration?: number;
}

// Sequence execution constraints
export const SEQUENCE_CONSTRAINTS = {
  MIN_DELAY: 25, // Never faster than 25ms
  MIN_VARIANCE: 4, // max - min must be >= 4ms
  MAX_UNIQUE_KEYS: 4, // Maximum 4 unique keys per sequence
  MAX_STEPS_PER_KEY: 6, // Maximum 6 steps per key (echoHits don't count toward this)
  MAX_ECHO_HITS: 6, // Each step can have 1-6 echo hits (repeats within the step)
  MAX_REPEATS_PER_KEY: 6, // Legacy alias for MAX_ECHO_HITS - kept for backward compatibility
} as const;
