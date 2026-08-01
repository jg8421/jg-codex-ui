import type { CodexAppServer } from "./codexAppServer";
export type ThreadBusyStatusSnapshot = {
    codexTask?: unknown;
};
type SubmitTurnWithBusyInterruptionInput = {
    codex: Pick<CodexAppServer, "startTurn" | "interruptTurn">;
    threadId: string;
    text: string;
    turnOpts: Parameters<CodexAppServer["startTurn"]>[2];
    getStatusSnapshot?: () => ThreadBusyStatusSnapshot | null | undefined;
    getActiveTurnIds?: (threadId: string) => string[];
    idlePollIntervalMs?: number;
    idleTimeoutMs?: number;
    sleep?: (ms: number) => Promise<void>;
};
/**
 * 专门表示“线程仍忙，当前 stop+resubmit 无法继续”的业务错误。
 */
export declare class ThreadBusySubmitError extends Error {
    readonly code: "busy_no_active_turns" | "interrupt_failed" | "busy_timeout";
    constructor(code: "busy_no_active_turns" | "interrupt_failed" | "busy_timeout", message: string);
}
/**
 * 从状态快照判断指定线程是否仍有活跃 turn。
 */
export declare function isThreadActiveInStatusSnapshot(input: {
    snapshot: ThreadBusyStatusSnapshot | null | undefined;
    threadId: string;
}): boolean;
/**
 * 当线程正在运行时，先 interrupt 当前活跃 turn，再等待 idle 后启动新 turn。
 */
export declare function submitTurnWithBusyInterruption(input: SubmitTurnWithBusyInterruptionInput): Promise<unknown>;
export {};
