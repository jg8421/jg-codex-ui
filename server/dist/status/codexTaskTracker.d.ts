export type CodexNotification = {
    method: string;
    params: unknown;
};
export type CodexTaskSnapshot = {
    busy: boolean;
    activeTurnCount: number;
    activeThreads: string[];
    activeByThread: Record<string, number>;
    activeSinceMsByThread: Record<string, number>;
    lastEventAtMs: number | null;
};
export type CodexThreadRunningStateChange = {
    threadId: string;
    isRunning: boolean;
    changedAtMs: number;
};
export declare class CodexTaskTracker {
    /**
     * 线程运行态边沿回调：用于把运行中/完成状态同步到外部存储。
     */
    private readonly onThreadRunningStateChange;
    /**
     * 每个线程当前活跃的 turn 集合：用于判断线程是否仍处于运行中。
     */
    private readonly activeByThread;
    /**
     * 每个线程本轮进入运行态的后端起点时间。
     */
    private readonly activeSinceMsByThread;
    /**
     * 最近一次收到 Codex 通知的时间。
     */
    private lastEventAtMs;
    constructor(options?: {
        onThreadRunningStateChange?: ((change: CodexThreadRunningStateChange) => void) | null;
    });
    onNotification(n: CodexNotification): void;
    getSnapshot(): CodexTaskSnapshot;
    getActiveTurnIds(threadId: string): string[];
    reset(): void;
    private markActive;
    private markComplete;
}
