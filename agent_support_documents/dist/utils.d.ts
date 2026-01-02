/**
 * Get random integer between min and max (inclusive)
 */
export declare function randomRange(min: number, max: number): number;
/**
 * Sleep for specified milliseconds
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Extract raw key from a key string (removes modifiers)
 * Examples:
 *  - "SHIFT+Z" -> "Z"
 *  - "ALT+NUMPAD7" -> "NUMPAD7"
 *  - "K" -> "K"
 */
export declare function extractRawKey(key: string): string;
/**
 * Parse a key string into base key and modifiers
 * @param key Key string like "SHIFT+K" or "ALT+NUMPAD7"
 * @returns Object with normalized key and modifier array
 */
export declare function parseKeyWithModifiers(key: string): {
    key: string;
    modifiers: string[];
};
