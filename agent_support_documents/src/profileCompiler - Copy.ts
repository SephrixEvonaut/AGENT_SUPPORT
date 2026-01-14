import { MacroProfile, CompiledProfile } from "./types.js";
import { extractRawKey } from "./utils.js";

/**
 * Compile a MacroProfile into a CompiledProfile for O(1) runtime checks
 */
export function compileProfile(profile: MacroProfile): CompiledProfile {
  const rawSet = new Set<string>();
  const shiftSet = new Set<string>();
  const altSet = new Set<string>();
  const altShiftSet = new Set<string>();

  for (const macro of profile.macros) {
    for (const step of macro.sequence) {
      if (!step.key) continue;
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

  const conundrumKeys = new Set<string>();
  const safeKeys = new Set<string>();
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
    } else if (forms === 1 && rawSet.has(k)) {
      safeKeys.add(k);
    }
  }
  return { conundrumKeys, safeKeys };
}

export function isConundrumKey(
  key: string,
  compiled: CompiledProfile
): boolean {
  const raw = extractRawKey(key);
  return compiled.conundrumKeys.has(raw);
}
