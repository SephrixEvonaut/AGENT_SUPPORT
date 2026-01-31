import { InputKey, GestureSettings, GestureEvent, KeyProfile } from "./calibrationTypes.js";
interface GestureHistoryEntry extends GestureEvent {
    detectedAt: string;
}
/**
 * Interface for the gesture detector (to avoid circular imports)
 */
export interface IGestureDetector {
    updateKeyProfile?(key: InputKey, settings: GestureSettings): void;
    getKeyProfile?(key: InputKey): GestureSettings | null;
    getAllProfiles?(): Record<string, GestureSettings>;
    onGesture?(callback: (event: GestureEvent) => void): void;
    offGesture?(callback: (event: GestureEvent) => void): void;
}
export declare class CalibrationServer {
    private server;
    private clients;
    private gestureDetector;
    private recentGestures;
    private maxHistoryPerKey;
    private port;
    private isRunning;
    private clientIdCounter;
    private keyProfiles;
    private globalDefaults;
    private gestureCallback;
    constructor(port?: number);
    /**
     * Start the WebSocket server
     */
    start(): Promise<void>;
    /**
     * Stop the WebSocket server
     */
    stop(): void;
    /**
     * Check if server is running
     */
    isServerRunning(): boolean;
    /**
     * Connect to a gesture detector instance
     */
    connectGestureDetector(detector: IGestureDetector): void;
    /**
     * Disconnect from gesture detector
     */
    disconnectGestureDetector(): void;
    /**
     * Set global default settings
     */
    setGlobalDefaults(settings: GestureSettings): void;
    private handleConnection;
    private handleCommand;
    private handleUpdateKeyProfile;
    private handleStartCalibration;
    private handleGetRecentGestures;
    private handleGetCurrentProfile;
    private handleSubscribeKey;
    private handleUnsubscribeKey;
    private handleExportProfile;
    private handleLoadProfile;
    /**
     * Record a gesture event (called by main app when gesture is detected)
     */
    recordGesture(event: GestureEvent): void;
    /**
     * Manually add a gesture to history (for testing)
     */
    addGestureToHistory(event: GestureEvent): void;
    private sendToClient;
    private broadcast;
    private broadcastToSubscribers;
    /**
     * Get client count
     */
    getClientCount(): number;
    /**
     * Get gesture history for a key
     */
    getGestureHistory(key: InputKey): GestureHistoryEntry[];
    /**
     * Clear gesture history
     */
    clearGestureHistory(key?: InputKey): void;
    /**
     * Get all key profiles
     */
    getKeyProfiles(): Map<InputKey, KeyProfile>;
    /**
     * Set a key profile directly
     */
    setKeyProfile(key: InputKey, profile: KeyProfile): void;
}
export declare function getCalibrationServer(port?: number): CalibrationServer;
export declare function stopCalibrationServer(): void;
export default CalibrationServer;
//# sourceMappingURL=calibrationServer.d.ts.map