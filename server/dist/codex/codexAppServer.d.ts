import type { CodexHistoryPersistence } from "./cliArgs";
import type { JsonRpcId, ServerRequest } from "./jsonrpc";
type ThreadSummary = {
    id: string;
    preview: string;
    createdAt: number;
    updatedAt: number;
    cwd: string;
    modelProvider: string;
};
export type CodexAppServerNotification = {
    method: string;
    params: unknown;
};
export type CodexAppServerStatus = {
    pid: number | null;
    running: boolean;
    ready: boolean;
    readyState: "starting" | "ready" | "error";
    readyError?: string;
    lastExit?: {
        code: number | null;
        signal: NodeJS.Signals | null;
    };
    lastStderrLine?: string;
    lastStderrAtMs?: number;
};
export declare class CodexAppServer {
    private readonly proc;
    private readonly rpc;
    private readonly ready;
    private readyState;
    private readyError;
    private lastExit;
    private lastStderrLine;
    private lastStderrAtMs;
    /**
     * `thread/start` 结果缓存：
     *
     * 背景：
     * - 某些 codex 版本/模式下，`thread/start` 返回的 threadId 可能在短时间内无法被 `thread/resume` / `thread/read` 找到；
     * - 但前端需要立刻用该 threadId 走 `open_thread(threadId)` 来对齐 UI/WS 状态。
     *
     * 策略：
     * - 将 start 返回的 thread 对象按 threadId 做短 TTL 缓存；
     * - 当 resume/read 报 “thread not found” 时回退到该缓存，避免新建线程立刻不可用。
     */
    private readonly startedThreadCacheById;
    private readonly startedThreadCacheTtlMs;
    private readonly startedThreadCacheMax;
    /**
     * `thread/read` 方法支持情况缓存：
     * - unknown：未探测
     * - supported：支持 `thread/read`
     * - unsupported：不支持 `thread/read`（Windows/旧版本）
     */
    private threadReadSupport;
    constructor(opts: {
        codexBin: string;
        cwd: string;
        historyPersistence?: CodexHistoryPersistence | null;
        disableResponseStorage?: boolean | null;
        appServerArgs?: string[];
    });
    onNotification(handler: (n: CodexAppServerNotification) => void): () => void;
    onServerRequest(handler: (req: ServerRequest) => Promise<unknown> | unknown): void;
    listThreads(limit?: number): Promise<ThreadSummary[]>;
    startThread(params: {
        cwd: string;
        approvalPolicy: "untrusted" | "on-failure" | "on-request" | "never";
        sandbox: "read-only" | "workspace-write" | "danger-full-access";
        model?: string;
        serviceTier?: "fast";
    }): Promise<any>;
    resumeThread(threadId: string): Promise<any>;
    readThread(threadId: string, includeTurns: boolean): Promise<any>;
    /**
     * 当 `thread/read` 不可用时的降级读取：
     * - includeTurns=true：通过 resume 获取线程对象（best-effort 包含 turns）
     * - includeTurns=false：通过 listThreads 查到最小信息（主要用于 cwd 权限校验/广播过滤）
     */
    private readThreadFallback;
    /**
     * 判断“线程不可用”错误：
     * - thread not found/no such thread/no rollout found
     * - thread 尚未 materialize（部分 codex 版本在首条用户消息前不允许 resume/read turns）
     */
    private isThreadUnavailableError;
    /**
     * 判断“includeTurns 暂不可用”错误。
     */
    private isIncludeTurnsUnavailableError;
    /**
     * 判断 JSON-RPC “method not found” 错误。
     */
    private isJsonRpcMethodNotFoundError;
    /**
     * 记录最新 stderr 行。
     */
    private rememberLatestStderrLine;
    /**
     * 将 `thread/start`（或其它读取路径）得到的 thread 写入短 TTL 缓存。
     */
    private cacheStartedThread;
    /**
     * 获取 thread/start 缓存命中项（过期自动清理）。
     */
    private getCachedStartedThread;
    startTurn(threadId: string, text: string, opts?: {
        model?: string;
        effort?: string;
        approvalPolicy?: "untrusted" | "on-failure" | "on-request" | "never";
        sandbox?: "read-only" | "workspace-write" | "danger-full-access";
        serviceTier?: "fast";
        collaborationMode?: unknown;
    }): Promise<any>;
    interruptTurn(threadId: string, turnId: string): Promise<any>;
    respond(id: JsonRpcId, result: unknown): void;
    getStatus(): CodexAppServerStatus;
    dispose(): void;
    listModels(): Promise<any>;
    listExperimentalFeatures(): Promise<any>;
    readConfig(): Promise<any>;
    listCollaborationModes(): Promise<any>;
    setConfigValue(params: {
        keyPath: string;
        value: unknown;
        mergeStrategy: "replace";
    }): Promise<any>;
    listSkills(): Promise<any>;
    setSkillEnabled(params: {
        path: string;
        enabled: boolean;
    }): Promise<any>;
    setThreadName(params: {
        threadId: string;
        name: string;
    }): Promise<any>;
    startReview(params: {
        threadId: string;
        target: unknown;
    }): Promise<any>;
    startCompact(params: {
        threadId: string;
    }): Promise<any>;
    forkThread(params: {
        threadId: string;
    }): Promise<any>;
    archiveThread(params: {
        threadId: string;
    }): Promise<any>;
    unarchiveThread(params: {
        threadId: string;
    }): Promise<any>;
    rollbackThread(params: {
        threadId: string;
        numTurns: number;
    }): Promise<any>;
    cleanBackgroundTerminals(params: {
        threadId: string;
    }): Promise<any>;
    private initialize;
    /**
     * 仅提取“对排查用户消息执行过程有价值”的通知并打日志。
     */
    private logRelevantCodexMessage;
    /**
     * 从 app-server 通知参数中尽力提取 threadId，兼容不同字段命名。
     */
    private extractThreadIdFromParams;
}
export {};
