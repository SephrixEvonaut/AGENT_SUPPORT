import { MacroBinding, InputKey, GCDAbilityType } from "./types.js";
import { OmegaGestureType } from "./omegaTypes.js";
export type BufferTier = "low" | "medium" | "high";
export interface OmegaSequenceStep {
    /** Output key (e.g., "N", "SHIFT+J", "7") */
    key?: string;
    /** Buffer tier for delay before next step */
    bufferTier?: BufferTier;
    /** Custom delay range (overrides bufferTier) */
    minDelay?: number;
    maxDelay?: number;
    /** Echo hits for ability confirmation */
    echoHits?: {
        count: 1 | 2 | 3 | 4;
        windowMs: number;
    };
    /** Hold through next step (for modifiers like focus target key "7") */
    holdThroughNext?: boolean;
    releaseDelayMin?: number;
    releaseDelayMax?: number;
    /** Timer action */
    timer?: {
        id: string;
        durationSeconds: number;
        message: string;
    };
    /** Scroll action */
    scrollDirection?: "up" | "down";
    scrollMagnitude?: number;
    /** Step name for logging */
    name?: string;
}
export interface OmegaBinding {
    name: string;
    inputKey: InputKey;
    gesture: OmegaGestureType;
    sequence: OmegaSequenceStep[];
    enabled: boolean;
    gcdAbility?: GCDAbilityType;
}
export type OmegaBindingLookup = Map<InputKey, Map<OmegaGestureType, OmegaBinding>>;
export declare function step(key: string, bufferTier?: BufferTier, opts?: Partial<OmegaSequenceStep>): OmegaSequenceStep;
export declare function targetWithCog(targetKey: string): OmegaSequenceStep[];
export declare function timerStep(id: string, durationSeconds: number, message: string): OmegaSequenceStep;
export declare function holdModifier(key: string, releaseDelayMin?: number, releaseDelayMax?: number): OmegaSequenceStep;
export declare function scrollStep(direction: "up" | "down", magnitude: number): OmegaSequenceStep;
export declare const OMEGA_BINDINGS: OmegaBinding[];
/**
 * Build a lookup map for fast gesture→binding resolution
 */
export declare function buildOmegaBindingLookup(bindings?: OmegaBinding[]): OmegaBindingLookup;
/**
 * Get a binding for a specific key and gesture
 */
export declare function getOmegaBinding(lookup: OmegaBindingLookup, inputKey: InputKey, gesture: OmegaGestureType): OmegaBinding | null;
/**
 * Convert OmegaBinding to MacroBinding for executor compatibility
 */
export declare function omegaBindingToMacro(binding: OmegaBinding): MacroBinding;
/**
 * Export all bindings as a JSON profile
 */
export declare function exportOmegaProfile(): object;
export declare function getOmegaStats(): {
    totalBindings: number;
    byKey: Record<string, number>;
    byGesture: Record<string, number>;
    gcdAbilities: string[];
};
/**
 * 4+7 Combo: Close Enemy + Interrupt
 * Triggered when key 4 is pressed during key 7 hold or within 420ms of release
 */
export declare const COMBO_7_4_BINDING: OmegaBinding;
export default OMEGA_BINDINGS;
//# sourceMappingURL=omegaMappings.d.ts.map