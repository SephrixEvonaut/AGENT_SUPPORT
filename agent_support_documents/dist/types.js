// ============================================================================
// SWTOR MACRO AGENT - TYPE DEFINITIONS
// ============================================================================
// 22 Input Keys for gesture detection
export const INPUT_KEYS = [
    "W", "A", "S", "D",
    "B", "I", "T", "C", "H", "Y", "U", "P",
    "1", "2", "3", "4", "5", "6",
    "LEFT_CLICK", "RIGHT_CLICK", "MIDDLE_CLICK", "SCROLL_UP"
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
