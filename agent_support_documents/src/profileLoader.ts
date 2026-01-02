// ============================================================================
// PROFILE LOADER - Load and validate macro profiles from JSON
// ============================================================================

import fs from "fs";
import path from "path";
import {
  MacroProfile,
  MacroBinding,
  GestureSettings,
  SEQUENCE_CONSTRAINTS,
  INPUT_KEYS,
  GESTURE_TYPES,
  InputKey,
  GestureType,
  CompiledProfile,
  OUTPUT_KEYS,
  OutputKey,
} from "./types.js";
import { compileProfile } from "./profileCompiler.js";

// Default gesture settings
export const DEFAULT_GESTURE_SETTINGS: GestureSettings = {
  multiPressWindow: 350,
  debounceDelay: 10,
  longPressMin: 80,
  longPressMax: 145,
  superLongMin: 146,
  superLongMax: 265,
  // Cancel/nullify threshold: >265ms (set to 266ms to trigger cancel when exceeded)
  cancelThreshold: 266,
};

// Validation errors
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class ProfileLoader {
  private profileDir: string;
  private lastCompiled: CompiledProfile | null = null;

  constructor(profileDir: string = "./profiles") {
    this.profileDir = profileDir;
  }

  /**
   * Validate a macro binding
   */
  private validateBinding(
    binding: MacroBinding,
    index: number
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check trigger key
    if (!INPUT_KEYS.includes(binding.trigger.key as InputKey)) {
      errors.push(
        `Binding ${index} "${binding.name}": Invalid trigger key "${binding.trigger.key}"`
      );
    }

    // Check gesture type
    if (!GESTURE_TYPES.includes(binding.trigger.gesture as GestureType)) {
      errors.push(
        `Binding ${index} "${binding.name}": Invalid gesture "${binding.trigger.gesture}"`
      );
    }

    // Check sequence
    if (!binding.sequence || binding.sequence.length === 0) {
      // Empty sequences are allowed - macro may be a placeholder or disabled
      warnings.push(`Binding ${index} "${binding.name}": Empty sequence`);
    } else {
      // Validate each step
      for (let i = 0; i < binding.sequence.length; i++) {
        const step = binding.sequence[i];

        if (!step.key) {
          errors.push(
            `Binding ${index} "${binding.name}" step ${i}: Missing key`
          );
        }

        // Only validate minDelay/maxDelay if bufferTier is NOT provided
        // (bufferTier takes precedence over legacy delay settings)
        if (!step.bufferTier) {
          if (
            step.minDelay !== undefined &&
            step.minDelay < SEQUENCE_CONSTRAINTS.MIN_DELAY
          ) {
            errors.push(
              `Binding ${index} "${binding.name}" step ${i}: ` +
                `minDelay ${step.minDelay}ms < ${SEQUENCE_CONSTRAINTS.MIN_DELAY}ms minimum`
            );
          }

          if (step.minDelay !== undefined && step.maxDelay !== undefined) {
            const variance = step.maxDelay - step.minDelay;
            if (variance < SEQUENCE_CONSTRAINTS.MIN_VARIANCE) {
              errors.push(
                `Binding ${index} "${binding.name}" step ${i}: ` +
                  `variance ${variance}ms < ${SEQUENCE_CONSTRAINTS.MIN_VARIANCE}ms minimum`
              );
            }
          }
        }

        // Validate dual key fields
        if (step.dualKey !== undefined) {
          // Check if dualKey is in OUTPUT_KEYS
          if (!OUTPUT_KEYS.includes(step.dualKey as OutputKey)) {
            errors.push(
              `Binding ${index} "${binding.name}" step ${i}: ` +
                `Invalid dualKey "${step.dualKey}" - must be a valid OUTPUT_KEY`
            );
          }

          // Check if dualKey equals primary key
          const primaryKeyNormalized = step.key.toUpperCase();
          const dualKeyNormalized = step.dualKey.toUpperCase();
          if (primaryKeyNormalized === dualKeyNormalized) {
            errors.push(
              `Binding ${index} "${binding.name}" step ${i}: ` +
                `dualKey "${step.dualKey}" cannot be the same as primary key "${step.key}"`
            );
          }
        }

        // Validate dualKeyOffsetMs
        if (step.dualKeyOffsetMs !== undefined && step.dualKeyOffsetMs < 1) {
          errors.push(
            `Binding ${index} "${binding.name}" step ${i}: ` +
              `dualKeyOffsetMs must be >= 1ms (got ${step.dualKeyOffsetMs}ms)`
          );
        }

        // Validate dualKeyDownDuration if provided
        if (step.dualKeyDownDuration !== undefined) {
          const [dmin, dmax] = step.dualKeyDownDuration;
          if (dmin <= 0 || dmax < dmin) {
            errors.push(
              `Binding ${index} "${binding.name}" step ${i}: ` +
                `dualKeyDownDuration must be [min,max] with min>0 and max>=min`
            );
          }
        }
      }

      // Count unique keys
      const uniqueKeys = new Set(binding.sequence.map((s) => s.key));
      if (uniqueKeys.size > SEQUENCE_CONSTRAINTS.MAX_UNIQUE_KEYS) {
        errors.push(
          `Binding ${index} "${binding.name}": ` +
            `${uniqueKeys.size} unique keys > ${SEQUENCE_CONSTRAINTS.MAX_UNIQUE_KEYS} maximum`
        );
      }

      // Count repeats per key
      const keyCounts = new Map<string, number>();
      for (const step of binding.sequence) {
        keyCounts.set(step.key, (keyCounts.get(step.key) || 0) + 1);
      }

      for (const [key, count] of keyCounts) {
        if (count > SEQUENCE_CONSTRAINTS.MAX_REPEATS_PER_KEY) {
          errors.push(
            `Binding ${index} "${binding.name}": ` +
              `Key "${key}" repeats ${count}x > ${SEQUENCE_CONSTRAINTS.MAX_REPEATS_PER_KEY} maximum`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a complete profile
   */
  validateProfile(profile: MacroProfile): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!profile.name) {
      errors.push("Profile missing name");
    }

    if (!profile.gestureSettings) {
      warnings.push("Profile missing gestureSettings, using defaults");
    }

    if (!profile.macros || !Array.isArray(profile.macros)) {
      errors.push("Profile missing macros array");
    } else {
      // Validate each binding
      for (let i = 0; i < profile.macros.length; i++) {
        const result = this.validateBinding(profile.macros[i], i);
        errors.push(...result.errors);
        warnings.push(...result.warnings);
      }

      // Check for duplicate triggers
      const triggers = new Set<string>();
      for (const binding of profile.macros) {
        const key = `${binding.trigger.key}:${binding.trigger.gesture}`;
        if (triggers.has(key)) {
          warnings.push(
            `Duplicate trigger: ${binding.trigger.key} + ${binding.trigger.gesture}`
          );
        }
        triggers.add(key);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Load a profile from JSON file
   */
  loadProfile(filename: string): MacroProfile | null {
    const filepath = path.join(this.profileDir, filename);

    try {
      const content = fs.readFileSync(filepath, "utf-8");
      const profile = JSON.parse(content) as MacroProfile;

      // Apply default settings if missing
      if (!profile.gestureSettings) {
        profile.gestureSettings = DEFAULT_GESTURE_SETTINGS;
      }

      // Apply default buffer tier based on ability name (A-K = low, L-Z = medium)
      for (const binding of profile.macros) {
        // Extract first letter of ability name
        const firstLetter = binding.name.charAt(0).toUpperCase();

        // Determine default tier for this ability
        let defaultTier: "low" | "medium" | undefined;
        if (firstLetter >= "A" && firstLetter <= "K") {
          defaultTier = "low";
        } else if (firstLetter >= "L" && firstLetter <= "Z") {
          defaultTier = "medium";
        }

        // Apply default tier to steps that don't have explicit bufferTier
        if (defaultTier) {
          for (const step of binding.sequence) {
            if (step.bufferTier === undefined) {
              step.bufferTier = defaultTier;
            }
          }
        }
      }

      // Validate
      const result = this.validateProfile(profile);

      if (result.warnings.length > 0) {
        console.log(`⚠️  Warnings for "${filename}":`);
        result.warnings.forEach((w) => console.log(`   - ${w}`));
      }

      if (!result.valid) {
        console.error(`❌ Errors in "${filename}":`);
        result.errors.forEach((e) => console.error(`   - ${e}`));
        return null;
      }

      console.log(
        `✅ Loaded profile: "${profile.name}" (${profile.macros.length} macros)`
      );
      // Compile profile once for fast runtime checks
      try {
        const compiled = compileProfile(profile);
        this.lastCompiled = compiled;
        console.log(
          `🔎 Profile compiled: ${compiled.conundrumKeys.size} conundrum keys`
        );
      } catch (err) {
        console.warn(`⚠️  Profile compilation failed: ${err}`);
      }
      return profile;
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error(`❌ Invalid JSON in "${filename}": ${error.message}`);
      } else if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        console.error(`❌ Profile file not found: "${filepath}"`);
      } else {
        console.error(`❌ Error loading "${filename}":`, error);
      }
      return null;
    }
  }

  /**
   * Get the last compiled profile (if any)
   */
  getCompiledProfile(): CompiledProfile | null {
    return this.lastCompiled;
  }

  /**
   * List all available profiles
   */
  listProfiles(): string[] {
    try {
      if (!fs.existsSync(this.profileDir)) {
        fs.mkdirSync(this.profileDir, { recursive: true });
        return [];
      }

      return fs.readdirSync(this.profileDir).filter((f) => f.endsWith(".json"));
    } catch (error) {
      console.error("❌ Error listing profiles:", error);
      return [];
    }
  }

  /**
   * Save a profile to JSON file
   */
  saveProfile(profile: MacroProfile, filename: string): boolean {
    const filepath = path.join(this.profileDir, filename);

    try {
      // Validate first
      const result = this.validateProfile(profile);
      if (!result.valid) {
        console.error(`❌ Cannot save invalid profile:`);
        result.errors.forEach((e) => console.error(`   - ${e}`));
        return false;
      }

      // Ensure directory exists
      if (!fs.existsSync(this.profileDir)) {
        fs.mkdirSync(this.profileDir, { recursive: true });
      }

      // Write file
      fs.writeFileSync(filepath, JSON.stringify(profile, null, 2), "utf-8");
      console.log(`💾 Saved profile to "${filepath}"`);
      return true;
    } catch (error) {
      console.error(`❌ Error saving profile:`, error);
      return false;
    }
  }
}
