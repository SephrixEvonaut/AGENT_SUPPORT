import { extractRawKey } from "./utils.js";
/**
 * Compile a MacroProfile into a CompiledProfile for O(1) runtime checks
 */
export function compileProfile(profile) {
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
        // Check which modifiers this key conflicts with
        const inRaw = rawSet.has(k);
        const inShift = shiftSet.has(k);
        const inAlt = altSet.has(k);
        const inAltShift = altShiftSet.has(k);
        // A raw key is a conundrum if it also appears with modifiers
        if (inRaw && (inShift || inAlt || inAltShift)) {
            conundrumKeys.add(k);
            // Determine which modifiers cause conflicts
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
        // Also check for shift+alt conflicts (key appears as both SHIFT+X and ALT+X)
        if (!inRaw && inShift && inAlt) {
            conundrumKeys.add(k);
            conundrumConflicts.set(k, "both");
        }
    }
    return { conundrumKeys, conundrumConflicts, safeKeys };
}
export function isConundrumKey(key, compiled) {
    const raw = extractRawKey(key);
    return compiled.conundrumKeys.has(raw);
}
//# sourceMappingURL=profileCompiler.js.map