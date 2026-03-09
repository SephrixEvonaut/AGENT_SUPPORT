import { OmegaBinding } from "./omegaMappings.js";
/** Profile selection key */
export type ProfileKey = "T" | "R" | "S" | "M" | "E" | "C" | "A";
/** D key behavior mode */
export type DKeyMode = "continuous_stream" | "burst_stream_slow" | "burst_stream_fast" | "single_press";
/** Profile configuration */
export interface ProfileConfig {
    key: ProfileKey;
    name: string;
    shortName: string;
    dKeyMode: DKeyMode;
    sQuickAbility: string;
    /** For single_press D mode: the output key sent on D quick */
    dKeyOutput?: string;
    /** For profiles where S quick sends a direct key (not Guard dual-key) */
    sKeyQuickOutput?: string;
    bindings: OmegaBinding[];
}
export declare const SHARED_BINDINGS: OmegaBinding[];
export declare const TANK_BINDINGS: OmegaBinding[];
export declare const RAGE_BINDINGS: OmegaBinding[];
export declare const SORC_HEAL_BINDINGS: OmegaBinding[];
export declare const SORC_MAD_BINDINGS: OmegaBinding[];
export declare const ENGI_BINDINGS: OmegaBinding[];
export declare const COMBAT_MED_BINDINGS: OmegaBinding[];
export declare const ARSENAL_BINDINGS: OmegaBinding[];
export declare const PROFILE_REGISTRY: Record<ProfileKey, ProfileConfig>;
/** Get profile config by key */
export declare function getProfileConfig(key: ProfileKey): ProfileConfig;
/** Get valid profile keys */
export declare function getValidProfileKeys(): ProfileKey[];
/** Get bindings for a profile (already includes SHARED_BINDINGS via spread) */
export declare function getProfileBindings(key: ProfileKey): OmegaBinding[];
//# sourceMappingURL=omegaProfiles.d.ts.map