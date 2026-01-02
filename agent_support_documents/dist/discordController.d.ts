/**
 * Volume levels as percentages
 */
export type VolumeLevel = "low" | "medium" | "high" | "mute";
/**
 * Discord Controller for Windows
 * Controls Discord volume and microphone via OS-level commands
 */
export declare class DiscordController {
    private lastVolumeLevel;
    private micMuted;
    constructor();
    /**
     * Set Discord's output volume using PowerShell audio session control
     * @param level Volume level (low/medium/high/mute)
     */
    setVolume(level: VolumeLevel): Promise<boolean>;
    /**
     * Set volume using nircmd (if available)
     */
    private setVolumeWithNircmd;
    /**
     * Set system-wide volume as fallback
     */
    private setSystemVolume;
    /**
     * Toggle microphone mute state
     * @param mute True to mute, false to unmute
     */
    setMicMute(mute: boolean): Promise<boolean>;
    /**
     * Toggle microphone state
     */
    toggleMic(): Promise<boolean>;
    /**
     * Convenience method: Set volume to low and unmute mic
     */
    setLowVolumeWithMic(): Promise<boolean>;
    /**
     * Convenience method: Set volume to medium and unmute mic
     */
    setMediumVolumeWithMic(): Promise<boolean>;
    /**
     * Convenience method: Set volume to high and mute mic
     */
    setHighVolumeNoMic(): Promise<boolean>;
    /**
     * Press Discord hotkey for mic toggle
     * Requires Discord keybind configured (default: CTRL+SHIFT+M)
     * @param hotkey The Discord keybind for mic toggle (e.g., "CTRL+SHIFT+M")
     */
    pressDiscordMicToggle(hotkey?: string): Promise<boolean>;
    /**
     * Press Discord hotkey for deafen toggle
     * Requires Discord keybind configured (default: CTRL+SHIFT+D)
     * @param hotkey The Discord keybind for deafen (e.g., "CTRL+SHIFT+D")
     */
    pressDiscordDeafenToggle(hotkey?: string): Promise<boolean>;
    /**
     * Get current volume level
     */
    getVolumeLevel(): VolumeLevel;
    /**
     * Get mic mute state
     */
    isMicMuted(): boolean;
}
export declare function getDiscordController(): DiscordController;
