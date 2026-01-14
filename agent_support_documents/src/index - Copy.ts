// ============================================================================
// SWTOR MACRO AGENT - Main Entry Point
// ============================================================================

import { GestureDetector } from "./gestureDetector.js";
import { SequenceExecutor, ExecutionEvent } from "./sequenceExecutor.js";
import { InputListener, KeyEvent, MouseEvent } from "./inputListener.js";
import { ProfileLoader, DEFAULT_GESTURE_SETTINGS } from "./profileLoader.js";
import { MacroProfile, GestureEvent, MacroBinding } from "./types.js";
import {
  ExecutorFactory,
  IExecutor,
  ExecutorBackend,
} from "./executorFactory.js";

// Event callback for logging
function createEventCallback(): (event: ExecutionEvent) => void {
  return (event) => {
    if (event.type === "started") {
      console.log(`⚡ Started: ${event.bindingName}`);
    } else if (event.type === "completed") {
      console.log(`✅ Completed: ${event.bindingName}`);
    } else if (event.type === "error") {
      console.error(`❌ Error: ${event.bindingName} - ${event.error}`);
    }
  };
}

class MacroAgent {
  private profile: MacroProfile | null = null;
  private gestureDetector: GestureDetector | null = null;
  private executor: IExecutor | null = null;
  private inputListener: InputListener;
  private profileLoader: ProfileLoader;
  private currentBackend: ExecutorBackend = "robotjs";
  private debugMode: boolean = false;
  private preferredProfile: string | null = null;
  private isStopped: boolean = false;

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
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    if (enabled) {
      // Set up raw event callback to show ALL keyboard events (for debugging peripherals)
      this.inputListener.setRawEventCallback((rawName, state, rawEvent) => {
        console.log(
          `🔎 RAW: name="${rawName}" state=${state} scanCode=${
            rawEvent.scanCode || "N/A"
          } vKey=${rawEvent.vKey || "N/A"}`
        );
      });
      console.log("🔧 Debug mode enabled - showing ALL raw key events");
    }
  }

  /**
   * Set preferred profile to load
   */
  setPreferredProfile(profileName: string): void {
    this.preferredProfile = profileName;
  }

  /**
   * Initialize the executor with specified backend
   */
  async initializeExecutor(backend?: ExecutorBackend): Promise<void> {
    if (backend) {
      // Use specified backend
      this.executor = await ExecutorFactory.create({
        backend,
        onEvent: createEventCallback(),
      });
      this.currentBackend = backend;
    } else {
      // Auto-select best available
      const result = await ExecutorFactory.createBest(createEventCallback());
      this.executor = result.executor;
      this.currentBackend = result.backend;
    }
  }

  /**
   * Handle raw input events
   */
  private handleInputEvent(event: KeyEvent | MouseEvent): void {
    // CRITICAL: Block input handling after shutdown
    if (this.isStopped) return;

    // Debug mode: log ALL incoming events to diagnose peripheral issues
    if (this.debugMode) {
      if ("key" in event) {
        console.log(
          `🔍 DEBUG [${event.type}] key="${event.key}" ts=${event.timestamp}`
        );
      } else {
        console.log(
          `🔍 DEBUG [${event.type}] button="${event.button}" ts=${event.timestamp}`
        );
      }
    }

    if (!this.gestureDetector) return;

    if ("key" in event) {
      // Keyboard event
      if (event.type === "down") {
        this.gestureDetector.handleKeyDown(event.key);
      } else {
        this.gestureDetector.handleKeyUp(event.key);
      }
    } else {
      // Mouse event
      if (event.type === "down") {
        this.gestureDetector.handleMouseDown(event.button);
      } else {
        this.gestureDetector.handleMouseUp(event.button);
      }
    }
  }

  /**
   * Handle detected gestures
   * Uses fire-and-forget execution for concurrent macro support
   */
  private handleGesture(event: GestureEvent): void {
    // CRITICAL: Block gesture handling after shutdown
    if (this.isStopped) return;
    if (!this.profile || !this.executor) return;

    console.log(`\n🎯 Gesture: ${event.inputKey} → ${event.gesture}`);

    // Find matching macro binding
    const binding = this.profile.macros.find(
      (m) =>
        m.trigger.key === event.inputKey &&
        m.trigger.gesture === event.gesture &&
        m.enabled
    );

    if (binding) {
      console.log(`   Matched: "${binding.name}"`);
      // Use detached execution for concurrent sequences
      // Different bindings can run at the same time
      this.executor.executeDetached(binding);
    } else {
      console.log(`   No macro bound`);
    }
  }

  /**
   * Load a profile
   */
  loadProfile(filename: string): boolean {
    const profile = this.profileLoader.loadProfile(filename);

    if (!profile) {
      return false;
    }

    this.profile = profile;

    // Create gesture detector with profile settings
    this.gestureDetector = new GestureDetector(
      profile.gestureSettings || DEFAULT_GESTURE_SETTINGS,
      (event) => this.handleGesture(event)
    );

    // If executor supports compiled profile injection, provide compiled profile
    const compiled = this.profileLoader.getCompiledProfile();
    if (compiled && this.executor && "setCompiledProfile" in this.executor) {
      try {
        (this.executor as any).setCompiledProfile(compiled);
        console.log(
          `🔧 Compiled profile applied to executor (${compiled.conundrumKeys.size} conundrum keys)`
        );
      } catch (err) {
        console.warn("⚠️  Failed to apply compiled profile to executor:", err);
      }
    }

    return true;
  }

  /**
   * Start the macro agent
   */
  async start(backend?: ExecutorBackend): Promise<void> {
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
    } else {
      console.log(`📂 Available profiles: ${profiles.join(", ")}`);

      // Determine which profile to load
      let profileToLoad: string;
      if (this.preferredProfile) {
        // Use explicitly specified profile
        if (profiles.includes(this.preferredProfile)) {
          profileToLoad = this.preferredProfile;
        } else {
          console.error(
            `❌ Specified profile not found: ${this.preferredProfile}`
          );
          console.log(`   Available: ${profiles.join(", ")}`);
          return;
        }
      } else {
        // Prefer swtor profile if available, otherwise first
        const swtorProfile = profiles.find((p) =>
          p.toLowerCase().includes("swtor")
        );
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
          console.log(
            `   • ${macro.trigger.key} (${macro.trigger.gesture}) → "${macro.name}"`
          );
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
  stop(): void {
    // Set stop flag FIRST to block any in-flight callbacks immediately
    this.isStopped = true;
    // Stop input listener to prevent new events
    this.inputListener.stop();
    // Destroy gesture detector to clear pending timers and block queued events
    if (this.gestureDetector && "destroy" in this.gestureDetector) {
      (this.gestureDetector as any).destroy?.();
    }
    // Stop executor and release held keys
    if (this.executor && "cancelAll" in this.executor) {
      (this.executor as any).cancelAll?.();
    }
    if (this.executor && "destroy" in this.executor) {
      (this.executor as any).destroy?.();
    }
    console.log("🛑 Macro Agent stopped");
  }

  /**
   * Get current backend
   */
  getBackend(): ExecutorBackend {
    return this.currentBackend;
  }

  /**
   * Show available backends
   */
  static async showBackends(): Promise<void> {
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
  let backend: ExecutorBackend | undefined;
  const backendArg = args.find((a) => a.startsWith("--backend="));
  if (backendArg) {
    backend = backendArg.split("=")[1] as ExecutorBackend;
  } else if (process.env.MACRO_BACKEND) {
    backend = process.env.MACRO_BACKEND as ExecutorBackend;
  }

  // Parse profile option
  let profileName: string | undefined;
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
  let isShuttingDown = false;
  const shutdown = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    agent.stop();
    // Force immediate termination - no lingering promises
    setTimeout(() => process.exit(0), 50);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("exit", shutdown);

  // Start the agent
  await agent.start(backend);
}

main().catch(console.error);
