// ============================================================================
// CALIBRATION CLI - Interactive calibration wizard and hot-reload client
// ============================================================================
//
// Provides:
// - Interactive calibration wizard with visual feedback
// - Hot-reload mode for live threshold adjustment
// - Test mode for verifying calibrated keys
// - Manual adjustment tools
// - Profile export/import
//
// ============================================================================

import * as readline from "readline";
import { WebSocket } from "ws";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { performance } from "perf_hooks";
import {
  InputKey,
  GestureType,
  GestureSettings,
  GestureEvent,
  KeyProfile,
  CalibrationStep,
  CALIBRATION_STEPS,
  STEP_NAMES,
  STEP_INSTRUCTIONS,
  CalibrationConfig,
  DEFAULT_CALIBRATION_CONFIG,
  getSpecialKeyConfig,
  INPUT_KEYS,
  CalibratedMacroProfile,
  ServerMessage,
  CLIDisplayConfig,
  DEFAULT_CLI_DISPLAY,
} from "./calibrationTypes.js";
import {
  CalibrationManager,
  getCalibrationManager,
  calculateStatistics,
} from "./calibrationManager.js";

// ============================================================================
// ANSI COLOR CODES
// ============================================================================

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
};

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

function colorize(text: string, color: keyof typeof COLORS): string {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function progressBar(
  current: number,
  total: number,
  width: number = 40,
): string {
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  return `[${bar}] ${current}/${total}`;
}

function clearScreen(): void {
  process.stdout.write("\x1b[2J\x1b[H");
}

function moveCursor(row: number, col: number): void {
  process.stdout.write(`\x1b[${row};${col}H`);
}

function clearLine(): void {
  process.stdout.write("\x1b[2K");
}

// ============================================================================
// CALIBRATION CLI CLASS
// ============================================================================

export class CalibrationCLI {
  private rl: readline.Interface;
  private manager: CalibrationManager;
  private config: CalibrationConfig;
  private displayConfig: CLIDisplayConfig;
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private isCollecting: boolean = false;
  private currentKey: InputKey | null = null;
  private currentStep: CalibrationStep | null = null;
  private stepData: number[] = [];
  private keyDownTime: number | null = null;
  private lastKeyUpTime: number | null = null;
  private multiTapGaps: number[] = [];

  // Raw mode input handling
  private rawModeActive: boolean = false;

  constructor(config: Partial<CalibrationConfig> = {}) {
    this.config = { ...DEFAULT_CALIBRATION_CONFIG, ...config };
    this.displayConfig = { ...DEFAULT_CLI_DISPLAY };
    this.manager = getCalibrationManager(this.config);

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  // ==========================================================================
  // MAIN ENTRY POINTS
  // ==========================================================================

  /**
   * Start the full calibration wizard
   */
  async startWizard(keys?: InputKey[]): Promise<void> {
    clearScreen();
    this.showWelcome();

    const keysToCalibrate = keys || (await this.selectKeys());

    if (keysToCalibrate.length === 0) {
      console.log("\n" + colorize("No keys selected. Exiting.", "yellow"));
      return;
    }

    console.log(
      `\n${colorize("Starting calibration for " + keysToCalibrate.length + " keys...", "cyan")}\n`,
    );
    await this.sleep(1000);

    for (let i = 0; i < keysToCalibrate.length; i++) {
      const key = keysToCalibrate[i];
      console.log(
        `\n${colorize(`[${i + 1}/${keysToCalibrate.length}]`, "dim")} Calibrating ${colorize(key, "bright")} key...\n`,
      );
      await this.calibrateKey(key);

      if (i < keysToCalibrate.length - 1) {
        await this.prompt("\nPress Enter to continue to next key...");
      }
    }

    await this.showFinalSummary(keysToCalibrate);
  }

  /**
   * Start hot-reload mode (connect to running server)
   */
  async startHotReload(
    host: string = "localhost",
    port: number = 8765,
  ): Promise<void> {
    clearScreen();
    console.log(colorize("🔥 Hot-Reload Calibration Mode", "bright"));
    console.log("━".repeat(50) + "\n");

    try {
      await this.connectToServer(host, port);
      console.log(colorize("✅ Connected to gesture detector\n", "green"));

      this.showHotReloadHelp();
      await this.hotReloadCommandLoop();
    } catch (error: any) {
      console.error(colorize(`❌ Connection failed: ${error.message}`, "red"));
      console.log(
        "\nMake sure the main application is running with ENABLE_CALIBRATION_SERVER=true",
      );
    }
  }

  /**
   * Quick calibration mode (fewer samples)
   */
  async startQuickMode(keys?: InputKey[]): Promise<void> {
    this.config.quickMode = true;
    this.config.samplesPerStep = this.config.quickModeSamples;
    this.manager.updateConfig(this.config);

    console.log(
      colorize(
        "⚡ Quick Mode: Using 5 samples per step instead of 10\n",
        "yellow",
      ),
    );
    await this.startWizard(keys);
  }

  // ==========================================================================
  // WELCOME AND KEY SELECTION
  // ==========================================================================

  private showWelcome(): void {
    console.log(
      "┌─" +
        colorize(" Gesture Calibration Wizard ", "bright") +
        "─────────────────────┐",
    );
    console.log("│                                                   │");
    console.log("│ Welcome! This wizard will calibrate gesture       │");
    console.log("│ detection for your unique finger timing.          │");
    console.log("│                                                   │");
    console.log("│ You'll perform each gesture type multiple times   │");
    console.log("│ per key, and the system will calculate optimal    │");
    console.log("│ thresholds automatically.                         │");
    console.log("│                                                   │");
    console.log("│ Estimated time: 2-5 minutes per key               │");
    console.log("│                                                   │");
    console.log("└───────────────────────────────────────────────────┘");
  }

  private async selectKeys(): Promise<InputKey[]> {
    console.log("\n" + colorize("Select keys to calibrate:", "cyan"));
    console.log("  [1] All keys (" + INPUT_KEYS.length + " keys)");
    console.log("  [2] Movement keys (W, A, S, D)");
    console.log("  [3] Number keys (1-9)");
    console.log("  [4] Custom selection");
    console.log("  [5] Single key");

    const choice = await this.prompt("\nChoice [1-5]: ");

    switch (choice.trim()) {
      case "1":
        return [...INPUT_KEYS];
      case "2":
        return ["W", "A", "S", "D"] as InputKey[];
      case "3":
        return ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as InputKey[];
      case "4":
        return await this.selectCustomKeys();
      case "5":
        return await this.selectSingleKey();
      default:
        return [];
    }
  }

  private async selectCustomKeys(): Promise<InputKey[]> {
    console.log("\nAvailable keys: " + INPUT_KEYS.join(", "));
    const input = await this.prompt("Enter keys separated by commas: ");

    const keys = input
      .split(",")
      .map((k) => k.trim().toUpperCase())
      .filter((k) => INPUT_KEYS.includes(k as InputKey)) as InputKey[];

    return keys;
  }

  private async selectSingleKey(): Promise<InputKey[]> {
    console.log("\nAvailable keys: " + INPUT_KEYS.join(", "));
    const input = await this.prompt("Enter key: ");
    const key = input.trim().toUpperCase() as InputKey;

    if (INPUT_KEYS.includes(key)) {
      return [key];
    }

    console.log(colorize("Invalid key", "red"));
    return [];
  }

  // ==========================================================================
  // KEY CALIBRATION
  // ==========================================================================

  private async calibrateKey(key: InputKey): Promise<void> {
    this.currentKey = key;
    this.manager.startKeyCalibration(key);

    const specialConfig = getSpecialKeyConfig(key);
    const stepsToRun = specialConfig?.skipMultiTap
      ? CALIBRATION_STEPS.filter(
          (s) => !s.includes("_tap") || s === "single_tap",
        )
      : CALIBRATION_STEPS;

    if (specialConfig) {
      console.log(
        colorize(`ℹ️  Special case: ${specialConfig.note}`, "yellow"),
      );
    }

    for (let i = 0; i < stepsToRun.length; i++) {
      const step = stepsToRun[i];
      clearScreen();
      console.log(colorize(`🎯 Calibrating: ${key} Key`, "bright"));
      console.log("━".repeat(50) + "\n");
      console.log(
        `Step ${i + 1}/${stepsToRun.length}: ${colorize(STEP_NAMES[step], "cyan")}`,
      );
      console.log("─".repeat(50) + "\n");
      console.log(STEP_INSTRUCTIONS[step]);
      console.log("");

      await this.collectStepData(key, step);
    }

    // Analyze and show results
    const thresholds = this.manager.analyzeKey(key);
    if (thresholds) {
      await this.showKeyResults(key, thresholds);
    }

    this.currentKey = null;
  }

  private async collectStepData(
    key: InputKey,
    step: CalibrationStep,
  ): Promise<void> {
    this.currentStep = step;
    this.stepData = [];
    this.multiTapGaps = [];

    const samplesNeeded = this.config.quickMode
      ? this.config.quickModeSamples
      : this.config.samplesPerStep;

    console.log(`Progress: ${progressBar(0, samplesNeeded)}\n`);

    // Enable raw mode for key capture
    await this.enableRawMode();

    while (this.stepData.length < samplesNeeded) {
      await this.waitForInput(key, step);

      // Update progress
      moveCursor(6, 1);
      clearLine();
      console.log(
        `Progress: ${progressBar(this.stepData.length, samplesNeeded)}`,
      );

      // Show collected data
      this.showCollectedSamples(step);
    }

    // Disable raw mode
    await this.disableRawMode();

    // Record data to manager
    this.recordStepData(key, step);

    // Show step statistics
    this.showStepStatistics(step);

    await this.sleep(500);
  }

  private async waitForInput(
    key: InputKey,
    step: CalibrationStep,
  ): Promise<void> {
    return new Promise((resolve) => {
      const handleKeypress = (chunk: Buffer) => {
        const pressedKey = chunk.toString().toUpperCase();
        const now = performance.now();

        // Handle Ctrl+C
        if (chunk[0] === 3) {
          this.disableRawMode();
          process.exit(0);
        }

        // Only process the calibration key
        if (
          pressedKey !== key &&
          pressedKey.charCodeAt(0) !== key.charCodeAt(0)
        ) {
          return;
        }

        // Key down
        if (this.keyDownTime === null) {
          this.keyDownTime = now;

          // For multi-tap, record gap from last key up
          if (
            (step === "double_tap" ||
              step === "triple_tap" ||
              step === "quadruple_tap") &&
            this.lastKeyUpTime !== null
          ) {
            const gap = now - this.lastKeyUpTime;
            this.multiTapGaps.push(gap);
          }
        }
      };

      const handleKeyUp = () => {
        if (this.keyDownTime !== null) {
          const now = performance.now();
          const duration = now - this.keyDownTime;
          this.keyDownTime = null;
          this.lastKeyUpTime = now;

          // Process based on step type
          if (
            step === "single_tap" ||
            step === "long_hold" ||
            step === "super_long_hold"
          ) {
            this.stepData.push(duration);
            process.stdin.removeListener("data", handleKeypress);
            resolve();
          } else if (step === "double_tap") {
            if (this.multiTapGaps.length >= 1) {
              this.stepData.push(this.multiTapGaps[0]);
              this.multiTapGaps = [];
              this.lastKeyUpTime = null;
              process.stdin.removeListener("data", handleKeypress);
              resolve();
            }
          } else if (step === "triple_tap") {
            if (this.multiTapGaps.length >= 2) {
              this.stepData.push(...this.multiTapGaps);
              this.manager.recordTripleTapGaps(key, this.multiTapGaps);
              this.multiTapGaps = [];
              this.lastKeyUpTime = null;
              process.stdin.removeListener("data", handleKeypress);
              resolve();
            }
          } else if (step === "quadruple_tap") {
            if (this.multiTapGaps.length >= 3) {
              this.stepData.push(...this.multiTapGaps);
              this.manager.recordQuadrupleTapGaps(key, this.multiTapGaps);
              this.multiTapGaps = [];
              this.lastKeyUpTime = null;
              process.stdin.removeListener("data", handleKeypress);
              resolve();
            }
          }
        }
      };

      // Set up timeout for multi-tap detection
      let multiTapTimeout: NodeJS.Timeout | null = null;

      const resetMultiTap = () => {
        if (multiTapTimeout) clearTimeout(multiTapTimeout);
        multiTapTimeout = setTimeout(() => {
          // Reset if too much time between taps
          if (
            (step === "double_tap" ||
              step === "triple_tap" ||
              step === "quadruple_tap") &&
            this.multiTapGaps.length > 0
          ) {
            this.multiTapGaps = [];
            this.lastKeyUpTime = null;
          }
        }, 500);
      };

      process.stdin.on("data", (chunk) => {
        handleKeypress(chunk);
        // Simulate key up after short delay (since we can't detect real key up in raw mode)
        setTimeout(handleKeyUp, 50);
        resetMultiTap();
      });
    });
  }

  private showCollectedSamples(step: CalibrationStep): void {
    moveCursor(8, 1);

    const label = step.includes("tap")
      ? step === "single_tap"
        ? "Hold:"
        : "Gap:"
      : "Hold:";

    const recentSamples = this.stepData.slice(-8);

    for (let i = 0; i < 8; i++) {
      clearLine();
      if (i < recentSamples.length) {
        const val = Math.round(recentSamples[i]);
        console.log(
          `  Sample ${this.stepData.length - 8 + i + 1}: ${label} ${colorize(val + "ms", "green")} ✓`,
        );
      } else {
        console.log("");
      }
    }
  }

  private showStepStatistics(step: CalibrationStep): void {
    if (this.stepData.length === 0) return;

    const stats = calculateStatistics(this.stepData, this.config);

    console.log("\n" + colorize("Live Statistics:", "cyan"));
    console.log(`  Mean:     ${Math.round(stats.mean)}ms`);
    console.log(
      `  Range:    ${Math.round(stats.min)}-${Math.round(stats.max)}ms`,
    );
    console.log(`  Std Dev:  ${stats.stdDev.toFixed(1)}ms`);
  }

  private recordStepData(key: InputKey, step: CalibrationStep): void {
    switch (step) {
      case "single_tap":
        for (const duration of this.stepData) {
          this.manager.recordSingleTap(key, duration);
        }
        break;
      case "long_hold":
        for (const duration of this.stepData) {
          this.manager.recordLongHold(key, duration);
        }
        break;
      case "super_long_hold":
        for (const duration of this.stepData) {
          this.manager.recordSuperLongHold(key, duration);
        }
        break;
      case "double_tap":
        for (const gap of this.stepData) {
          this.manager.recordDoubleTapGap(key, gap);
        }
        break;
      // triple_tap and quadruple_tap already recorded in waitForInput
    }
  }

  // ==========================================================================
  // RESULTS DISPLAY
  // ==========================================================================

  private async showKeyResults(key: InputKey, thresholds: any): Promise<void> {
    clearScreen();
    console.log(colorize(`✅ ${key} Key Calibration Complete!`, "green"));
    console.log("━".repeat(50) + "\n");

    const rawData = this.manager.getRawData(key);
    if (rawData) {
      console.log(colorize("Analyzed Data:", "cyan"));

      const singleStats = calculateStatistics(rawData.singleTaps, this.config);
      const longStats = calculateStatistics(rawData.longHolds, this.config);
      const superLongStats = calculateStatistics(
        rawData.superLongHolds,
        this.config,
      );
      const allGaps = [
        ...rawData.doubleTapGaps,
        ...rawData.tripleTapGaps,
        ...rawData.quadrupleTapGaps,
      ];
      const gapStats = calculateStatistics(allGaps, this.config);

      console.log(
        `  Single Tap:       ${Math.round(singleStats.mean)}ms avg (${Math.round(singleStats.min)}-${Math.round(singleStats.max)}ms range)`,
      );
      console.log(
        `  Long Hold:        ${Math.round(longStats.mean)}ms avg (${Math.round(longStats.min)}-${Math.round(longStats.max)}ms range)`,
      );
      console.log(
        `  Super Long Hold:  ${Math.round(superLongStats.mean)}ms avg (${Math.round(superLongStats.min)}-${Math.round(superLongStats.max)}ms range)`,
      );
      if (allGaps.length > 0) {
        console.log(
          `  Multi-Tap Gap:    ${Math.round(gapStats.mean)}ms avg (${Math.round(gapStats.min)}-${Math.round(gapStats.max)}ms range)`,
        );
      }
    }

    console.log("\n" + colorize("Recommended Thresholds:", "cyan"));
    console.log("━".repeat(50));
    console.log(`  Single Tap Range:     < ${thresholds.singleTapMax}ms`);
    console.log(
      `  Long Press Range:     ${thresholds.longPressMin}-${thresholds.longPressMax}ms`,
    );
    console.log(
      `  Super Long Range:     ${thresholds.superLongMin}-${thresholds.superLongMax}ms`,
    );
    console.log(`  Cancel Threshold:     > ${thresholds.cancelThreshold}ms`);
    console.log(`  Multi-Press Window:   ${thresholds.multiPressWindow}ms`);

    console.log("\n" + colorize("Reasoning:", "dim"));
    for (const reason of thresholds.reasoning.slice(0, 5)) {
      console.log(`  • ${reason}`);
    }

    // Confidence display
    const confidenceColor =
      thresholds.confidence >= 80
        ? "green"
        : thresholds.confidence >= 60
          ? "yellow"
          : "red";
    const stars = "⭐".repeat(Math.ceil(thresholds.confidence / 20));
    console.log(
      `\nConfidence: ${colorize(stars, confidenceColor)} (${thresholds.confidence}%)`,
    );
    console.log(
      `Sample Quality: ${thresholds.confidence >= 80 ? "Excellent" : thresholds.confidence >= 60 ? "Good" : "Fair"}`,
    );
  }

  private async showFinalSummary(keys: InputKey[]): Promise<void> {
    clearScreen();
    console.log(colorize("🎉 Calibration Complete!", "green"));
    console.log("━".repeat(50) + "\n");

    console.log(`Calibrated ${keys.length} keys:\n`);

    for (const key of keys) {
      const thresholds = this.manager.getThresholds(key);
      if (thresholds) {
        const confidenceIcon =
          thresholds.confidence >= 80
            ? "✅"
            : thresholds.confidence >= 60
              ? "⚠️"
              : "❌";
        console.log(
          `  ${confidenceIcon} ${key} - ${thresholds.confidence}% confidence, ${thresholds.multiPressWindow}ms window`,
        );
      }
    }

    console.log(
      "\n" +
        colorize("Would you like to export the calibration profile?", "cyan"),
    );
    const exportChoice = await this.prompt("[Y/n]: ");

    if (exportChoice.toLowerCase() !== "n") {
      await this.exportProfile();
    }
  }

  // ==========================================================================
  // HOT RELOAD MODE
  // ==========================================================================

  private async connectToServer(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://${host}:${port}`);

      this.ws.on("open", () => {
        this.isConnected = true;
        resolve();
      });

      this.ws.on("error", (error) => {
        reject(error);
      });

      this.ws.on("close", () => {
        this.isConnected = false;
        console.log("\n📡 Disconnected from server");
      });

      this.ws.on("message", (data) => {
        this.handleServerMessage(JSON.parse(data.toString()));
      });
    });
  }

  private handleServerMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case "GESTURE_DETECTED":
        console.log(
          `${colorize("✅", "green")} ${msg.key} → ${colorize(msg.gesture, "cyan")} (${msg.timing}ms)`,
        );
        break;
      case "PROFILE_UPDATED":
        console.log(`\n${colorize("✅ Profile updated:", "green")} ${msg.key}`);
        break;
      case "SUCCESS":
        console.log(`\n${colorize("✅", "green")} ${msg.message}`);
        break;
      case "ERROR":
        console.log(`\n${colorize("❌ Error:", "red")} ${msg.message}`);
        break;
      case "RECENT_GESTURES":
        this.displayRecentGestures(msg.gestures as GestureEvent[]);
        break;
    }
  }

  private displayRecentGestures(gestures: GestureEvent[]): void {
    console.log("\n" + colorize("📊 Recent Gestures:", "cyan") + "\n");
    gestures.forEach((g, i) => {
      const timing = g.holdDuration ? `${g.holdDuration}ms` : "N/A";
      console.log(`  ${i + 1}. ${g.inputKey} → ${g.gesture} (${timing})`);
    });
    console.log("");
  }

  private showHotReloadHelp(): void {
    console.log(colorize("Commands:", "cyan"));
    console.log("  calibrate <key>     - Recalibrate specific key");
    console.log("  test <key>          - Enter test mode for key");
    console.log("  adjust <key>        - Manually adjust thresholds");
    console.log("  status              - Show current profiles");
    console.log("  history <key>       - Show recent gestures for key");
    console.log("  export              - Save current config");
    console.log("  load <path>         - Load a profile");
    console.log("  help                - Show this help");
    console.log("  exit                - Exit calibration mode\n");
  }

  private async hotReloadCommandLoop(): Promise<void> {
    while (this.isConnected) {
      const input = await this.prompt("> ");
      const [command, ...args] = input.trim().split(/\s+/);

      if (!command) continue;

      try {
        await this.handleHotReloadCommand(command.toLowerCase(), args);
      } catch (error: any) {
        console.error(colorize(`Error: ${error.message}`, "red"));
      }
    }
  }

  private async handleHotReloadCommand(
    command: string,
    args: string[],
  ): Promise<void> {
    switch (command) {
      case "calibrate":
        if (!args[0]) {
          console.log("Usage: calibrate <key>");
          break;
        }
        await this.calibrateKey(args[0].toUpperCase() as InputKey);
        break;

      case "test":
        if (!args[0]) {
          console.log("Usage: test <key>");
          break;
        }
        await this.enterTestMode(args[0].toUpperCase() as InputKey);
        break;

      case "adjust":
        if (!args[0]) {
          console.log("Usage: adjust <key>");
          break;
        }
        await this.adjustKey(args[0].toUpperCase() as InputKey);
        break;

      case "status":
        this.sendCommand({ type: "GET_CURRENT_PROFILE" });
        await this.sleep(500);
        break;

      case "history":
        if (!args[0]) {
          console.log("Usage: history <key>");
          break;
        }
        this.sendCommand({
          type: "GET_RECENT_GESTURES",
          key: args[0].toUpperCase() as InputKey,
          count: 20,
        });
        await this.sleep(500);
        break;

      case "export":
        await this.exportProfile();
        break;

      case "load":
        if (!args[0]) {
          console.log("Usage: load <path>");
          break;
        }
        this.sendCommand({ type: "LOAD_PROFILE", path: args[0] });
        break;

      case "help":
        this.showHotReloadHelp();
        break;

      case "exit":
        console.log("\n👋 Exiting calibration mode.");
        if (this.ws) {
          this.ws.close();
        }
        process.exit(0);
        break;

      default:
        console.log(`Unknown command: ${command}`);
        console.log('Type "help" for available commands');
    }
  }

  private async enterTestMode(key: InputKey): Promise<void> {
    console.log(`\n${colorize("🎮 Test Mode:", "cyan")} ${key} Key`);
    console.log(
      "Press the key with various gestures. Press Ctrl+C to exit test mode.\n",
    );

    this.sendCommand({ type: "SUBSCRIBE_KEY", key });

    // Wait for user to exit
    await new Promise<void>((resolve) => {
      const handler = () => {
        console.log("\n\n⏹️  Exiting test mode...\n");
        process.removeListener("SIGINT", handler);
        this.sendCommand({ type: "UNSUBSCRIBE_KEY", key } as any);
        resolve();
      };
      process.on("SIGINT", handler);
    });
  }

  private async adjustKey(key: InputKey): Promise<void> {
    console.log(`\n${colorize("🔧 Manual Adjustment:", "cyan")} ${key} Key`);
    console.log("━".repeat(50) + "\n");

    // Get current profile
    const profile = this.manager.getKeyProfile(key);

    if (profile) {
      console.log("Current Settings:");
      console.log(`  [1] multiPressWindow: ${profile.multiPressWindow}ms`);
      console.log(`  [2] longPressMin:     ${profile.longPressMin}ms`);
      console.log(`  [3] longPressMax:     ${profile.longPressMax}ms`);
      console.log(`  [4] superLongMin:     ${profile.superLongMin}ms`);
      console.log(`  [5] superLongMax:     ${profile.superLongMax}ms`);
      console.log(`  [6] cancelThreshold:  ${profile.cancelThreshold}ms`);
      console.log(`  [7] Back to main menu`);
    }

    const choice = await this.prompt("\nSelect parameter to adjust [1-7]: ");

    const params: Array<keyof GestureSettings> = [
      "multiPressWindow",
      "longPressMin",
      "longPressMax",
      "superLongMin",
      "superLongMax",
      "cancelThreshold",
    ];

    const paramIndex = parseInt(choice) - 1;
    if (paramIndex >= 0 && paramIndex < params.length && profile) {
      const param = params[paramIndex];
      const currentValue = profile[param];

      console.log(`\n${param} (current: ${currentValue}ms)`);
      const newValue = await this.prompt(
        "Enter new value (or +/- for increments): ",
      );

      let finalValue: number;
      if (newValue.startsWith("+")) {
        finalValue = currentValue + parseInt(newValue.slice(1));
      } else if (newValue.startsWith("-")) {
        finalValue = currentValue - parseInt(newValue.slice(1));
      } else {
        finalValue = parseInt(newValue);
      }

      if (!isNaN(finalValue)) {
        console.log(`\nUpdated: ${param} = ${finalValue}ms`);

        const confirm = await this.prompt("Apply? [Y/n]: ");
        if (confirm.toLowerCase() !== "n") {
          this.sendCommand({
            type: "UPDATE_KEY_PROFILE",
            key,
            profile: { [param]: finalValue },
          });
          console.log(colorize("✅ Applied!", "green"));
        }
      }
    }
  }

  private sendCommand(command: any): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(command));
    }
  }

  // ==========================================================================
  // PROFILE EXPORT
  // ==========================================================================

  private async exportProfile(): Promise<void> {
    console.log("\n" + colorize("💾 Export Calibration Profile", "cyan"));
    console.log("━".repeat(50) + "\n");

    const filename = await this.prompt("Filename (or press Enter for auto): ");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fname = filename.trim() || `calibrated-profile-${timestamp}.json`;

    const profilesDir = join(process.cwd(), "profiles");
    if (!existsSync(profilesDir)) {
      mkdirSync(profilesDir, { recursive: true });
    }

    const outputPath = join(profilesDir, fname);

    const defaultSettings: GestureSettings = {
      multiPressWindow: 355,
      debounceDelay: 10,
      longPressMin: 520,
      longPressMax: 860,
      superLongMin: 861,
      superLongMax: 1300,
      cancelThreshold: 1301,
    };

    const exportData = this.manager.exportProfiles(defaultSettings);
    exportData.name = "Calibrated Gesture Profile";
    exportData.description =
      "Per-key calibrated thresholds for gesture detection";

    writeFileSync(outputPath, JSON.stringify(exportData, null, 2));

    console.log(colorize(`\n✅ Saved to: ${outputPath}`, "green"));

    const activate = await this.prompt("\nApply as active profile? [Y/n]: ");
    if (activate.toLowerCase() !== "n" && this.ws) {
      this.sendCommand({ type: "LOAD_PROFILE", path: outputPath });
      console.log(colorize("✅ Profile activated!", "green"));
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  private prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, resolve);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async enableRawMode(): Promise<void> {
    if (process.stdin.isTTY && !this.rawModeActive) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      this.rawModeActive = true;
    }
  }

  private async disableRawMode(): Promise<void> {
    if (process.stdin.isTTY && this.rawModeActive) {
      process.stdin.setRawMode(false);
      this.rawModeActive = false;
    }
  }

  /**
   * Clean up resources
   */
  close(): void {
    if (this.rawModeActive) {
      this.disableRawMode();
    }
    this.rl.close();
    if (this.ws) {
      this.ws.close();
    }
  }
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=");
      flags[key] = value || true;
    } else if (arg.startsWith("-")) {
      flags[arg.slice(1)] = true;
    } else {
      positional.push(arg);
    }
  }

  const config: Partial<CalibrationConfig> = {};

  if (flags["quick"] || flags["q"]) {
    config.quickMode = true;
    config.samplesPerStep = 5;
  }

  const cli = new CalibrationCLI(config);

  try {
    if (flags["hot-reload"] || flags["hot"]) {
      const host =
        typeof flags["host"] === "string" ? flags["host"] : "localhost";
      const port =
        typeof flags["port"] === "string" ? parseInt(flags["port"]) : 8765;
      await cli.startHotReload(host, port);
    } else if (flags["test-only"]) {
      const key =
        typeof flags["test-only"] === "string"
          ? (flags["test-only"].toUpperCase() as InputKey)
          : (positional[0]?.toUpperCase() as InputKey);
      if (key) {
        await cli.startHotReload();
      } else {
        console.log("Usage: --test-only <key>");
      }
    } else if (flags["keys"]) {
      const keys = (typeof flags["keys"] === "string" ? flags["keys"] : "")
        .split(",")
        .map((k) => k.trim().toUpperCase())
        .filter((k) => INPUT_KEYS.includes(k as InputKey)) as InputKey[];

      if (config.quickMode) {
        await cli.startQuickMode(keys);
      } else {
        await cli.startWizard(keys);
      }
    } else if (config.quickMode) {
      await cli.startQuickMode();
    } else {
      await cli.startWizard();
    }
  } catch (error: any) {
    console.error(`\n${COLORS.red}Error: ${error.message}${COLORS.reset}`);
    process.exit(1);
  } finally {
    cli.close();
  }
}

// Run if executed directly
if (process.argv[1]?.includes("calibrationCli")) {
  main().catch(console.error);
}

export { CalibrationCLI };
export default CalibrationCLI;
