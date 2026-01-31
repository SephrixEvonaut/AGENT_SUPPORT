// ============================================================================
// CALIBRATION SERVER - WebSocket server for hot-reload calibration
// ============================================================================
//
// Provides real-time communication between the calibration CLI and the
// running macro system. Enables:
// - Live profile updates without restart
// - Gesture event broadcasting for test mode
// - Recent gesture history tracking
// - Profile export/import
//
// ============================================================================
import { WebSocket, WebSocketServer } from "ws";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { INPUT_KEYS, } from "./calibrationTypes.js";
// ============================================================================
// CALIBRATION SERVER CLASS
// ============================================================================
export class CalibrationServer {
    server = null;
    clients = new Map();
    gestureDetector = null;
    recentGestures = new Map();
    maxHistoryPerKey = 50;
    port;
    isRunning = false;
    clientIdCounter = 0;
    keyProfiles = new Map();
    globalDefaults = null;
    // Callback for external gesture handling
    gestureCallback = null;
    constructor(port = 8765) {
        this.port = port;
        // Initialize history maps for all keys
        for (const key of INPUT_KEYS) {
            this.recentGestures.set(key, []);
        }
    }
    // ==========================================================================
    // SERVER LIFECYCLE
    // ==========================================================================
    /**
     * Start the WebSocket server
     */
    start() {
        return new Promise((resolve, reject) => {
            if (this.isRunning) {
                resolve();
                return;
            }
            try {
                this.server = new WebSocketServer({ port: this.port });
                this.server.on("listening", () => {
                    this.isRunning = true;
                    console.log(`🔥 Calibration server listening on ws://localhost:${this.port}`);
                    resolve();
                });
                this.server.on("error", (error) => {
                    console.error(`❌ Calibration server error: ${error.message}`);
                    reject(error);
                });
                this.server.on("connection", (ws) => {
                    this.handleConnection(ws);
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Stop the WebSocket server
     */
    stop() {
        if (!this.isRunning)
            return;
        // Close all client connections
        for (const client of this.clients.values()) {
            client.ws.close(1000, "Server shutting down");
        }
        this.clients.clear();
        // Close server
        if (this.server) {
            this.server.close();
            this.server = null;
        }
        this.isRunning = false;
        console.log("🛑 Calibration server stopped");
    }
    /**
     * Check if server is running
     */
    isServerRunning() {
        return this.isRunning;
    }
    // ==========================================================================
    // GESTURE DETECTOR INTEGRATION
    // ==========================================================================
    /**
     * Connect to a gesture detector instance
     */
    connectGestureDetector(detector) {
        this.gestureDetector = detector;
        // Subscribe to gesture events if detector supports it
        if (detector.onGesture) {
            this.gestureCallback = (event) => this.recordGesture(event);
            detector.onGesture(this.gestureCallback);
        }
        console.log("📡 Connected to gesture detector");
    }
    /**
     * Disconnect from gesture detector
     */
    disconnectGestureDetector() {
        if (this.gestureDetector?.offGesture && this.gestureCallback) {
            this.gestureDetector.offGesture(this.gestureCallback);
        }
        this.gestureDetector = null;
        this.gestureCallback = null;
    }
    /**
     * Set global default settings
     */
    setGlobalDefaults(settings) {
        this.globalDefaults = settings;
    }
    // ==========================================================================
    // CONNECTION HANDLING
    // ==========================================================================
    handleConnection(ws) {
        const clientId = `client-${++this.clientIdCounter}`;
        const client = {
            ws,
            subscribedKeys: new Set(),
            id: clientId,
        };
        this.clients.set(clientId, client);
        console.log(`📱 Client connected: ${clientId}`);
        ws.on("message", (data) => {
            try {
                const message = typeof data === "string" ? data : data.toString();
                const command = JSON.parse(message);
                this.handleCommand(client, command);
            }
            catch (error) {
                this.sendToClient(client, {
                    type: "ERROR",
                    message: "Invalid JSON or command format",
                });
            }
        });
        ws.on("close", () => {
            console.log(`📱 Client disconnected: ${clientId}`);
            this.clients.delete(clientId);
        });
        ws.on("error", (error) => {
            console.error(`❌ Client error (${clientId}): ${error.message}`);
        });
    }
    // ==========================================================================
    // COMMAND HANDLING
    // ==========================================================================
    handleCommand(client, command) {
        switch (command.type) {
            case "UPDATE_KEY_PROFILE":
                this.handleUpdateKeyProfile(client, command.key, command.profile);
                break;
            case "START_CALIBRATION":
                this.handleStartCalibration(client, command.keys);
                break;
            case "GET_RECENT_GESTURES":
                this.handleGetRecentGestures(client, command.key, command.count);
                break;
            case "GET_CURRENT_PROFILE":
                this.handleGetCurrentProfile(client, command.key);
                break;
            case "SUBSCRIBE_KEY":
                this.handleSubscribeKey(client, command.key);
                break;
            case "UNSUBSCRIBE_KEY":
                this.handleUnsubscribeKey(client, command.key);
                break;
            case "EXPORT_PROFILE":
                this.handleExportProfile(client, command.filename);
                break;
            case "LOAD_PROFILE":
                this.handleLoadProfile(client, command.path);
                break;
            default:
                this.sendToClient(client, {
                    type: "ERROR",
                    message: `Unknown command type: ${command.type}`,
                });
        }
    }
    handleUpdateKeyProfile(client, key, profile) {
        try {
            // Get existing profile or create new one
            let existingProfile = this.keyProfiles.get(key) ||
                (this.globalDefaults
                    ? { ...this.globalDefaults }
                    : null);
            if (!existingProfile) {
                throw new Error("No global defaults set and no existing profile for key");
            }
            // Merge with new settings
            const updatedProfile = {
                ...existingProfile,
                ...profile,
            };
            // Store locally
            this.keyProfiles.set(key, updatedProfile);
            // Update gesture detector if connected
            if (this.gestureDetector?.updateKeyProfile) {
                this.gestureDetector.updateKeyProfile(key, updatedProfile);
            }
            console.log(`🔄 Updated ${key} profile:`, profile);
            // Broadcast to all clients
            this.broadcast({
                type: "PROFILE_UPDATED",
                key,
                profile: updatedProfile,
                timestamp: Date.now(),
            });
            this.sendToClient(client, {
                type: "SUCCESS",
                key,
                message: "Profile updated successfully",
            });
        }
        catch (error) {
            this.sendToClient(client, {
                type: "ERROR",
                message: error.message,
            });
        }
    }
    handleStartCalibration(client, keys) {
        const keysToCalibrate = keys || [...INPUT_KEYS];
        this.sendToClient(client, {
            type: "CALIBRATION_STARTED",
            keys: keysToCalibrate,
            timestamp: Date.now(),
        });
    }
    handleGetRecentGestures(client, key, count) {
        const history = this.recentGestures.get(key) || [];
        const requested = count || 20;
        const recent = history.slice(-requested);
        this.sendToClient(client, {
            type: "RECENT_GESTURES",
            key,
            gestures: recent,
        });
    }
    handleGetCurrentProfile(client, key) {
        if (key) {
            // Get specific key profile
            let profile = this.keyProfiles.get(key) || null;
            // Try gesture detector if no local profile
            if (!profile && this.gestureDetector?.getKeyProfile) {
                profile = this.gestureDetector.getKeyProfile(key);
            }
            // Fall back to global defaults
            if (!profile && this.globalDefaults) {
                profile = this.globalDefaults;
            }
            if (profile) {
                this.sendToClient(client, {
                    type: "KEY_PROFILE",
                    key,
                    profile,
                });
            }
            else {
                this.sendToClient(client, {
                    type: "ERROR",
                    message: `No profile found for key: ${key}`,
                });
            }
        }
        else {
            // Get all profiles
            const profiles = {};
            // Start with gesture detector profiles if available
            if (this.gestureDetector?.getAllProfiles) {
                Object.assign(profiles, this.gestureDetector.getAllProfiles());
            }
            // Override with local profiles
            for (const [k, p] of this.keyProfiles) {
                profiles[k] = p;
            }
            this.sendToClient(client, {
                type: "ALL_PROFILES",
                profiles,
            });
        }
    }
    handleSubscribeKey(client, key) {
        client.subscribedKeys.add(key);
        this.sendToClient(client, {
            type: "SUBSCRIBED",
            key,
        });
    }
    handleUnsubscribeKey(client, key) {
        client.subscribedKeys.delete(key);
        this.sendToClient(client, {
            type: "SUCCESS",
            message: `Unsubscribed from ${key}`,
        });
    }
    handleExportProfile(client, filename) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const fname = filename || `calibrated-profile-${timestamp}.json`;
            const outputPath = join(process.cwd(), "profiles", fname);
            // Build export object
            const keyProfilesObj = {};
            for (const [key, profile] of this.keyProfiles) {
                keyProfilesObj[key] = profile;
            }
            const exportData = {
                name: "Calibrated Profile",
                description: "Profile with per-key calibrated thresholds",
                calibrationVersion: "1.0.0",
                calibratedAt: new Date().toISOString(),
                calibrationToolVersion: "1.0.0",
                gestureSettings: this.globalDefaults || {
                    multiPressWindow: 355,
                    debounceDelay: 10,
                    longPressMin: 520,
                    longPressMax: 860,
                    superLongMin: 861,
                    superLongMax: 1300,
                    cancelThreshold: 1301,
                },
                keyProfiles: keyProfilesObj,
                macros: [],
            };
            writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
            this.sendToClient(client, {
                type: "EXPORT_COMPLETE",
                filename: fname,
                path: outputPath,
            });
        }
        catch (error) {
            this.sendToClient(client, {
                type: "ERROR",
                message: `Export failed: ${error.message}`,
            });
        }
    }
    handleLoadProfile(client, path) {
        try {
            if (!existsSync(path)) {
                throw new Error(`File not found: ${path}`);
            }
            const content = readFileSync(path, "utf-8");
            const profile = JSON.parse(content);
            // Load global defaults
            if (profile.gestureSettings) {
                this.globalDefaults = profile.gestureSettings;
            }
            // Load key profiles
            if (profile.keyProfiles) {
                for (const [key, keyProfile] of Object.entries(profile.keyProfiles)) {
                    this.keyProfiles.set(key, keyProfile);
                    // Update gesture detector
                    if (this.gestureDetector?.updateKeyProfile) {
                        this.gestureDetector.updateKeyProfile(key, keyProfile);
                    }
                }
            }
            this.sendToClient(client, {
                type: "SUCCESS",
                message: `Loaded profile from ${path}`,
            });
            // Broadcast update
            this.broadcast({
                type: "ALL_PROFILES",
                profiles: Object.fromEntries(this.keyProfiles),
            });
        }
        catch (error) {
            this.sendToClient(client, {
                type: "ERROR",
                message: `Load failed: ${error.message}`,
            });
        }
    }
    // ==========================================================================
    // GESTURE RECORDING
    // ==========================================================================
    /**
     * Record a gesture event (called by main app when gesture is detected)
     */
    recordGesture(event) {
        const key = event.inputKey;
        const history = this.recentGestures.get(key);
        if (history) {
            const entry = {
                ...event,
                detectedAt: new Date().toISOString(),
            };
            history.push(entry);
            // Trim to max size
            while (history.length > this.maxHistoryPerKey) {
                history.shift();
            }
        }
        // Broadcast to subscribed clients
        this.broadcastToSubscribers(key, {
            type: "GESTURE_DETECTED",
            key,
            gesture: event.gesture,
            timing: event.holdDuration,
            timestamp: event.timestamp,
        });
    }
    /**
     * Manually add a gesture to history (for testing)
     */
    addGestureToHistory(event) {
        this.recordGesture(event);
    }
    // ==========================================================================
    // MESSAGING
    // ==========================================================================
    sendToClient(client, message) {
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(message));
        }
    }
    broadcast(message) {
        const data = JSON.stringify(message);
        for (const client of this.clients.values()) {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(data);
            }
        }
    }
    broadcastToSubscribers(key, message) {
        const data = JSON.stringify(message);
        for (const client of this.clients.values()) {
            if (client.ws.readyState === WebSocket.OPEN &&
                (client.subscribedKeys.has(key) || client.subscribedKeys.size === 0)) {
                client.ws.send(data);
            }
        }
    }
    // ==========================================================================
    // UTILITY METHODS
    // ==========================================================================
    /**
     * Get client count
     */
    getClientCount() {
        return this.clients.size;
    }
    /**
     * Get gesture history for a key
     */
    getGestureHistory(key) {
        return [...(this.recentGestures.get(key) || [])];
    }
    /**
     * Clear gesture history
     */
    clearGestureHistory(key) {
        if (key) {
            const history = this.recentGestures.get(key);
            if (history)
                history.length = 0;
        }
        else {
            for (const history of this.recentGestures.values()) {
                history.length = 0;
            }
        }
    }
    /**
     * Get all key profiles
     */
    getKeyProfiles() {
        return new Map(this.keyProfiles);
    }
    /**
     * Set a key profile directly
     */
    setKeyProfile(key, profile) {
        this.keyProfiles.set(key, profile);
        if (this.gestureDetector?.updateKeyProfile) {
            this.gestureDetector.updateKeyProfile(key, profile);
        }
    }
}
// ============================================================================
// SINGLETON INSTANCE
// ============================================================================
let serverInstance = null;
export function getCalibrationServer(port) {
    if (!serverInstance) {
        serverInstance = new CalibrationServer(port);
    }
    return serverInstance;
}
export function stopCalibrationServer() {
    if (serverInstance) {
        serverInstance.stop();
        serverInstance = null;
    }
}
export default CalibrationServer;
//# sourceMappingURL=calibrationServer.js.map