// Patch for conundrum logic: allow ALT+SHIFT combos to not be a conundrum for modifier keys
// This should be merged into profileCompiler.ts logic
import { extractRawKey } from "./utils.js";
/**
 * Compile a MacroProfile into a CompiledProfile for O(1) runtime checks
 * ALT+SHIFT combos are NOT a conundrum for modifier keys (SHIFT/ALT modified keys), but are elsewhere
 */
export function compileProfilePatched(profile) {
    const rawSet = new Set();
    const shiftSet = new Set();
    const altSet = new Set();
    const altShiftSet = new Set();
    for (const macro of profile.macros) {
        for (const step of macro.sequence) {
            if (!step.key)
                continue;
            const key = step.key;
            const parts = key.split("+").map((p) => p.trim());
            const last = extractRawKey(key);
            const hasShift = parts
                .slice(0, -1)
                .some((p) => p.toUpperCase() === "SHIFT");
            const hasAlt = parts.slice(0, -1).some((p) => p.toUpperCase() === "ALT");
            const hasAltShift = hasAlt && hasShift;
            if (!hasShift && !hasAlt) {
                rawSet.add(last);
            }
            if (hasShift && !hasAlt) {
                shiftSet.add(last);
            }
            if (hasAlt && !hasShift) {
                altSet.add(last);
            }
            if (hasAltShift) {
                altShiftSet.add(last);
            }
        }
    }
    const conundrumKeys = new Set();
    const safeKeys = new Set();
    const allKeys = new Set([...rawSet, ...shiftSet, ...altSet, ...altShiftSet]);
    for (const k of allKeys) {
        // If a key appears as raw+shift, raw+alt, or shift+alt, it's a conundrum
        // But if it only appears as alt+shift (and not as raw/shift/alt), it's NOT a conundrum for modifier keys
        const forms = [
            rawSet.has(k),
            shiftSet.has(k),
            altSet.has(k),
            altShiftSet.has(k),
        ].filter(Boolean).length;
        if ((forms > 1 && !(altShiftSet.has(k) && forms === 2)) || forms > 2) {
            conundrumKeys.add(k);
        }
        else if (forms === 1 && rawSet.has(k)) {
            safeKeys.add(k);
        }
    }
    return { conundrumKeys, safeKeys };
}
// Usage: replace compileProfile with compileProfilePatched in your macro agent for this test.
//# sourceMappingURL=profileCompiler-patch-altshift.js.map