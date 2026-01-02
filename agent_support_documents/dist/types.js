// ============================================================================
// SWTOR MACRO AGENT - TYPE DEFINITIONS
// ============================================================================
// 25 Input Keys for gesture detection
export const INPUT_KEYS = [
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
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "LEFT_CLICK",
    "RIGHT_CLICK",
    "MIDDLE_CLICK",
    "SCROLL_UP",
];
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
];
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
];
// Sequence execution constraints
export const SEQUENCE_CONSTRAINTS = {
    MIN_DELAY: 25, // Never faster than 25ms
    MIN_VARIANCE: 4, // max - min must be >= 4ms
    MAX_UNIQUE_KEYS: 4, // Maximum 4 unique keys per sequence
    MAX_STEPS_PER_KEY: 6, // Maximum 6 steps per key (echoHits don't count toward this)
    MAX_ECHO_HITS: 6, // Each step can have 1-6 echo hits (repeats within the step)
    MAX_REPEATS_PER_KEY: 6, // Legacy alias for MAX_ECHO_HITS - kept for backward compatibility
};
