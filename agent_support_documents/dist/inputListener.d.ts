export interface KeyEvent {
    key: string;
    type: "down" | "up";
    timestamp: number;
}
export interface MouseEvent {
    button: "LEFT_CLICK" | "RIGHT_CLICK" | "MIDDLE_CLICK";
    type: "down" | "up";
    timestamp: number;
}
export type InputCallback = (event: KeyEvent | MouseEvent) => void;
export interface IInputListener {
    start(): void;
    stop(): void;
    isActive(): boolean;
}
export declare class StdinInputListener implements IInputListener {
    private callback;
    private isListening;
    constructor(callback: InputCallback);
    start(): void;
    stop(): void;
    isActive(): boolean;
}
export type HotkeyCallback = (hotkey: string) => void;
/**
 * Modifier state for traffic control
 */
export interface ModifierState {
    shift: boolean;
    alt: boolean;
    ctrl: boolean;
}
export declare class GlobalInputListener implements IInputListener {
    private callback;
    private isListening;
    private isStopped;
    private listener;
    private rawEventCallback;
    private hotkeyCallback;
    private currentModifierState;
    constructor(callback: InputCallback);
    /**
     * Set a callback to receive ALL raw key events (for debugging peripherals)
     */
    setRawEventCallback(cb: (rawName: string, state: string, rawEvent: any) => void): void;
    /**
     * Set a callback for special hotkey combinations (e.g., CTRL+SHIFT+G)
     */
    setHotkeyCallback(cb: HotkeyCallback): void;
    /**
     * Get current modifier state (for traffic control)
     */
    getModifierState(): ModifierState;
    start(): Promise<void>;
    stop(): void;
    isActive(): boolean;
}
export type ListenerMode = "auto" | "global" | "stdin";
export declare function createInputListener(callback: InputCallback, mode?: ListenerMode): Promise<IInputListener>;
export declare class InputListener implements IInputListener {
    private delegate;
    private callback;
    private initialized;
    private rawEventCallback;
    private hotkeyCallback;
    private forceStdin;
    constructor(callback: InputCallback);
    /**
     * Enable raw event debugging - shows ALL key events including unrecognized ones
     */
    setRawEventCallback(cb: (rawName: string, state: string, rawEvent: any) => void): void;
    /**
     * Set callback for special hotkeys (e.g., CTRL+SHIFT+G for config mode)
     */
    setHotkeyCallback(cb: HotkeyCallback): void;
    /**
     * Get current modifier state (for traffic control)
     * Returns shift/alt state from the underlying GlobalInputListener
     */
    getModifierState(): ModifierState;
    start(): Promise<void>;
    stop(): void;
    isActive(): boolean;
}
//# sourceMappingURL=inputListener.d.ts.map