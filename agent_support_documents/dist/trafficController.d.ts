import { CompiledProfile } from "./types.js";
export declare class TrafficController {
    private crossingKey;
    private queue;
    private compiledProfile;
    constructor(compiledProfile: CompiledProfile);
    requestCrossing(key: string): Promise<void>;
    releaseCrossing(key: string): void;
    private shouldWait;
}
export default TrafficController;
