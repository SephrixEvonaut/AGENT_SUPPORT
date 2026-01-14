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
export declare class GlobalInputListener implements IInputListener {
    private callback;
    private isListening;
    private listener;
    private rawEventCallback;
    constructor(callback: InputCallback);
    /**
     * Set a callback to receive ALL raw key events (for debugging peripherals)
     */
    setRawEventCallback(cb: (rawName: string, state: string, rawEvent: any) => void): void;
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
    constructor(callback: InputCallback);
    /**
     * Enable raw event debugging - shows ALL key events including unrecognized ones
     */
    setRawEventCallback(cb: (rawName: string, state: string, rawEvent: any) => void): void;
    start(): Promise<void>;
    stop(): void;
    isActive(): boolean;
}
