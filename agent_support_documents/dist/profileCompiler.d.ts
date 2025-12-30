import { MacroProfile, CompiledProfile } from "./types.js";
/**
 * Compile a MacroProfile into a CompiledProfile for O(1) runtime checks
 */
export declare function compileProfile(profile: MacroProfile): CompiledProfile;
export declare function isConundrumKey(key: string, compiled: CompiledProfile): boolean;
