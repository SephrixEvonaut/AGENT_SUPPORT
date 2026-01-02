import { MacroProfile, CompiledProfile } from "./types.js";
import { extractRawKey } from "./utils.js";

/**
 * Compile a MacroProfile into a CompiledProfile for O(1) runtime checks
 */
export function compileProfile(profile: MacroProfile): CompiledProfile {
  const rawSet = new Set<string>();
  const shiftSet = new Set<string>();
  const altSet = new Set<string>();

  for (const macro of profile.macros) {
    for (const step of macro.sequence) {
      const key = step.key;
      const parts = key.split("+").map((p) => p.trim());
      const last = extractRawKey(key);

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

  const conundrumKeys = new Set<string>();
  const safeKeys = new Set<string>();

  // Any key that appears in more than one form (raw, shift, alt) is a conundrum
  const allKeys = new Set([...rawSet, ...shiftSet, ...altSet]);
  for (const k of allKeys) {
    const forms = [rawSet.has(k), shiftSet.has(k), altSet.has(k)].filter(
      Boolean
    ).length;
    if (forms > 1) conundrumKeys.add(k);
    else if (forms === 1 && rawSet.has(k)) safeKeys.add(k);
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
