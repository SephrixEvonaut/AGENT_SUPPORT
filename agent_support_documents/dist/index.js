// ============================================================================
// SWTOR MACRO AGENT - Main Entry Point
// ============================================================================
import { GestureDetector } from "./gestureDetector.js";
import { InputListener } from "./inputListener.js";
import { ProfileLoader, DEFAULT_GESTURE_SETTINGS } from "./profileLoader.js";
import { ExecutorFactory, } from "./executorFactory.js";
// Event callback for logging
function createEventCallback() {
    return (event) => {
        if (event.type === "started") {
            console.log(`⚡ Started: ${event.bindingName}`);
        }
        else if (event.type === "completed") {
            console.log(`✅ Completed: ${event.bindingName}`);
        }
        else if (event.type === "error") {
            console.error(`❌ Error: ${event.bindingName} - ${event.error}`);
        }
    };
}
class MacroAgent {
    profile = null;
    gestureDetector = null;
    executor = null;
    inputListener;
    profileLoader;
    currentBackend = "robotjs";
    debugMode = false;
    preferredProfile = null;
    constructor() {
        this.profileLoader = new ProfileLoader("./profiles");
        // Create input listener
        this.inputListener = new InputListener((event) => {
            this.handleInputEvent(event);
        });
    }
    /**
     * Enable debug mode to show ALL raw key events
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        if (enabled) {
            // Set up raw event callback to show ALL keyboard events (for debugging peripherals)
            this.inputListener.setRawEventCallback((rawName, state, rawEvent) => {
                console.log(`🔎 RAW: name="${rawName}" state=${state} scanCode=${rawEvent.scanCode || "N/A"} vKey=${rawEvent.vKey || "N/A"}`);
            });
            console.log("🔧 Debug mode enabled - showing ALL raw key events");
        }
    }
    /**
     * Set preferred profile to load
     */
    setPreferredProfile(profileName) {
        this.preferredProfile = profileName;
    }
    /**
     * Initialize the executor with specified backend
     */
    async initializeExecutor(backend) {
        if (backend) {
            // Use specified backend
            this.executor = await ExecutorFactory.create({
                backend,
                onEvent: createEventCallback(),
            });
            this.currentBackend = backend;
        }
        else {
            // Auto-select best available
            const result = await ExecutorFactory.createBest(createEventCallback());
            this.executor = result.executor;
            this.currentBackend = result.backend;
        }
    }
    /**
     * Handle raw input events
     */
    handleInputEvent(event) {
        // Debug mode: log ALL incoming events to diagnose peripheral issues
        if (this.debugMode) {
            if ("key" in event) {
                console.log(`🔍 DEBUG [${event.type}] key="${event.key}" ts=${event.timestamp}`);
            }
            else {
                console.log(`🔍 DEBUG [${event.type}] button="${event.button}" ts=${event.timestamp}`);
            }
        }
        if (!this.gestureDetector)
            return;
        if ("key" in event) {
            // Keyboard event
            if (event.type === "down") {
                this.gestureDetector.handleKeyDown(event.key);
            }
            else {
                this.gestureDetector.handleKeyUp(event.key);
            }
        }
        else {
            // Mouse event
            if (event.type === "down") {
                this.gestureDetector.handleMouseDown(event.button);
            }
            else {
                this.gestureDetector.handleMouseUp(event.button);
            }
        }
    }
    /**
     * Handle detected gestures
     * Uses fire-and-forget execution for concurrent macro support
     */
    handleGesture(event) {
        if (!this.profile || !this.executor)
            return;
        console.log(`\n🎯 Gesture: ${event.inputKey} → ${event.gesture}`);
        // Find matching macro binding
        const binding = this.profile.macros.find((m) => m.trigger.key === event.inputKey &&
            m.trigger.gesture === event.gesture &&
            m.enabled);
        if (binding) {
            console.log(`   Matched: "${binding.name}"`);
            // Use detached execution for concurrent sequences
            // Different bindings can run at the same time
            this.executor.executeDetached(binding);
        }
        else {
            console.log(`   No macro bound`);
        }
    }
    /**
     * Load a profile
     */
    loadProfile(filename) {
        const profile = this.profileLoader.loadProfile(filename);
        if (!profile) {
            return false;
        }
        this.profile = profile;
        // Create gesture detector with profile settings
        this.gestureDetector = new GestureDetector(profile.gestureSettings || DEFAULT_GESTURE_SETTINGS, (event) => this.handleGesture(event));
        // If executor supports compiled profile injection, provide compiled profile
        const compiled = this.profileLoader.getCompiledProfile();
        if (compiled && this.executor && "setCompiledProfile" in this.executor) {
            try {
                this.executor.setCompiledProfile(compiled);
                console.log(`🔧 Compiled profile applied to executor (${compiled.conundrumKeys.size} conundrum keys)`);
            }
            catch (err) {
                console.warn("⚠️  Failed to apply compiled profile to executor:", err);
            }
        }
        return true;
    }
    /**
     * Start the macro agent
     */
    async start(backend) {
        console.log("\n╔════════════════════════════════════════════════════╗");
        console.log("║       SWTOR MACRO AGENT - Per-Key Gestures         ║");
        console.log("╚════════════════════════════════════════════════════╝\n");
        // Initialize executor
        await this.initializeExecutor(backend);
        console.log(`\n🔧 Executor backend: ${this.currentBackend.toUpperCase()}`);
        // List available profiles
        const profiles = this.profileLoader.listProfiles();
        if (profiles.length === 0) {
            console.log("⚠️  No profiles found in ./profiles/");
            console.log("   Creating example profile...\n");
            // Profile will be created from the example.json we already have
            if (!this.loadProfile("example.json")) {
                console.error("❌ Failed to load profile");
                return;
            }
        }
        else {
            console.log(`📂 Available profiles: ${profiles.join(", ")}`);
            // Determine which profile to load
            let profileToLoad;
            if (this.preferredProfile) {
                // Use explicitly specified profile
                if (profiles.includes(this.preferredProfile)) {
                    profileToLoad = this.preferredProfile;
                }
                else {
                    console.error(`❌ Specified profile not found: ${this.preferredProfile}`);
                    console.log(`   Available: ${profiles.join(", ")}`);
                    return;
                }
            }
            else {
                // Prefer swtor profile if available, otherwise first
                const swtorProfile = profiles.find((p) => p.toLowerCase().includes("swtor"));
                profileToLoad = swtorProfile || profiles[0];
            }
            console.log(`📌 Loading: ${profileToLoad}`);
            if (!this.loadProfile(profileToLoad)) {
                console.error("❌ Failed to load profile");
                return;
            }
        }
        // Show loaded macros
        if (this.profile) {
            console.log(`\n📋 Loaded macros:`);
            for (const macro of this.profile.macros) {
                if (macro.enabled) {
                    console.log(`   • ${macro.trigger.key} (${macro.trigger.gesture}) → "${macro.name}"`);
                }
            }
        }
        // Show constraints and capabilities
        console.log("\n📏 Sequence Constraints:");
        console.log("   • Min delay: 25ms");
        console.log("   • Variance: ≥4ms (max - min)");
        console.log("   • Max unique keys: 4 per sequence");
        console.log("   • Max repeats: 6 per key");
        console.log("   • Max press count: 4 (excess = quadruple, no long)");
        console.log("\n🔀 Concurrency:");
        console.log("   • Simultaneous keys: YES (all fingers work at once)");
        console.log("   • Concurrent sequences: YES (different macros overlap)");
        // Start listening
        console.log("\n─────────────────────────────────────────────────────");
        this.inputListener.start();
    }
    /**
     * Stop the macro agent
     */
    stop() {
        this.inputListener.stop();
        if (this.executor && "cancelAll" in this.executor) {
            this.executor.cancelAll?.();
        }
        if (this.executor && "destroy" in this.executor) {
            this.executor.destroy?.();
        }
        console.log("🛑 Macro Agent stopped");
    }
    /**
     * Get current backend
     */
    getBackend() {
        return this.currentBackend;
    }
    /**
     * Show available backends
     */
    static async showBackends() {
        console.log("\n📊 Available executor backends:\n");
        const backends = await ExecutorFactory.getAvailableBackends();
        for (const { backend, available, notes } of backends) {
            const status = available ? "✅" : "❌";
            console.log(`  ${status} ${backend.toUpperCase()}`);
            console.log(`     ${notes}\n`);
        }
    }
}
// ============================================================================
// MAIN
// ============================================================================
async function main() {
    // Parse command line arguments
    const args = process.argv.slice(2);
    // Show help
    if (args.includes("--help") || args.includes("-h")) {
        console.log(`
SWTOR Macro Agent - Per-Key Gesture Detection

USAGE:
  npm start                    Auto-select best executor
  npm start -- --backend=X     Use specific backend
  npm start -- --backends      Show available backends
  npm start -- --help          Show this help

BACKENDS:
  robotjs       RobotJS (SendInput API) - Medium detection risk
  interception  Interception Driver - Hard to detect (kernel-level)
  mock          Mock executor (no keypresses) - For testing

EXAMPLES:
  npm start -- --backend=robotjs
  npm start -- --profile=swtor-vengeance-jugg.json
  npm start -- --backend=interception --profile=example.json
  npm start -- --backends
  npm start -- --debug

OPTIONS:
  --profile=<name>            Load specific profile from profiles/ folder
  --debug                     Show ALL raw key events (for debugging peripherals)

ENVIRONMENT:
  MACRO_BACKEND=interception   Set default backend via env var
`);
        process.exit(0);
    }
    // Show available backends
    if (args.includes("--backends")) {
        await MacroAgent.showBackends();
        process.exit(0);
    }
    // Parse backend option
    let backend;
    const backendArg = args.find((a) => a.startsWith("--backend="));
    if (backendArg) {
        backend = backendArg.split("=")[1];
    }
    else if (process.env.MACRO_BACKEND) {
        backend = process.env.MACRO_BACKEND;
    }
    // Parse profile option
    let profileName;
    const profileArg = args.find((a) => a.startsWith("--profile="));
    if (profileArg) {
        profileName = profileArg.split("=")[1];
    }
    // Parse debug option
    const debugMode = args.includes("--debug");
    const agent = new MacroAgent();
    agent.setDebugMode(debugMode);
    if (profileName) {
        agent.setPreferredProfile(profileName);
    }
    // Handle graceful shutdown
    process.on("SIGINT", () => {
        agent.stop();
        process.exit(0);
    });
    process.on("SIGTERM", () => {
        agent.stop();
        process.exit(0);
    });
    // Start the agent
    await agent.start(backend);
}
main().catch(console.error);
