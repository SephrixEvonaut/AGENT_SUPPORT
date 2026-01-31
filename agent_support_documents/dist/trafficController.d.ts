import { CompiledProfile } from "./types.js";
export declare class TrafficController {
    private crossingKey;
    private queue;
    private compiledProfile;
    private supremacyMacros;
    constructor(compiledProfile: CompiledProfile);
    /**
     * Grant supremacy to a macro - it will bypass traffic control entirely
     */
    grantSupremacy(macroName: string): void;
    /**
     * Revoke supremacy from a macro
     */
    revokeSupremacy(macroName: string): void;
    /**
     * Check if a macro has supremacy
     */
    hasSupremacy(macroName: string): boolean;
    /**
     * Get all macros with supremacy
     */
    getSupremacyList(): string[];
    requestCrossing(key: string, macroName?: string): Promise<void>;
    releaseCrossing(key: string): void;
    private shouldWait;
}
export default TrafficController;
//# sourceMappingURL=trafficController.d.ts.map