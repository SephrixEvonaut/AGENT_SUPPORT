type LogLevel = "debug" | "info" | "warn" | "error";
declare class Logger {
    private currentLevel;
    constructor();
    private shouldLog;
    debug(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    setLevel(level: LogLevel): void;
    getLevel(): LogLevel;
}
export declare const logger: Logger;
export {};
