// ============================================================================
// SEQUENCE EXECUTOR - Sends keypresses with human-like timing
// ============================================================================
//
// FEATURES:
// - Multiple concurrent sequences (different bindings run in parallel)
// - Per-binding execution tracking (same binding won't overlap)
// - Human-like timing with configurable randomization
// - Non-blocking async execution
//
// ============================================================================

import robot from 'robotjs';
import { SequenceStep, MacroBinding, SEQUENCE_CONSTRAINTS } from './types.js';

export interface ExecutionEvent {
  type: 'started' | 'step' | 'completed' | 'error' | 'cancelled';
  bindingName: string;
  step?: SequenceStep;
  stepIndex?: number;
  delay?: number;
  error?: string;
  timestamp: number;
}

export type ExecutionCallback = (event: ExecutionEvent) => void;

export class SequenceExecutor {
  // Per-binding execution state - allows DIFFERENT bindings to run concurrently
  // but prevents the SAME binding from overlapping with itself
  private isExecuting: Map<string, boolean> = new Map();
  
  // Track all active executions for monitoring
  private activeExecutions: Set<string> = new Set();
  
  private callback: ExecutionCallback;

  constructor(callback?: ExecutionCallback) {
    this.callback = callback || (() => {});
    
    // Configure robotjs for minimal internal delay
    robot.setKeyboardDelay(1);
    
    console.log('🎮 SequenceExecutor initialized');
    console.log('   Concurrent sequences: ENABLED (different bindings run in parallel)');
    console.log('   Per-binding overlap: PREVENTED (same binding won\'t stack)');
  }

  /**
   * Validate a sequence step meets timing constraints
   */
  private validateStep(step: SequenceStep, stepIndex: number): string | null {
    if (step.minDelay < SEQUENCE_CONSTRAINTS.MIN_DELAY) {
      return `Step ${stepIndex} ("${step.key}"): minDelay must be >= ${SEQUENCE_CONSTRAINTS.MIN_DELAY}ms (got ${step.minDelay}ms)`;
    }

    const variance = step.maxDelay - step.minDelay;
    if (variance < SEQUENCE_CONSTRAINTS.MIN_VARIANCE) {
      return `Step ${stepIndex} ("${step.key}"): variance (max - min) must be >= ${SEQUENCE_CONSTRAINTS.MIN_VARIANCE}ms (got ${variance}ms)`;
    }

    return null;
  }

  /**
   * Validate entire sequence meets constraints
   */
  private validateSequence(sequence: SequenceStep[]): string | null {
    for (let i = 0; i < sequence.length; i++) {
      const step = sequence[i];
      const error = this.validateStep(step, i);
      if (error) return error;
      
      const echoHits = step.echoHits || 1;
      if (echoHits < 1 || echoHits > SEQUENCE_CONSTRAINTS.MAX_ECHO_HITS) {
        return `Step ${i} ("${step.key}"): echoHits must be 1-${SEQUENCE_CONSTRAINTS.MAX_ECHO_HITS} (got ${echoHits})`;
      }
    }

    const keyStepCount: Map<string, number> = new Map();
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
  private getRandomDelay(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Send a single keypress
   */
  private pressKey(key: string): void {
    const keyMap: Record<string, string> = {
      'f1': 'f1', 'f2': 'f2', 'f3': 'f3', 'f4': 'f4',
      'f5': 'f5', 'f6': 'f6', 'f7': 'f7', 'f8': 'f8',
      'f9': 'f9', 'f10': 'f10', 'f11': 'f11', 'f12': 'f12',
      'space': 'space', 'enter': 'enter', 'tab': 'tab',
      'escape': 'escape', 'backspace': 'backspace',
      'up': 'up', 'down': 'down', 'left': 'left', 'right': 'right',
    };

    const mappedKey = keyMap[key.toLowerCase()] || key.toLowerCase();
    robot.keyTap(mappedKey);
  }

  /**
   * Check if a binding is currently executing
   */
  isBindingExecuting(bindingName: string): boolean {
    return this.isExecuting.get(bindingName) || false;
  }

  /**
   * Get count of currently active executions
   */
  getActiveExecutionCount(): number {
    return this.activeExecutions.size;
  }

  /**
   * Get names of all currently executing bindings
   */
  getActiveBindings(): string[] {
    return Array.from(this.activeExecutions);
  }

  /**
   * Cancel execution for a specific binding
   */
  cancel(bindingName: string): void {
    if (this.isExecuting.get(bindingName)) {
      this.isExecuting.set(bindingName, false);
      this.callback({
        type: 'cancelled',
        bindingName,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Cancel all executions
   */
  cancelAll(): void {
    for (const name of this.activeExecutions) {
      this.cancel(name);
    }
  }

  /**
   * Execute a macro binding's sequence (fire-and-forget)
   * This method launches the execution as a detached promise, allowing
   * multiple different bindings to run simultaneously.
   */
  executeDetached(binding: MacroBinding): void {
    // Check if this specific binding is already executing
    if (this.isExecuting.get(binding.name)) {
      console.log(`⚠️  "${binding.name}" already executing, skipping...`);
      return;
    }

    // Launch as detached promise (don't await - allows concurrency)
    this.executeInternal(binding).catch((error) => {
      console.error(`❌ Detached execution error for "${binding.name}":`, error);
    });
  }

  /**
   * Execute a macro binding's sequence (awaitable)
   * Use this when you need to wait for completion.
   */
  async execute(binding: MacroBinding): Promise<boolean> {
    return this.executeInternal(binding);
  }

  /**
   * Internal execution logic
   */
  private async executeInternal(binding: MacroBinding): Promise<boolean> {
    const { name, sequence } = binding;

    // Check if already executing (per-binding lock)
    if (this.isExecuting.get(name)) {
      console.log(`⚠️  "${name}" already executing, skipping...`);
      return false;
    }

    // Validate sequence
    const validationError = this.validateSequence(sequence);
    if (validationError) {
      this.callback({
        type: 'error',
        bindingName: name,
        error: validationError,
        timestamp: Date.now(),
      });
      console.error(`❌ Validation failed: ${validationError}`);
      return false;
    }

    // Mark as executing
    this.isExecuting.set(name, true);
    this.activeExecutions.add(name);

    this.callback({
      type: 'started',
      bindingName: name,
      timestamp: Date.now(),
    });

    const activeCount = this.activeExecutions.size;
    console.log(`\n🎮 Executing: "${name}" (${sequence.length} steps) [${activeCount} active]`);

    try {
      for (let i = 0; i < sequence.length; i++) {
        // Check if cancelled
        if (!this.isExecuting.get(name)) {
          console.log(`⏹️  "${name}" cancelled`);
          return false;
        }

        const step = sequence[i];
        const echoHits = step.echoHits || 1;

        // Execute each echo hit for this step
        for (let hit = 0; hit < echoHits; hit++) {
          // Check if cancelled between hits
          if (!this.isExecuting.get(name)) {
            console.log(`⏹️  "${name}" cancelled`);
            return false;
          }

          // Press the key
          this.pressKey(step.key);

          this.callback({
            type: 'step',
            bindingName: name,
            step,
            stepIndex: i,
            timestamp: Date.now(),
          });

          console.log(`  ✓ [${i + 1}/${sequence.length}] Pressed "${step.key}" (hit ${hit + 1}/${echoHits})`);

          // Delay between hits and steps (except after last hit of last step)
          const isLastHit = hit === echoHits - 1;
          const isLastStep = i === sequence.length - 1;

          if (!isLastStep || !isLastHit) {
            const delay = this.getRandomDelay(step.minDelay, step.maxDelay);

            this.callback({
              type: 'step',
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
        type: 'completed',
        bindingName: name,
        timestamp: Date.now(),
      });

      console.log(`✅ "${name}" complete\n`);
      return true;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      this.callback({
        type: 'error',
        bindingName: name,
        error: errorMsg,
        timestamp: Date.now(),
      });

      console.error(`❌ "${name}" failed: ${errorMsg}`);
      return false;

    } finally {
      this.isExecuting.set(name, false);
      this.activeExecutions.delete(name);
    }
  }

  /**
   * Test execution without actually sending keys (dry run)
   */
  async dryRun(binding: MacroBinding): Promise<void> {
    const { name, sequence } = binding;

    const validationError = this.validateSequence(sequence);
    if (validationError) {
      console.error(`❌ Validation failed: ${validationError}`);
      return;
    }

    console.log(`\n🧪 DRY RUN: "${name}" (${sequence.length} steps)`);

    const keyCount: Map<string, number> = new Map();
    let totalPresses = 0;
    for (const step of sequence) {
      const echoHits = step.echoHits || 1;
      keyCount.set(step.key, (keyCount.get(step.key) || 0) + echoHits);
      totalPresses += echoHits;
    }

    console.log(`   Unique keys: ${keyCount.size}/${SEQUENCE_CONSTRAINTS.MAX_UNIQUE_KEYS}`);
    console.log(`   Total key presses: ${totalPresses}`);
    for (const [key, count] of keyCount) {
      console.log(`   - "${key}": ${count}x`);
    }

    let totalMinTime = 0;
    let totalMaxTime = 0;

    for (let i = 0; i < sequence.length; i++) {
      const step = sequence[i];
      const echoHits = step.echoHits || 1;
      console.log(`   [${i + 1}] "${step.key}" x${echoHits} → wait ${step.minDelay}-${step.maxDelay}ms`);
      
      const pressesInStep = echoHits;
      const isLastStep = i === sequence.length - 1;
      const delayCount = isLastStep ? pressesInStep - 1 : pressesInStep;
      
      totalMinTime += step.minDelay * delayCount;
      totalMaxTime += step.maxDelay * delayCount;
    }

    console.log(`   ⏱️  Total time: ${totalMinTime}-${totalMaxTime}ms\n`);
  }
}
