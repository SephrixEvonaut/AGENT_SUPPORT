import { GestureSettings, GestureEvent } from './types.js';
export type GestureCallback = (event: GestureEvent) => void;
export declare class GestureDetector {
    private machines;
    private callback;
    private settings;
    private eventQueue;
    private processingQueue;
    constructor(settings: GestureSettings, callback: GestureCallback);
    /**
     * Queue a key event for processing
     * Uses immediate processing for low-latency with queue fallback for bursts
     */
    private queueEvent;
    private processEvent;
    handleKeyDown(key: string): void;
    handleKeyUp(key: string): void;
    handleMouseDown(button: 'LEFT_CLICK' | 'RIGHT_CLICK' | 'MIDDLE_CLICK'): void;
    handleMouseUp(button: 'LEFT_CLICK' | 'RIGHT_CLICK' | 'MIDDLE_CLICK'): void;
    reset(): void;
    updateSettings(settings: GestureSettings): void;
    /**
     * Get current queue depth (for monitoring)
     */
    getQueueDepth(): number;
}
