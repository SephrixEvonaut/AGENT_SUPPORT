import { GestureSettings, GestureEvent } from "./types.js";
export type GestureCallback = (event: GestureEvent) => void;
export declare class GestureDetector {
    private machines;
    private _callback;
    private settings;
    private listeners;
    private eventQueue;
    private processingQueue;
    constructor(settings: GestureSettings, callback: GestureCallback);
    /** Replace the callback used by all per-key machines at runtime */
    setCallback(cb: GestureCallback): void;
    /** Subscribe to gesture events without replacing the central callback */
    onGesture(cb: GestureCallback): void;
    /** Unsubscribe a previously registered gesture listener */
    offGesture(cb: GestureCallback): void;
    get callback(): GestureCallback;
    set callback(cb: GestureCallback);
    /**
     * Queue a key event for processing
     * Uses immediate processing for low-latency with queue fallback for bursts
     */
    private queueEvent;
    private processEvent;
    handleKeyDown(key: string): void;
    handleKeyUp(key: string): void;
    handleMouseDown(button: "LEFT_CLICK" | "RIGHT_CLICK" | "MIDDLE_CLICK"): void;
    handleMouseUp(button: "LEFT_CLICK" | "RIGHT_CLICK" | "MIDDLE_CLICK"): void;
    reset(): void;
    updateSettings(settings: GestureSettings): void;
    /**
     * Get current queue depth (for monitoring)
     */
    getQueueDepth(): number;
}
