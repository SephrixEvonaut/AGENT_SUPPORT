// ============================================================================
// SEQUENCE EXECUTOR - Sends keypresses with human-like timing
// ============================================================================
//
// FEATURES:
// - Multiple concurrent sequences (different bindings run in parallel)
// - Per-binding execution tracking (same binding won't overlap)
// - Human-like timing with configurable randomization
// - Non-blocking async execution
// - Discord volume/mic control integration
// - TTS timer system
//
// ============================================================================
import robot from "robotjs";
import { SEQUENCE_CONSTRAINTS, } from "./types.js";
import { isConundrumKey } from "./profileCompiler.js";
import { TrafficController } from "./trafficController.js";
import { TimerManager } from "./timerManager.js";
import { getDiscordController } from "./discordController.js";
import { logger } from "./logger.js";
export class SequenceExecutor {
    // Per-binding execution state - allows DIFFERENT bindings to run concurrently
    // but prevents the SAME binding from overlapping with itself
    isExecuting = new Map();
    // Track all active executions for monitoring
    activeExecutions = new Set();
    callback;
    compiledProfile = null;
    trafficController = null;
    timerManager;
    constructor(callback, compiledProfile) {
        this.callback = callback || (() => { });
        if (compiledProfile)
            this.setCompiledProfile(compiledProfile);
        this.timerManager = new TimerManager();
        // Configure robotjs for minimal internal delay
        robot.setKeyboardDelay(1);
        logger.debug("SequenceExecutor initialized");
        logger.debug("Concurrent sequences: ENABLED (different bindings run in parallel)");
        logger.debug("Per-binding overlap: PREVENTED (same binding won't stack)");
    }
    /**
     * Provide a compiled profile to enable traffic control.
     */
    setCompiledProfile(compiled) {
        this.compiledProfile = compiled;
        this.trafficController = new TrafficController(compiled);
    }
    /**
     * Validate a sequence step meets timing constraints
     */
    validateStep(step, stepIndex) {
        // If bufferTier is provided, we use tiered buffer delays and skip legacy min/max validation
        if (step.bufferTier) {
            if (!["low", "medium", "high"].includes(step.bufferTier)) {
                return `Step ${stepIndex} ("${step.key}"): bufferTier must be one of low|medium|high`;
            }
        }
        else {
            if (step.minDelay < SEQUENCE_CONSTRAINTS.MIN_DELAY) {
                return `Step ${stepIndex} ("${step.key}"): minDelay must be >= ${SEQUENCE_CONSTRAINTS.MIN_DELAY}ms (got ${step.minDelay}ms)`;
            }
            const variance = step.maxDelay - step.minDelay;
            if (variance < SEQUENCE_CONSTRAINTS.MIN_VARIANCE) {
                return `Step ${stepIndex} ("${step.key}"): variance (max - min) must be >= ${SEQUENCE_CONSTRAINTS.MIN_VARIANCE}ms (got ${variance}ms)`;
            }
        }
        // Validate keyDownDuration if provided
        if (step.keyDownDuration) {
            const [kmin, kmax] = step.keyDownDuration;
            if (kmin <= 0 || kmax < kmin) {
                return `Step ${stepIndex} ("${step.key}"): keyDownDuration must be [min,max] with min>0 and max>=min`;
            }
        }
        return null;
    }
    /**
     * Validate entire sequence meets constraints
     */
    validateSequence(sequence) {
        for (let i = 0; i < sequence.length; i++) {
            const step = sequence[i];
            const error = this.validateStep(step, i);
            if (error)
                return error;
            const echoHits = step.echoHits || 1;
            if (echoHits < 1 || echoHits > SEQUENCE_CONSTRAINTS.MAX_ECHO_HITS) {
                return `Step ${i} ("${step.key}"): echoHits must be 1-${SEQUENCE_CONSTRAINTS.MAX_ECHO_HITS} (got ${echoHits})`;
            }
        }
        const keyStepCount = new Map();
        for (const step of sequence) {
            const normalizedKey = step.key.toLowerCase();
            const count = keyStepCount.get(normalizedKey) || 0;
            keyStepCount.set(normalizedKey, count + 1);
        }
        if (keyStepCount.size > SEQUENCE_CONSTRAINTS.MAX_UNIQUE_KEYS) {
            return `Sequence has ${keyStepCount.size} unique keys, maximum is ${SEQUENCE_CONSTRAINTS.MAX_UNIQUE_KEYS}`;
        }
        for (const [key, count] of keyStepCount) {
            if (count > SEQUENCE_CONSTRAINTS.MAX_STEPS_PER_KEY) {
                return `Key "${key}" used in ${count} steps, maximum is ${SEQUENCE_CONSTRAINTS.MAX_STEPS_PER_KEY} steps per key`;
            }
        }
        return null;
    }
    /**
     * Get randomized delay between min and max (inclusive)
     */
    getRandomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    /**
     * Parse a step key which may include modifiers like "SHIFT+Q" or "ALT+NUMPAD7"
     */
    parseKey(key) {
        const parts = key.split("+").map((p) => p.trim());
        const modifiers = [];
        let base = parts[parts.length - 1];
        // Collect modifiers (all parts except last)
        for (let i = 0; i < parts.length - 1; i++) {
            const m = parts[i].toUpperCase();
            if (m === "SHIFT")
                modifiers.push("shift");
            else if (m === "ALT")
                modifiers.push("alt");
            else if (m === "CTRL" || m === "CONTROL")
                modifiers.push("control");
            else
                modifiers.push(m.toLowerCase());
        }
        // Normalize base key
        base = base.toUpperCase();
        // Map common patterns (NUMPADx -> numpadx, F6 -> f6)
        if (base.startsWith("NUMPAD")) {
            base = base.replace("NUMPAD", "numpad").toLowerCase();
        }
        else {
            base = base.toLowerCase();
        }
        return { key: base, modifiers };
    }
    /**
     * Buffer tier ranges (inclusive)
     */
    bufferRanges = {
        low: [11, 17],
        medium: [15, 24],
        high: [980, 1270],
    };
    /**
     * Sleep for specified milliseconds
     */
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    /**
     * Send a single keypress
     */
    pressKey(key) {
        // Keep for backward compatibility but prefer explicit key+modifier flow
        const { key: parsedKey, modifiers } = this.parseKey(key);
        robot.keyTap(parsedKey, modifiers.length === 0 ? undefined : modifiers);
    }
    /**
     * Check if a binding is currently executing
     */
    isBindingExecuting(bindingName) {
        return this.isExecuting.get(bindingName) || false;
    }
    /**
     * Get count of currently active executions
     */
    getActiveExecutionCount() {
        return this.activeExecutions.size;
    }
    /**
     * Get names of all currently executing bindings
     */
    getActiveBindings() {
        return Array.from(this.activeExecutions);
    }
    /**
     * Cancel execution for a specific binding
     */
    cancel(bindingName) {
        if (this.isExecuting.get(bindingName)) {
            this.isExecuting.set(bindingName, false);
            this.callback({
                type: "cancelled",
                bindingName,
                timestamp: Date.now(),
            });
        }
    }
    /**
     * Cancel all executions
     */
    cancelAll() {
        for (const name of this.activeExecutions) {
            this.cancel(name);
        }
    }
    /**
     * Execute a macro binding's sequence (fire-and-forget)
     * This method launches the execution as a detached promise, allowing
     * multiple different bindings to run simultaneously.
     */
    executeDetached(binding) {
        // Check if this specific binding is already executing
        if (this.isExecuting.get(binding.name)) {
            logger.warn(`"${binding.name}" already executing, skipping...`);
            return;
        }
        // Launch as detached promise (don't await - allows concurrency)
        this.executeInternal(binding).catch((error) => {
            logger.error(`Detached execution error for "${binding.name}":`, error);
        });
    }
    /**
     * Execute a macro binding's sequence (awaitable)
     * Use this when you need to wait for completion.
     */
    async execute(binding) {
        return this.executeInternal(binding);
    }
    /**
     * Internal execution logic
     */
    async executeInternal(binding) {
        const { name, sequence } = binding;
        // Check if already executing (per-binding lock)
        if (this.isExecuting.get(name)) {
            logger.warn(`"${name}" already executing, skipping...`);
            return false;
        }
        // Validate sequence
        const validationError = this.validateSequence(sequence);
        if (validationError) {
            this.callback({
                type: "error",
                bindingName: name,
                error: validationError,
                timestamp: Date.now(),
            });
            logger.error(`Validation failed: ${validationError}`);
            return false;
        }
        // Mark as executing
        this.isExecuting.set(name, true);
        this.activeExecutions.add(name);
        this.callback({
            type: "started",
            bindingName: name,
            timestamp: Date.now(),
        });
        const activeCount = this.activeExecutions.size;
        logger.debug(`Executing: "${name}" (${sequence.length} steps) [${activeCount} active]`);
        try {
            for (let i = 0; i < sequence.length; i++) {
                // Check if cancelled
                if (!this.isExecuting.get(name)) {
                    logger.info(`"${name}" cancelled`);
                    return false;
                }
                const step = sequence[i];
                const echoHits = step.echoHits || 1;
                // Execute each echo hit for this step
                for (let hit = 0; hit < echoHits; hit++) {
                    // Check if cancelled between hits
                    if (!this.isExecuting.get(name)) {
                        logger.info(`"${name}" cancelled`);
                        return false;
                    }
                    // Press the key (support modifiers, hold duration, and dual keys)
                    const { key: parsedKey, modifiers } = this.parseKey(step.key);
                    // DISCORD CONTROL DETECTION: Check if this is a Discord control step
                    if (parsedKey === "end" && step.name?.includes("Discord")) {
                        const discordController = getDiscordController();
                        let handled = false;
                        let skipKeyPress = false;
                        // Volume control (OS-level)
                        if (step.name.includes("Volume: Low")) {
                            logger.info("Discord: Setting LOW volume (OS)");
                            await discordController.setVolume("low");
                            skipKeyPress = true;
                            handled = true;
                        }
                        else if (step.name.includes("Volume: Medium")) {
                            logger.info("Discord: Setting MEDIUM volume (OS)");
                            await discordController.setVolume("medium");
                            skipKeyPress = true;
                            handled = true;
                        }
                        else if (step.name.includes("Volume: High")) {
                            logger.info("Discord: Setting HIGH volume (OS)");
                            await discordController.setVolume("high");
                            skipKeyPress = true;
                            handled = true;
                        }
                        // Mic toggle (Discord hotkey)
                        else if (step.name.includes("Mic Toggle")) {
                            logger.info("Discord: Mic toggle via hotkey (CTRL+SHIFT+M)");
                            await discordController.pressDiscordMicToggle();
                            // Will press the actual key below
                            handled = true;
                        }
                        // Deafen toggle (Discord hotkey)
                        else if (step.name.includes("Deafen")) {
                            logger.info("Discord: Deafen toggle via hotkey (CTRL+SHIFT+D)");
                            await discordController.pressDiscordDeafenToggle();
                            // Will press the actual key below
                            handled = true;
                        }
                        if (handled) {
                            // Emit step event for monitoring
                            this.callback({
                                type: "step",
                                bindingName: name,
                                step,
                                stepIndex: i,
                                timestamp: Date.now(),
                            });
                            // Skip key execution for OS-level volume control only
                            if (skipKeyPress) {
                                // Skip key execution - Discord OS action executed instead
                                continue;
                            }
                            // For hotkey-based commands, continue to execute the actual keypress below
                        }
                    }
                    // TIMER DETECTION: Check if this is a timer step
                    if (parsedKey === "end" && step.name?.includes("Timer placeholder")) {
                        // Parse timer duration and message from step.name
                        // Format: "Timer placeholder - implement TTS: 'message' after N seconds"
                        const durationMatch = step.name.match(/(\d+)\s*seconds?/);
                        const messageMatch = step.name.match(/[''](.*?)['']/);
                        if (durationMatch && messageMatch) {
                            const duration = parseInt(durationMatch[1], 10);
                            const message = messageMatch[1];
                            // Generate timer ID from binding name or use message as fallback
                            const timerId = message.toLowerCase().replace(/\s+/g, "_");
                            logger.debug(`Timer detected: ${timerId} (${duration}s) → "${message}"`);
                            // Start timer instead of pressing END key
                            this.timerManager.startTimer(timerId, duration, message);
                            // Emit step event for monitoring
                            this.callback({
                                type: "step",
                                bindingName: name,
                                step,
                                stepIndex: i,
                                timestamp: Date.now(),
                            });
                            // Skip key execution - timer started instead
                            continue;
                        }
                        else {
                            logger.warn(`Timer step detected but couldn't parse: "${step.name}"`);
                            // Fall through to normal key execution
                        }
                    }
                    // Traffic control for conundrum keys: wait if necessary
                    if (this.compiledProfile && this.trafficController) {
                        const needsTraffic = isConundrumKey(step.key, this.compiledProfile);
                        if (needsTraffic) {
                            await this.trafficController.requestCrossing(step.key);
                        }
                    }
                    // Determine key down duration (default [15,27])
                    const kd = step.keyDownDuration || [15, 27];
                    const keyDownMs = this.getRandomDelay(kd[0], kd[1]);
                    // Check for dual key configuration
                    const hasDualKey = step.dualKey !== undefined;
                    let dualParsedKey = null;
                    let dualKeyDownMs = 0;
                    if (hasDualKey) {
                        // Parse dual key
                        dualParsedKey = this.parseKey(step.dualKey);
                        // Determine dual key hold duration (defaults to primary key duration)
                        const dualKd = step.dualKeyDownDuration || kd;
                        dualKeyDownMs = this.getRandomDelay(dualKd[0], dualKd[1]);
                    }
                    // PRIMARY KEY DOWN
                    try {
                        robot.keyToggle(parsedKey, "down", modifiers.length === 0 ? undefined : modifiers);
                    }
                    catch (err) {
                        // Fallback to keyTap if keyToggle unsupported for this key
                        this.pressKey(step.key);
                    }
                    this.callback({
                        type: "step",
                        bindingName: name,
                        step,
                        stepIndex: i,
                        timestamp: Date.now(),
                    });
                    if (hasDualKey) {
                        // DUAL KEY MODE: Press second key after offset
                        const offsetMs = step.dualKeyOffsetMs ?? 6; // Default 6ms offset
                        logger.debug(`[${i + 1}/${sequence.length}] Pressed "${step.key}" + "${step.dualKey}" (dual, hit ${hit + 1}/${echoHits}) primary=${keyDownMs}ms, dual=${dualKeyDownMs}ms, offset=${offsetMs}ms`);
                        // Wait for offset before pressing dual key
                        await this.sleep(offsetMs);
                        // DUAL KEY DOWN
                        try {
                            robot.keyToggle(dualParsedKey.key, "down", dualParsedKey.modifiers.length === 0
                                ? undefined
                                : dualParsedKey.modifiers);
                        }
                        catch (err) {
                            // Fallback to keyTap if keyToggle unsupported
                            this.pressKey(step.dualKey);
                        }
                        // Hold primary key for remaining duration (already held for offsetMs)
                        const primaryRemainingMs = Math.max(0, keyDownMs - offsetMs);
                        await this.sleep(primaryRemainingMs);
                        // PRIMARY KEY UP (releases first)
                        try {
                            robot.keyToggle(parsedKey, "up", modifiers.length === 0 ? undefined : modifiers);
                        }
                        catch (err) {
                            // If keyToggle failed, nothing else to do
                        }
                        // Hold dual key for its full duration (or remaining if longer than primary)
                        const dualRemainingMs = Math.max(0, dualKeyDownMs - (offsetMs + primaryRemainingMs));
                        if (dualRemainingMs > 0) {
                            await this.sleep(dualRemainingMs);
                        }
                        // DUAL KEY UP (releases second)
                        try {
                            robot.keyToggle(dualParsedKey.key, "up", dualParsedKey.modifiers.length === 0
                                ? undefined
                                : dualParsedKey.modifiers);
                        }
                        catch (err) {
                            // If keyToggle failed, nothing else to do
                        }
                    }
                    else {
                        // SINGLE KEY MODE: Normal behavior
                        logger.debug(`[${i + 1}/${sequence.length}] Pressed "${step.key}" (hit ${hit + 1}/${echoHits}) held ${keyDownMs}ms`);
                        // Hold duration
                        await this.sleep(keyDownMs);
                        // PRIMARY KEY UP
                        try {
                            robot.keyToggle(parsedKey, "up", modifiers.length === 0 ? undefined : modifiers);
                        }
                        catch (err) {
                            // If keyToggle failed, nothing else to do
                        }
                    }
                    // Release traffic control if it was acquired
                    if (this.compiledProfile && this.trafficController) {
                        const needsTraffic = isConundrumKey(step.key, this.compiledProfile);
                        if (needsTraffic) {
                            this.trafficController.releaseCrossing(step.key);
                        }
                    }
                    // Determine buffer delay after this key press
                    const isLastHit = hit === echoHits - 1;
                    const isLastStep = i === sequence.length - 1;
                    if (!isLastStep || !isLastHit) {
                        let delay;
                        if (step.bufferTier) {
                            const range = this.bufferRanges[step.bufferTier];
                            delay = this.getRandomDelay(range[0], range[1]);
                        }
                        else {
                            // Fall back to legacy minDelay/maxDelay if bufferTier not provided
                            delay = this.getRandomDelay(step.minDelay, step.maxDelay);
                        }
                        this.callback({
                            type: "step",
                            bindingName: name,
                            step,
                            stepIndex: i,
                            delay,
                            timestamp: Date.now(),
                        });
                        console.log(`     ⏱️  Waiting ${delay}ms...`);
                        await this.sleep(delay);
                    }
                }
            }
            this.callback({
                type: "completed",
                bindingName: name,
                timestamp: Date.now(),
            });
            logger.info(`"${name}" complete`);
            return true;
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            this.callback({
                type: "error",
                bindingName: name,
                error: errorMsg,
                timestamp: Date.now(),
            });
            logger.error(`"${name}" failed: ${errorMsg}`);
            return false;
        }
        finally {
            this.isExecuting.set(name, false);
            this.activeExecutions.delete(name);
        }
    }
    /**
     * Test execution without actually sending keys (dry run)
     */
    async dryRun(binding) {
        const { name, sequence } = binding;
        const validationError = this.validateSequence(sequence);
        if (validationError) {
            console.error(`❌ Validation failed: ${validationError}`);
            return;
        }
        console.log(`\n🧪 DRY RUN: "${name}" (${sequence.length} steps)`);
        const keyCount = new Map();
        let totalPresses = 0;
        for (const step of sequence) {
            const echoHits = step.echoHits || 1;
            keyCount.set(step.key, (keyCount.get(step.key) || 0) + echoHits);
            totalPresses += echoHits;
        }
        logger.info(`Unique keys: ${keyCount.size}/${SEQUENCE_CONSTRAINTS.MAX_UNIQUE_KEYS}`);
        logger.info(`Total key presses: ${totalPresses}`);
        for (const [key, count] of keyCount) {
            logger.info(`- "${key}": ${count}x`);
        }
        let totalMinTime = 0;
        let totalMaxTime = 0;
        for (let i = 0; i < sequence.length; i++) {
            const step = sequence[i];
            const echoHits = step.echoHits || 1;
            logger.info(`[${i + 1}] "${step.key}" x${echoHits} → wait ${step.minDelay}-${step.maxDelay}ms`);
            const pressesInStep = echoHits;
            const isLastStep = i === sequence.length - 1;
            const delayCount = isLastStep ? pressesInStep - 1 : pressesInStep;
            totalMinTime += step.minDelay * delayCount;
            totalMaxTime += step.maxDelay * delayCount;
        }
        console.log(`   ⏱️  Total time: ${totalMinTime}-${totalMaxTime}ms\n`);
    }
    /**
     * Shutdown executor and clean up resources
     */
    shutdown() {
        logger.info("Shutting down SequenceExecutor...");
        this.cancelAll();
        this.timerManager.shutdown();
    }
}
