import { InputKey, GestureSettings } from "./types.js";
import { OmegaGestureCallback, OmegaConfig, IGestureDetector } from "./omegaTypes.js";
/**
 * Special output event for direct key emission (bypasses gesture system)
 */
export interface SpecialKeyOutputEvent {
    type: "direct_output";
    keys: string[];
    timings?: {
        keyDownMs: [number, number];
        gapMs: [number, number];
    };
    source: "d_retaliate" | "d_release" | "s_group_member" | "c_escape" | "equals_smash";
}
export type SpecialKeyCallback = (event: SpecialKeyOutputEvent) => void;
export declare class OmegaGestureDetector implements IGestureDetector {
    private state;
    private config;
    private globalSettings;
    private keySpecificSettings;
    private gestureCallback;
    private specialKeyCallback;
    private listeners;
    private checkInterval;
    private pendingQuickTimers;
    private eventQueue;
    private processingQueue;
    private isStopped;
    constructor(settings: GestureSettings, gestureCallback: OmegaGestureCallback, config?: Partial<OmegaConfig>, specialKeyCallback?: SpecialKeyCallback);
    /**
     * Set callback for special key outputs (D retaliate, S group member, etc.)
     */
    setSpecialKeyCallback(callback: SpecialKeyCallback): void;
    private startCheckInterval;
    /**
     * Check all active key holds for threshold crossing
     */
    private checkAllThresholds;
    /**
     * Get effective threshold for a key, accounting for special cases
     */
    private getEffectiveThreshold;
    /**
     * Handle D key down - start accumulation phase
     */
    private handleDKeyDown;
    /**
     * Handle D key up - signal to special key handler to stop after 980ms
     */
    private handleDKeyUp;
    /**
     * Handle trigger key during D accumulation - immediately output R
     * Max 7 Rs per 2.85s cycle
     */
    private handleDTriggerKey;
    /**
     * Handle S key down
     */
    private handleSKeyDown;
    /**
     * Check S key for group member toggle activation
     */
    private checkSKeyToggleActivation;
    /**
     * Handle S key up
     */
    private handleSKeyUp;
    /**
     * Handle key during S group member toggle - intercept 1/2/3/4
     */
    private handleSInterceptKey;
    /**
     * Handle C key down
     */
    private handleCKeyDown;
    /**
     * Check C key for long-press threshold
     */
    private checkCKeyLongPress;
    /**
     * Handle C key up
     */
    private handleCKeyUp;
    /**
     * Handle = key down
     */
    private handleEqualsKeyDown;
    /**
     * Handle = key up
     */
    private handleEqualsKeyUp;
    /**
     * Handle F2 key down
     */
    private handleF2KeyDown;
    /**
     * Handle F2 key up
     */
    private handleF2KeyUp;
    /**
     * Check if a toggle key has been held long enough to activate toggle mode
     */
    private checkToggleActivation;
    /**
     * Activate toggle mode
     */
    private activateToggle;
    /**
     * Deactivate toggle mode
     */
    private deactivateToggle;
    /**
     * Handle toggle key up (W or Y)
     */
    private handleToggleKeyUp;
    /**
     * Fire a long gesture (called when threshold is crossed, BEFORE keyUp)
     */
    private fireLongGesture;
    /**
     * Fire a quick gesture (called on keyUp if threshold wasn't crossed)
     */
    private fireQuickGesture;
    /**
     * Emit a gesture event to all listeners
     */
    private emitGesture;
    handleKeyDown(key: string): void;
    handleKeyUp(key: string): void;
    handleMouseDown(button: string): void;
    handleMouseUp(button: string): void;
    private queueEvent;
    private processEvent;
    private processKeyDown;
    private processKeyUp;
    reset(): void;
    updateSettings(settings: GestureSettings): void;
    updateKeyProfile(key: InputKey, settings: GestureSettings): void;
    clearKeyProfile(key: InputKey): void;
    getKeyProfile(key: InputKey): GestureSettings | null;
    getAllProfiles(): Record<string, GestureSettings>;
    getCustomizedKeys(): InputKey[];
    loadKeyProfiles(profiles: Record<string, GestureSettings>): void;
    getGlobalSettings(): GestureSettings;
    destroy(): void;
    onGesture(cb: OmegaGestureCallback): void;
    offGesture(cb: OmegaGestureCallback): void;
    getToggleState(): {
        active: boolean;
        activator: "W" | "Y" | null;
    };
    getActiveKeys(): InputKey[];
    isKeyHeld(key: InputKey): boolean;
    getKeyHoldDuration(key: InputKey): number | null;
    /**
     * Get D key accumulator state
     */
    getDKeyState(): {
        active: boolean;
        count: number;
    };
    /**
     * Get S key group member toggle state
     */
    getSKeyToggleState(): boolean;
    setGroupMemberToggle(active: boolean): void;
    getGroupMemberToggle(): boolean;
}
export declare function createOmegaGestureDetector(settings: GestureSettings, gestureCallback: OmegaGestureCallback, config?: Partial<OmegaConfig>, specialKeyCallback?: SpecialKeyCallback): OmegaGestureDetector;
//# sourceMappingURL=omegaGestureDetector.d.ts.map