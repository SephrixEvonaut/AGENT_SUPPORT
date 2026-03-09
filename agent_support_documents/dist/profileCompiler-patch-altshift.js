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
    const conundrumConflicts = new Map();
    const safeKeys = new Set();
    const allKeys = new Set([...rawSet, ...shiftSet, ...altSet, ...altShiftSet]);
    for (const k of allKeys) {
        const inRaw = rawSet.has(k);
        const inShift = shiftSet.has(k);
        const inAlt = altSet.has(k);
        const inAltShift = altShiftSet.has(k);
        // A raw key is a conundrum if it also appears with modifiers
        if (inRaw && (inShift || inAlt || inAltShift)) {
            conundrumKeys.add(k);
            const conflictsWithShift = inShift || inAltShift;
            const conflictsWithAlt = inAlt || inAltShift;
            if (conflictsWithShift && conflictsWithAlt) {
                conundrumConflicts.set(k, "both");
            }
            else if (conflictsWithShift) {
                conundrumConflicts.set(k, "shift");
            }
            else if (conflictsWithAlt) {
                conundrumConflicts.set(k, "alt");
            }
        }
        else if (inRaw) {
            safeKeys.add(k);
        }
        // Also check for shift+alt conflicts
        if (!inRaw && inShift && inAlt) {
            conundrumKeys.add(k);
            conundrumConflicts.set(k, "both");
        }
    }
    return { conundrumKeys, conundrumConflicts, safeKeys };
}
// Usage: replace compileProfile with compileProfilePatched in your macro agent for this test.
//# sourceMappingURL=profileCompiler-patch-altshift.js.map