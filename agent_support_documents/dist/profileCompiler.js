/** Normalize a key string to its raw key (uppercase without modifiers)
 * Examples:
 *  - "SHIFT+Z" -> "Z"
 *  - "ALT+NUMPAD7" -> "NUMPAD7"
 */
function rawKeyFrom(key) {
    const parts = key.split("+").map((p) => p.trim());
    return parts[parts.length - 1].toUpperCase();
}
/**
 * Compile a MacroProfile into a CompiledProfile for O(1) runtime checks
 */
export function compileProfile(profile) {
    const rawSet = new Set();
    const shiftSet = new Set();
    const altSet = new Set();
    for (const macro of profile.macros) {
        for (const step of macro.sequence) {
            const key = step.key;
            const parts = key.split("+").map((p) => p.trim());
            const last = parts[parts.length - 1].toUpperCase();
            // detect modifiers
            const hasShift = parts
                .slice(0, -1)
                .some((p) => p.toUpperCase() === "SHIFT");
            const hasAlt = parts.slice(0, -1).some((p) => p.toUpperCase() === "ALT");
            if (!hasShift && !hasAlt) {
                rawSet.add(last);
            }
            if (hasShift) {
                shiftSet.add(last);
            }
            if (hasAlt) {
                altSet.add(last);
            }
        }
    }
    const conundrumKeys = new Set();
    const safeKeys = new Set();
    // Any key that appears in more than one form (raw, shift, alt) is a conundrum
    const allKeys = new Set([...rawSet, ...shiftSet, ...altSet]);
    for (const k of allKeys) {
        const forms = [rawSet.has(k), shiftSet.has(k), altSet.has(k)].filter(Boolean).length;
        if (forms > 1)
            conundrumKeys.add(k);
        else if (forms === 1 && rawSet.has(k))
            safeKeys.add(k);
    }
    return { conundrumKeys, safeKeys };
}
export function isConundrumKey(key, compiled) {
    const raw = rawKeyFrom(key);
    return compiled.conundrumKeys.has(raw);
}
