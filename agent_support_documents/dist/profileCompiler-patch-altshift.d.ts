import { MacroProfile, CompiledProfile } from "./types.js";
/**
 * Compile a MacroProfile into a CompiledProfile for O(1) runtime checks
 * ALT+SHIFT combos are NOT a conundrum for modifier keys (SHIFT/ALT modified keys), but are elsewhere
 */
export declare function compileProfilePatched(profile: MacroProfile): CompiledProfile;
//# sourceMappingURL=profileCompiler-patch-altshift.d.ts.map