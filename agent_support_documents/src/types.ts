// ============================================================================
// SWTOR MACRO AGENT - TYPE DEFINITIONS
// ============================================================================

// 23 Input Keys for gesture detection
export const INPUT_KEYS = [
  // Letters (Azeron finger keys)
  "W",
  "A",
  "S",
  "D",
  "B",
  "I",
  "Y",
  "U",
  "T",
  "C",
  "H",
  "P",
  // Function key
  "F2",
  // Number keys
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  // Special keys
  "=",
  // Venus mouse
  "MIDDLE_CLICK",
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

  // Special Keys (3 keys)
  "BACKSPACE",
  "END",
  "ESCAPE",
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

  /**
   * Scroll direction for scroll steps. If set, this step performs a scroll instead of keypress.
   */
  scrollDirection?: "up" | "down";

  /**
   * Number of scroll units (lines). Defaults to 3 if scrollDirection is set.
   */
  scrollMagnitude?: number;

  /**
   * Echo hits: rapid repeat keypresses during the buffer phase.
   * The key is held and re-pressed 2-3 times within the specified window
   * to ensure ability activation even with game lag.
   * Format: { count: 2|3, windowMs: total window time (e.g., 170) }
   * Presses occur during buffer, not as extra delays.
   */
  echoHits?: {
    count: 2 | 3;
    windowMs: number;
  };
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
  MAX_UNIQUE_KEYS: 6, // Maximum 6 unique keys per sequence
  MAX_STEPS_PER_KEY: 6, // Maximum 6 steps per key
} as const;
