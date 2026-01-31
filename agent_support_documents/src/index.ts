// ============================================================================
// SWTOR MACRO AGENT - Main Entry Point (with Alpha/Omega System Selection)
// ============================================================================
//
// Features:
// - GCD (Global Cooldown) system emulation (1.275s for Omega)
// - Per-ability cooldown tracking
// - Gesture fallback (long ↔ super_long for Alpha)
// - Concurrent sequence execution
// - Per-key calibrated gesture thresholds
// - Hot-reload calibration server
// - NEW: Alpha (12-gesture) vs Omega (4-gesture) system selection
//
// ============================================================================

import { GestureDetector, GestureCallback } from "./gestureDetector.js";
import {
  OmegaGestureDetector,
  createOmegaGestureDetector,
} from "./omegaGestureDetector.js";
import { SequenceExecutor, ExecutionEvent } from "./sequenceExecutor.js";
import { InputListener, KeyEvent, MouseEvent } from "./inputListener.js";
import { ProfileLoader, DEFAULT_GESTURE_SETTINGS } from "./profileLoader.js";
import {
  MacroProfile,
  GestureEvent,
  MacroBinding,
  GestureType,
  InputKey,
} from "./types.js";
import {
  OmegaGestureEvent,
  OmegaGestureType,
  OmegaMacroBinding,
  GestureSystem,
  IGestureDetector,
  omegaToAlphaGesture,
  OMEGA_GESTURE_TYPES,
} from "./omegaTypes.js";
import {
  ExecutorFactory,
  IExecutor,
  ExecutorBackend,
} from "./executorFactory.js";
import {
  GCDManager,
  getGestureFallback,
  isEmptyBinding,
} from "./gcdManager.js";
import {
  createSpecialKeyHandler,
  SpecialKeyHandler,
} from "./specialKeyHandler.js";

// NEW: Calibration server imports
import {
  getCalibrationServer,
  stopCalibrationServer,
} from "./calibrationServer.js";
import { KeyProfile } from "./calibrationTypes.js";

// For interactive prompts
import * as readline from "readline";

// ============================================================================
// SYSTEM SELECTION UTILITIES
// ============================================================================

/**
 * Prompt user to select gesture system (Alpha or Omega)
 */
async function selectGestureSystem(): Promise<GestureSystem> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║           SELECT GESTURE DETECTION SYSTEM              ║");
    console.log("╠════════════════════════════════════════════════════════╣");
    console.log("║                                                        ║");
    console.log("║  [1] ALPHA - 12 gestures (original system)             ║");
    console.log("║      • single, double, triple, quadruple               ║");
    console.log("║      • + long and super_long variants                  ║");
    console.log("║      • Multi-tap detection with elongating window      ║");
    console.log("║                                                        ║");
    console.log("║  [2] OMEGA - 4 gestures (streamlined system)           ║");
    console.log("║      • quick, long, quick_toggle, long_toggle          ║");
    console.log("║      • Long fires IMMEDIATELY on threshold cross       ║");
    console.log("║      • W/Y toggle keys for modifier state              ║");
    console.log("║      • Per-key calibrated thresholds                   ║");
    console.log("║                                                        ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    const askQuestion = () => {
      rl.question("Select system [1/2] (default: 1): ", (answer) => {
        const trimmed = answer.trim().toLowerCase();

        if (trimmed === "" || trimmed === "1" || trimmed === "alpha") {
          rl.close();
          resolve("alpha");
        } else if (trimmed === "2" || trimmed === "omega") {
          rl.close();
          resolve("omega");
        } else {
          console.log("Invalid selection. Please enter 1 or 2.");
          askQuestion();
        }
      });
    };

    askQuestion();
  });
}

/**
 * Prompt user to enable/disable per-ability cooldown tracking
 */
async function selectCooldownMode(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║         PER-ABILITY COOLDOWN TRACKING                  ║");
    console.log("╠════════════════════════════════════════════════════════╣");
    console.log("║                                                        ║");
    console.log("║  [Y] YES - Track individual ability cooldowns          ║");
    console.log("║      • Crushing Blow: 7s, Force Scream: 11s, etc.      ║");
    console.log("║      • Abilities blocked until cooldown expires        ║");
    console.log("║      • P key resets short cooldowns (<20s)             ║");
    console.log("║                                                        ║");
    console.log("║  [N] NO - GCD only mode (1.275s between abilities)     ║");
    console.log("║      • No per-ability cooldown tracking                ║");
    console.log("║      • Abilities fire as fast as GCD allows            ║");
    console.log("║      • You manage cooldowns yourself                   ║");
    console.log("║                                                        ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    const askQuestion = () => {
      rl.question(
        "Enable per-ability cooldowns? [y/n] (default: n): ",
        (answer) => {
          const trimmed = answer.trim().toLowerCase();

          if (trimmed === "" || trimmed === "n" || trimmed === "no") {
            rl.close();
            resolve(false);
          } else if (trimmed === "y" || trimmed === "yes") {
            rl.close();
            resolve(true);
          } else {
            console.log("Invalid selection. Please enter y or n.");
            askQuestion();
          }
        },
      );
    };

    askQuestion();
  });
}

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

// ============================================================================
// MACRO AGENT CLASS
// ============================================================================

class MacroAgent {
  private profile: MacroProfile | null = null;

  // Gesture detectors - only one is active at a time
  private alphaDetector: GestureDetector | null = null;
  private omegaDetector: OmegaGestureDetector | null = null;
  private specialKeyHandler: SpecialKeyHandler | null = null;
  private activeSystem: GestureSystem = "alpha";

  private executor: IExecutor | null = null;
  private inputListener: InputListener;
  private profileLoader: ProfileLoader;
  private currentBackend: ExecutorBackend = "robotjs";
  private debugMode: boolean = false;
  private preferredProfile: string | null = null;
  private isStopped: boolean = false;

  // GCD Manager for ability cooldown tracking
  private gcdManager: GCDManager;

  // Per-ability cooldown mode (set at startup)
  private perAbilityCooldownsEnabled: boolean = false;

  // Lookup tables for fast binding access
  private alphaBindingLookup: Map<string, Map<string, MacroBinding>> =
    new Map();
  private omegaBindingLookup: Map<string, Map<string, OmegaMacroBinding>> =
    new Map();

  // Calibration server state
  private calibrationServerEnabled: boolean = false;

  constructor() {
    this.profileLoader = new ProfileLoader("./profiles");

    // Create input listener
    this.inputListener = new InputListener((event) => {
      this.handleInputEvent(event);
    });

    // Initialize GCD manager
    this.gcdManager = new GCDManager();
  }

  /**
   * Get the currently active gesture system
   */
  getActiveSystem(): GestureSystem {
    return this.activeSystem;
  }

  /**
   * Enable debug mode to show ALL raw key events
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    if (enabled) {
      this.inputListener.setRawEventCallback((rawName, state, rawEvent) => {
        console.log(
          `🔎 RAW: name="${rawName}" state=${state} scanCode=${
            rawEvent.scanCode || "N/A"
          } vKey=${rawEvent.vKey || "N/A"}`,
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
      this.executor = await ExecutorFactory.create({
        backend,
        onEvent: createEventCallback(),
      });
      this.currentBackend = backend;
    } else {
      const result = await ExecutorFactory.createBest(createEventCallback());
      this.executor = result.executor;
      this.currentBackend = result.backend;
    }

    // Set up GCD manager to use the executor
    this.gcdManager.setExecuteCallback((binding) => {
      if (this.executor) {
        this.executor.executeDetached(binding);
      }
    });
  }

  /**
   * Build lookup tables for fast binding access
   */
  private buildBindingLookups(): void {
    this.alphaBindingLookup.clear();
    this.omegaBindingLookup.clear();

    if (!this.profile) return;

    for (const macro of this.profile.macros) {
      if (!macro.enabled) continue;
      if (!macro.trigger) continue;

      const key = macro.trigger.key;
      const gesture = macro.trigger.gesture;

      // Add to Alpha lookup
      if (!this.alphaBindingLookup.has(key)) {
        this.alphaBindingLookup.set(key, new Map());
      }
      this.alphaBindingLookup.get(key)!.set(gesture, macro);

      // Check if gesture is already an Omega type
      const isOmegaGesture = OMEGA_GESTURE_TYPES.includes(
        gesture as OmegaGestureType,
      );

      if (isOmegaGesture) {
        // Gesture is already Omega - add directly to Omega lookup
        if (!this.omegaBindingLookup.has(key)) {
          this.omegaBindingLookup.set(key, new Map());
        }
        this.omegaBindingLookup.get(key)!.set(gesture as OmegaGestureType, {
          ...macro,
          trigger: { key, gesture: gesture as OmegaGestureType },
        });
      } else {
        // Alpha gesture - try to map to Omega equivalent
        const omegaGesture = this.alphaToOmegaGesture(gesture as GestureType);
        if (omegaGesture) {
          if (!this.omegaBindingLookup.has(key)) {
            this.omegaBindingLookup.set(key, new Map());
          }
          // Don't overwrite if already set (first mapping wins)
          if (!this.omegaBindingLookup.get(key)!.has(omegaGesture)) {
            this.omegaBindingLookup.get(key)!.set(omegaGesture, {
              ...macro,
              trigger: { key, gesture: omegaGesture },
            });
          }
        }
      }
    }
  }

  /**
   * Map Alpha gesture to Omega gesture (for compatibility)
   */
  private alphaToOmegaGesture(alpha: GestureType): OmegaGestureType | null {
    // Map primary Alpha gestures to Omega equivalents
    switch (alpha) {
      case "single":
        return "quick";
      case "single_long":
      case "single_super_long":
        return "long";
      case "double":
        return "quick_toggle";
      case "double_long":
      case "double_super_long":
        return "long_toggle";
      // Triple and quadruple don't have Omega equivalents
      default:
        return null;
    }
  }

  /**
   * Get Alpha binding for a specific key and gesture
   */
  private getAlphaBinding(
    key: InputKey,
    gesture: GestureType,
  ): MacroBinding | undefined {
    const keyMap = this.alphaBindingLookup.get(key);
    if (!keyMap) return undefined;
    return keyMap.get(gesture);
  }

  /**
   * Get Omega binding for a specific key and gesture
   */
  private getOmegaBinding(
    key: InputKey,
    gesture: OmegaGestureType,
  ): OmegaMacroBinding | undefined {
    const keyMap = this.omegaBindingLookup.get(key);
    if (!keyMap) return undefined;
    return keyMap.get(gesture);
  }

  /**
   * Check if an Alpha gesture has a valid binding
   */
  private hasValidAlphaBinding(key: InputKey, gesture: GestureType): boolean {
    const binding = this.getAlphaBinding(key, gesture);
    return !isEmptyBinding(binding);
  }

  /**
   * Handle raw input events
   */
  private handleInputEvent(event: KeyEvent | MouseEvent): void {
    if (this.isStopped) return;

    if (this.debugMode) {
      if ("key" in event) {
        console.log(
          `🔍 DEBUG [${event.type}] key="${event.key}" ts=${event.timestamp}`,
        );
      } else {
        console.log(
          `🔍 DEBUG [${event.type}] button="${event.button}" ts=${event.timestamp}`,
        );
      }
    }

    // Route to active detector
    if (this.activeSystem === "omega" && this.omegaDetector) {
      if ("key" in event) {
        if (event.type === "down") {
          this.omegaDetector.handleKeyDown(event.key);
        } else {
          this.omegaDetector.handleKeyUp(event.key);
        }
      } else {
        if (event.type === "down") {
          this.omegaDetector.handleMouseDown(event.button);
        } else {
          this.omegaDetector.handleMouseUp(event.button);
        }
      }
    } else if (this.alphaDetector) {
      if ("key" in event) {
        if (event.type === "down") {
          this.alphaDetector.handleKeyDown(event.key);
        } else {
          this.alphaDetector.handleKeyUp(event.key);
        }
      } else {
        if (event.type === "down") {
          this.alphaDetector.handleMouseDown(event.button);
        } else {
          this.alphaDetector.handleMouseUp(event.button);
        }
      }
    }
  }

  /**
   * Handle detected Alpha gestures
   */
  private handleAlphaGesture(event: GestureEvent): void {
    if (this.isStopped) return;
    if (!this.profile || !this.executor) return;

    const { inputKey, gesture } = event;

    // P key: Reset short cooldowns (only if per-ability cooldowns enabled)
    if (inputKey === "P" && this.perAbilityCooldownsEnabled) {
      console.log(`\n🔄 [P] Resetting short cooldowns (<20s)...`);
      const reset = this.gcdManager.resetShortCooldowns(20000);
      if (reset.length > 0) {
        console.log(`   Reset: ${reset.join(", ")}`);
      } else {
        console.log(`   No abilities on short cooldown`);
      }
      return;
    }

    console.log(`\n🎯 [ALPHA] Gesture: ${inputKey} → ${gesture}`);

    // Find matching macro binding (with fallback logic)
    let binding = this.getAlphaBinding(inputKey, gesture);
    let usedFallback = false;

    if (isEmptyBinding(binding)) {
      const fallbackGesture = getGestureFallback(gesture, (g) =>
        this.hasValidAlphaBinding(inputKey, g),
      );

      if (fallbackGesture) {
        binding = this.getAlphaBinding(inputKey, fallbackGesture);
        usedFallback = true;
        console.log(`   Fallback: ${gesture} → ${fallbackGesture}`);
      }
    }

    if (!binding || isEmptyBinding(binding)) {
      console.log(`   No macro bound`);
      return;
    }

    if (usedFallback) {
      console.log(`   Matched (via fallback): "${binding.name}"`);
    } else {
      console.log(`   Matched: "${binding.name}"`);
    }

    this.executeBinding(binding);
  }

  /**
   * Handle detected Omega gestures
   */
  private handleOmegaGesture(event: OmegaGestureEvent): void {
    if (this.isStopped) return;
    if (!this.profile || !this.executor) return;

    const { inputKey, gesture, wasToggled, holdDuration } = event;

    // P key: Reset short cooldowns (only if per-ability cooldowns enabled)
    if (inputKey === "P" && this.perAbilityCooldownsEnabled) {
      console.log(`\n🔄 [P] Resetting short cooldowns (<20s)...`);
      const reset = this.gcdManager.resetShortCooldowns(20000);
      if (reset.length > 0) {
        console.log(`   Reset: ${reset.join(", ")}`);
      } else {
        console.log(`   No abilities on short cooldown`);
      }
      return;
    }

    const toggleIndicator = wasToggled ? " [TOGGLED]" : "";
    console.log(
      `\n🎯 [OMEGA] Gesture: ${inputKey} → ${gesture}${toggleIndicator} (${Math.round(holdDuration || 0)}ms)`,
    );

    // Find matching Omega binding
    const binding = this.getOmegaBinding(inputKey, gesture);

    if (!binding || isEmptyBinding(binding)) {
      console.log(`   No macro bound`);
      return;
    }

    console.log(`   Matched: "${binding.name}"`);

    this.executeBinding(binding);
  }

  /**
   * Execute a macro binding through the GCD system
   */
  private executeBinding(binding: MacroBinding | OmegaMacroBinding): void {
    // When cooldowns are disabled, bypass GCD system entirely
    if (!this.perAbilityCooldownsEnabled) {
      console.log(`   🎯 Executing (cooldowns disabled)`);
      this.executor!.executeDetached(binding as MacroBinding);
      return;
    }

    const gcdAbility = this.gcdManager.detectGCDAbility(
      binding as MacroBinding,
    );

    if (gcdAbility) {
      const result = this.gcdManager.tryExecute(binding as MacroBinding);

      if (result.executed) {
        console.log(`   ⚔️  Executed immediately (${gcdAbility})`);
      } else if (result.queued) {
        console.log(`   ⏳ Queued: ${result.reason}`);
      } else {
        console.log(`   ❌ Skipped: ${result.reason}`);
      }
    } else {
      console.log(`   🎯 Executing (non-GCD)`);
      this.executor!.executeDetached(binding as MacroBinding);
    }
  }

  /**
   * Load a macro profile
   */
  async loadProfile(filename: string): Promise<boolean> {
    const profile = this.profileLoader.loadProfile(filename);
    if (!profile) return false;

    this.profile = profile;
    this.buildBindingLookups();

    // Create the appropriate gesture detector based on active system
    if (this.activeSystem === "omega") {
      this.omegaDetector = createOmegaGestureDetector(
        profile.gestureSettings || DEFAULT_GESTURE_SETTINGS,
        (event) => this.handleOmegaGesture(event),
      );

      // Wire up special key handler for D retaliate, S group member, C escape, etc.
      this.specialKeyHandler = await createSpecialKeyHandler(true);
      this.omegaDetector.setSpecialKeyCallback((event) => {
        if (this.specialKeyHandler) {
          this.specialKeyHandler.handleEvent(event);
        }
      });
      console.log("🔧 Special key handler wired up (D/S/C/=/F2)");

      // Load per-key calibrated profiles
      const keyProfiles = this.profileLoader.getKeyProfiles();
      if (keyProfiles.size > 0) {
        const profilesRecord: Record<string, any> = {};
        for (const [key, keyProfile] of keyProfiles) {
          profilesRecord[key] = keyProfile;
        }
        this.omegaDetector.loadKeyProfiles(profilesRecord);
        console.log(
          `🎯 Applied ${keyProfiles.size} per-key gesture profiles (Omega)`,
        );
      }
    } else {
      this.alphaDetector = new GestureDetector(
        profile.gestureSettings || DEFAULT_GESTURE_SETTINGS,
        (event) => this.handleAlphaGesture(event),
      );

      // Load per-key calibrated profiles
      const keyProfiles = this.profileLoader.getKeyProfiles();
      if (keyProfiles.size > 0) {
        const profilesRecord: Record<string, any> = {};
        for (const [key, keyProfile] of keyProfiles) {
          profilesRecord[key] = keyProfile;
        }
        this.alphaDetector.loadKeyProfiles(profilesRecord);
        console.log(
          `🎯 Applied ${keyProfiles.size} per-key gesture profiles (Alpha)`,
        );
      }
    }

    // Compiled profile for executor
    const compiled = this.profileLoader.getCompiledProfile();
    if (compiled && this.executor && "setCompiledProfile" in this.executor) {
      try {
        (this.executor as any).setCompiledProfile(compiled);
        console.log(
          `🔧 Compiled profile applied to executor (${compiled.conundrumKeys.size} conundrum keys)`,
        );
      } catch (err) {
        console.warn("⚠️  Failed to apply compiled profile to executor:", err);
      }
    }

    return true;
  }

  /**
   * Start the calibration hot-reload server
   */
  private async startCalibrationServer(): Promise<void> {
    try {
      const server = getCalibrationServer(8765);
      await server.start();

      // Connect to active gesture detector
      const activeDetector =
        this.activeSystem === "omega" ? this.omegaDetector : this.alphaDetector;

      if (activeDetector) {
        server.connectGestureDetector(activeDetector as any);
      }

      if (this.profile?.gestureSettings) {
        server.setGlobalDefaults(this.profile.gestureSettings);
      }

      this.calibrationServerEnabled = true;
      console.log("\n🔥 Calibration server enabled (ws://localhost:8765)");
    } catch (error) {
      console.warn("⚠️  Failed to start calibration server:", error);
    }
  }

  /**
   * Start the macro agent
   */
  async start(
    backend?: ExecutorBackend,
    system?: GestureSystem,
  ): Promise<void> {
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║       SWTOR MACRO AGENT - GCD System v2.0              ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    // System selection (if not provided via argument)
    if (!system) {
      // Check for command line argument or environment variable
      const args = process.argv.slice(2);
      const systemArg = args.find((a) => a.startsWith("--system="));
      if (systemArg) {
        const value = systemArg.split("=")[1].toLowerCase();
        if (value === "omega" || value === "alpha") {
          system = value;
        }
      } else if (process.env.GESTURE_SYSTEM) {
        const envValue = process.env.GESTURE_SYSTEM.toLowerCase();
        if (envValue === "omega" || envValue === "alpha") {
          system = envValue;
        }
      }

      // If still not set, prompt user
      if (!system) {
        system = await selectGestureSystem();
      }
    }

    this.activeSystem = system;

    console.log(`\n🎮 Active gesture system: ${system.toUpperCase()}`);
    if (system === "omega") {
      console.log("   • 4 gestures: quick, long, quick_toggle, long_toggle");
      console.log("   • Long fires IMMEDIATELY on threshold cross");
      console.log("   • W/Y toggle keys for modifier state");
      console.log("   • GCD: 1.275s (corrected)");
    } else {
      console.log("   • 12 gestures: single/double/triple/quadruple variants");
      console.log("   • Multi-tap detection with elongating window");
      console.log("   • Long ↔ Super Long fallback enabled");
    }

    // Cooldown mode selection
    const cooldownArg = process.argv.find((a) => a.startsWith("--cooldowns="));
    if (cooldownArg) {
      const value = cooldownArg.split("=")[1].toLowerCase();
      this.perAbilityCooldownsEnabled =
        value === "yes" || value === "y" || value === "true";
    } else if (process.env.ABILITY_COOLDOWNS) {
      const envValue = process.env.ABILITY_COOLDOWNS.toLowerCase();
      this.perAbilityCooldownsEnabled =
        envValue === "yes" || envValue === "y" || envValue === "true";
    } else {
      // Prompt user
      this.perAbilityCooldownsEnabled = await selectCooldownMode();
    }

    // Configure GCD manager with cooldown mode
    this.gcdManager.setPerAbilityCooldownsEnabled(
      this.perAbilityCooldownsEnabled,
    );

    if (this.perAbilityCooldownsEnabled) {
      console.log("\n⏱️  Per-ability cooldowns: ENABLED");
      console.log("   • Abilities respect their in-game cooldowns");
      console.log("   • P key resets short cooldowns (<20s)");
    } else {
      console.log("\n⏱️  Per-ability cooldowns: DISABLED (GCD only)");
      console.log("   • Only 1.275s GCD between abilities");
      console.log("   • You manage cooldowns yourself");
    }

    // Initialize executor
    await this.initializeExecutor(backend);
    console.log(`\n🔧 Executor backend: ${this.currentBackend.toUpperCase()}`);

    // Load profile
    const profiles = this.profileLoader.listProfiles();

    if (profiles.length === 0) {
      console.log("⚠️  No profiles found in ./profiles/");
      console.log("   Creating example profile...\n");

      if (!(await this.loadProfile("example.json"))) {
        console.error("❌ Failed to load profile");
        return;
      }
    } else {
      console.log(`📂 Available profiles: ${profiles.join(", ")}`);

      let profileToLoad: string;
      if (this.preferredProfile) {
        if (profiles.includes(this.preferredProfile)) {
          profileToLoad = this.preferredProfile;
        } else {
          console.error(
            `❌ Specified profile not found: ${this.preferredProfile}`,
          );
          return;
        }
      } else {
        const swtorProfile = profiles.find((p) =>
          p.toLowerCase().includes("swtor"),
        );
        profileToLoad = swtorProfile || profiles[0];
      }

      console.log(`📌 Loading: ${profileToLoad}`);
      if (!(await this.loadProfile(profileToLoad))) {
        console.error("❌ Failed to load profile");
        return;
      }
    }

    // Start calibration server if enabled
    if (process.env.ENABLE_CALIBRATION_SERVER === "true") {
      await this.startCalibrationServer();
    }

    // Show summary
    if (this.profile) {
      let gcdCount = 0;
      let nonGcdCount = 0;
      for (const macro of this.profile.macros) {
        if (macro.enabled) {
          if (this.gcdManager.detectGCDAbility(macro)) {
            gcdCount++;
          } else {
            nonGcdCount++;
          }
        }
      }

      console.log(
        `\n📋 Loaded macros: ${gcdCount} GCD, ${nonGcdCount} non-GCD`,
      );
      console.log(
        `   GCD Duration: ${this.activeSystem === "omega" ? "1.275s" : "1.385s"}`,
      );
    }

    console.log("\n🔒 GCD System:");
    console.log("   • GCD abilities queue when GCD active");
    console.log("   • Most recent gesture wins when GCD ends");
    console.log("   • Per-ability cooldowns tracked independently");

    console.log("\n📀 Concurrency:");
    console.log("   • Simultaneous keys: YES");
    console.log("   • Concurrent sequences: YES");
    console.log("   • GCD abilities: QUEUED");

    // Show calibration status
    if (this.profileLoader.hasCalibrationData()) {
      const detector =
        this.activeSystem === "omega" ? this.omegaDetector : this.alphaDetector;
      const customKeys = detector?.getCustomizedKeys() || [];
      console.log("\n📏 Calibration:");
      console.log(`   • Per-key profiles: ${customKeys.length} keys`);
    }

    // Start listening
    console.log("\n─────────────────────────────────────────────────────────");
    this.inputListener.start();
  }

  /**
   * Stop the macro agent
   */
  stop(): void {
    this.isStopped = true;
    this.inputListener.stop();
    this.gcdManager.shutdown();

    // Destroy active detector
    if (this.alphaDetector && "destroy" in this.alphaDetector) {
      (this.alphaDetector as any).destroy?.();
    }
    if (this.omegaDetector) {
      this.omegaDetector.destroy();
    }

    // Stop executor
    if (this.executor && "cancelAll" in this.executor) {
      (this.executor as any).cancelAll?.();
    }
    if (this.executor && "destroy" in this.executor) {
      (this.executor as any).destroy?.();
    }

    // Stop calibration server
    if (this.calibrationServerEnabled) {
      stopCalibrationServer();
    }

    console.log("🛑 Macro Agent stopped");
  }

  getBackend(): ExecutorBackend {
    return this.currentBackend;
  }

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
  const args = process.argv.slice(2);

  // Show help
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
SWTOR Macro Agent - GCD System v2.0 (Alpha/Omega)

USAGE:
  npm start                    Auto-select executor, prompt for system
  npm start -- --system=omega  Use Omega gesture system
  npm start -- --system=alpha  Use Alpha gesture system
  npm start -- --backend=X     Use specific executor backend
  npm start -- --backends      Show available backends
  npm start -- --help          Show this help

GESTURE SYSTEMS:
  alpha       12 gestures (original) - single/double/triple/quadruple variants
  omega       4 gestures (streamlined) - quick/long with toggle modifiers

BACKENDS:
  robotjs       RobotJS (SendInput API) - Medium detection risk
  interception  Interception Driver - Hard to detect (kernel-level)
  mock          Mock executor (no keypresses) - For testing

CALIBRATION:
  npm run calibrate              Run calibration wizard
  npm run calibrate:hot          Hot-reload mode (live tuning)

OPTIONS:
  --system=<alpha|omega>       Select gesture detection system
  --backend=<backend>          Select executor backend
  --profile=<filename>         Load specific profile
  --debug                      Show ALL raw key events

ENVIRONMENT:
  GESTURE_SYSTEM=omega           Set default gesture system
  MACRO_BACKEND=interception     Set default executor backend
  ENABLE_CALIBRATION_SERVER=true Enable hot-reload server
`);
    process.exit(0);
  }

  // Show available backends
  if (args.includes("--backends")) {
    await MacroAgent.showBackends();
    process.exit(0);
  }

  // Parse options
  let backend: ExecutorBackend | undefined;
  const backendArg = args.find((a) => a.startsWith("--backend="));
  if (backendArg) {
    backend = backendArg.split("=")[1] as ExecutorBackend;
  } else if (process.env.MACRO_BACKEND) {
    backend = process.env.MACRO_BACKEND as ExecutorBackend;
  }

  let profileName: string | undefined;
  const profileArg = args.find((a) => a.startsWith("--profile="));
  if (profileArg) {
    profileName = profileArg.split("=")[1];
  }

  let system: GestureSystem | undefined;
  const systemArg = args.find((a) => a.startsWith("--system="));
  if (systemArg) {
    const value = systemArg.split("=")[1].toLowerCase();
    if (value === "omega" || value === "alpha") {
      system = value;
    }
  }

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
    setTimeout(() => process.exit(0), 50);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("exit", shutdown);

  // Start the agent
  await agent.start(backend, system);
}

main().catch(console.error);
