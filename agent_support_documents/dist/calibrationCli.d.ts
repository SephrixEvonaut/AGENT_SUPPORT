import { CalibrationConfig } from "./calibrationTypes.js";
export declare class CalibrationCLI {
    private rl;
    private manager;
    private config;
    private inputListener;
    private keyDownTimes;
    private lastKeyUpTime;
    private multiTapGaps;
    private stepData;
    private currentStep;
    private currentKey;
    private samplesCollected;
    private samplesNeeded;
    private resolveWaitForSamples;
    constructor(config?: Partial<CalibrationConfig>);
    private startInputListener;
    private stopInputListener;
    private handleKeyEvent;
    private processKeyRelease;
    private validateSample;
    run(): Promise<void>;
    private selectKeys;
    private calibrateKey;
    private runCalibrationStep;
    private waitForSamples;
    private recordStepData;
    private showResults;
    private exportProfile;
    private question;
    private sleep;
    private cleanup;
}
//# sourceMappingURL=calibrationCli.d.ts.map