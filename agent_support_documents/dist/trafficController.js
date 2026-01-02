import { randomRange, sleep, extractRawKey } from "./utils.js";
export class TrafficController {
    crossingKey = null;
    queue = [];
    compiledProfile;
    constructor(compiledProfile) {
        this.compiledProfile = compiledProfile;
    }
    async requestCrossing(key) {
        const raw = extractRawKey(key);
        const isConundrum = this.compiledProfile.conundrumKeys.has(raw);
        if (!isConundrum) {
            return;
        }
        this.queue.push({ key: raw, timestamp: Date.now() });
        while (this.shouldWait(raw)) {
            await sleep(randomRange(29, 36));
        }
        this.crossingKey = raw;
    }
    releaseCrossing(key) {
        const raw = extractRawKey(key);
        if (this.crossingKey === raw) {
            this.crossingKey = null;
        }
        // Remove any finished items from queue head
        if (this.queue.length > 0 && this.queue[0].key === raw) {
            this.queue.shift();
        }
    }
    shouldWait(key) {
        const raw = key.toUpperCase();
        return this.crossingKey !== null || this.queue[0]?.key !== raw;
    }
}
export default TrafficController;
