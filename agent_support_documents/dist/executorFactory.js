// ============================================================================
// EXECUTOR FACTORY - Backend selection for keypress injection
// ============================================================================
import { SequenceExecutor } from './sequenceExecutor.js';
import { InterceptionExecutor, MockInterceptionExecutor } from './interceptionExecutor.js';
import { logger } from './logger.js';
/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
    backend: 'robotjs',
};
/**
 * Wrapper for InterceptionExecutor to match the IExecutor interface
 */
class InterceptionExecutorWrapper {
    executor;
    onEvent;
    activeExecutions = new Map();
    activeCount = 0;
    constructor(executor, onEvent) {
        this.executor = executor;
        this.onEvent = onEvent || (() => { });
    }
    async execute(binding) {
        return this.executeInternal(binding);
    }
    executeDetached(binding) {
        if (this.isBindingExecuting(binding.name)) {
            console.log(`⚠️  "${binding.name}" already executing, skipping...`);
            return;
        }
        this.executeInternal(binding).catch((error) => {
            console.error(`❌ Detached execution error for "${binding.name}":`, error);
        });
    }
    async executeInternal(binding) {
        if (this.activeExecutions.get(binding.name)) {
            console.log(`⚠️  "${binding.name}" already executing, skipping...`);
            return false;
        }
        this.activeExecutions.set(binding.name, true);
        this.activeCount++;
        this.onEvent({
            type: 'started',
            bindingName: binding.name,
            timestamp: Date.now(),
        });
        try {
            const result = await this.executor.executeSequence(binding.sequence);
            this.onEvent({
                type: result ? 'completed' : 'error',
                bindingName: binding.name,
                error: result ? undefined : 'Execution failed',
                timestamp: Date.now(),
            });
            return result;
        }
        finally {
            this.activeExecutions.set(binding.name, false);
            this.activeCount--;
        }
    }
    isBindingExecuting(bindingName) {
        return this.activeExecutions.get(bindingName) || false;
    }
    getActiveExecutionCount() {
        return this.activeCount;
    }
    destroy() {
        this.executor.destroy();
    }
}
/**
 * Factory to create the appropriate executor based on configuration
 */
export class ExecutorFactory {
    /**
     * Create an executor with the specified backend
     */
    static async create(config = {}) {
        const fullConfig = { ...DEFAULT_CONFIG, ...config };
        switch (fullConfig.backend) {
            case 'robotjs':
                logger.debug('Creating RobotJS executor (SendInput API)');
                logger.debug('Detection level: MEDIUM (software injection flag set)');
                return new SequenceExecutor(fullConfig.onEvent);
            case 'interception':
                logger.debug('Creating Interception executor (kernel-level)');
                logger.debug('Detection level: HARD (appears as hardware input)');
                const interception = new InterceptionExecutor(fullConfig.interceptionDllPath);
                const initialized = await interception.initialize();
                if (!initialized) {
                    logger.warn('Interception init failed, falling back to mock');
                    const mock = new MockInterceptionExecutor();
                    await mock.initialize();
                    return new InterceptionExecutorWrapper(mock, fullConfig.onEvent);
                }
                return new InterceptionExecutorWrapper(interception, fullConfig.onEvent);
            case 'mock':
                logger.debug('Creating Mock executor (no keypresses)');
                logger.debug('Use this for testing profile logic');
                const mock = new MockInterceptionExecutor();
                await mock.initialize();
                return new InterceptionExecutorWrapper(mock, fullConfig.onEvent);
            default:
                throw new Error(`Unknown backend: ${fullConfig.backend}`);
        }
    }
    /**
     * Auto-select the best available backend
     * Prefers Interception > RobotJS > Mock
     */
    static async createBest(onEvent) {
        // Try Interception first (best for anti-cheat)
        if (process.platform === 'win32') {
            const available = await InterceptionExecutor.isAvailable();
            if (available) {
                logger.debug('Interception driver detected');
                const executor = await this.create({ backend: 'interception', onEvent });
                return { executor, backend: 'interception' };
            }
        }
        // Fall back to RobotJS
        try {
            const executor = await this.create({ backend: 'robotjs', onEvent });
            return { executor, backend: 'robotjs' };
        }
        catch (error) {
            console.warn('[ExecutorFactory] RobotJS not available:', error);
        }
        // Final fallback to mock
        console.warn('[ExecutorFactory] No real executors available, using mock');
        const executor = await this.create({ backend: 'mock', onEvent });
        return { executor, backend: 'mock' };
    }
    /**
     * Get information about available backends
     */
    static async getAvailableBackends() {
        const backends = [];
        // Check Interception
        if (process.platform === 'win32') {
            const interceptionAvailable = await InterceptionExecutor.isAvailable();
            backends.push({
                backend: 'interception',
                available: interceptionAvailable,
                notes: interceptionAvailable
                    ? 'Kernel-level injection (hardest to detect)'
                    : 'Install driver from github.com/oblitum/Interception',
            });
        }
        else {
            backends.push({
                backend: 'interception',
                available: false,
                notes: 'Windows only',
            });
        }
        // Check RobotJS
        try {
            await import('robotjs');
            backends.push({
                backend: 'robotjs',
                available: true,
                notes: 'SendInput API (medium detection risk)',
            });
        }
        catch {
            backends.push({
                backend: 'robotjs',
                available: false,
                notes: 'Install with: npm install robotjs',
            });
        }
        // Mock is always available
        backends.push({
            backend: 'mock',
            available: true,
            notes: 'Testing only (no keypresses sent)',
        });
        return backends;
    }
}
export default ExecutorFactory;
