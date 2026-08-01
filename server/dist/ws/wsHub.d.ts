import { WebSocketServer } from "ws";
import type { CodexAppServer } from "../codex/codexAppServer";
import type { UserStore } from "../auth/userStore";
import type { WorkspaceStatusStore } from "../workspace/workspaceStatusStore";
import type { UserWorkspaceStore } from "../workspace/userWorkspaceStore";
import type { HistoryIngestService } from "../history/types";
import type { UserSettingsStore } from "../settings/userSettingsStore";
type StatusSnapshot = {
    codex?: unknown;
    codexTask?: unknown;
    ws?: unknown;
};
type WsHubOpts = {
    getActiveTurnIds?: (threadId: string) => string[];
    pendingTimeoutMs?: number;
    heartbeatIntervalMs?: number;
    userStore?: UserStore;
    userWorkspaceStore?: UserWorkspaceStore;
    userSettingsStore?: UserSettingsStore;
    workspaceStatusStore?: WorkspaceStatusStore | null;
    historyIngest?: HistoryIngestService | null;
};
export declare class WsHub {
    private readonly wss;
    private readonly codex;
    private readonly sessionSecret;
    private readonly getStatusSnapshot;
    private readonly clients;
    private readonly readyClients;
    private readonly wsScopeByClient;
    private readonly activeThreadIdByClient;
    private readonly threadOwners;
    private readonly threadOwnerUsername;
    private readonly threadOwnerUsernameMax;
    private readonly threadCwdById;
    private readonly pending;
    private readonly seenSubmitIdsByThread;
    private readonly submitDedupTtlMs;
    private readonly submitDedupMaxPerThread;
    private readonly wsUser;
    private readonly wsByUser;
    private readonly openThreadResultsByUser;
    private readonly openThreadDedupTtlMs;
    private readonly openThreadDedupMaxPerUser;
    private readonly threadTurnsByUser;
    private readonly threadTurnsCacheTtlMs;
    private readonly threadTurnsCacheMaxPerUser;
    private readonly threadContextUsageReader;
    private readonly chatProjector;
    private readonly threadCreatedAtMsById;
    private readonly initialThreadTurnLimit;
    private readonly loadThreadTurnsDefaultLimit;
    private readonly loadThreadTurnsMaxLimit;
    private readonly seenInterruptIdsByThread;
    private readonly interruptDedupTtlMs;
    private readonly interruptDedupMaxPerThread;
    private statusTimer;
    private lastStatusJson;
    private readonly getActiveTurnIds;
    private readonly pendingTimeoutMs;
    private heartbeatTimer;
    private readonly userStore;
    private readonly userWorkspaceStore;
    private readonly userSettingsStore;
    private readonly workspaceStatusStore;
    private readonly historyIngest;
    private threadListStore;
    private threadListStoreInitError;
    private workspaceRoutingSnapshot;
    private workspaceRoutingSnapshotPromise;
    private readonly workspaceRoutingSnapshotTtlMs;
    constructor(wss: WebSocketServer, codex: CodexAppServer, sessionSecret: string, getStatusSnapshot: () => StatusSnapshot, opts?: WsHubOpts);
    /**
     * 返回当前“正在查看指定线程”的用户名列表：
     * - 基于 thread scope 连接被锁定到 threadId 的事实判断；
     * - 用于在线程完成时判断是否已有用户正在查看，从而决定是否需要写入 completedUnread（全局未读语义）。
     */
    listThreadViewUsernames(threadIdRaw: string): string[];
    dispose(): void;
    /**
     * 懒加载 SQLite 线程列表存储，供 WS 新建线程后立即持久化摘要。
     */
    private resolveThreadListStore;
    /**
     * 将 WS 新建线程的摘要写入 SQLite，保持与 HTTP 创建入口一致。
     */
    private persistStartedThreadSummary;
    private onConnection;
    private resolveWsUserInfo;
    private getWsUserInfo;
    private getWsScope;
    private shouldReceiveGlobalMessages;
    private shouldReceiveThreadMessages;
    private assertThreadSocketLockedToThread;
    private lockThreadSocketToThread;
    private assertThreadAllowedForUser;
    private startHeartbeat;
    private handleAuthedMessage;
    private listThreadsForClient;
    private getWorkspaceRoutingSnapshot;
    private isCwdVisibleToUser;
    /**
     * 解析对指定 cwd 可见的用户名列表：用于同步目录级状态到数据库。
     */
    private resolveVisibleUsernamesForThreadCwd;
    /**
     * 线程被任意用户打开后，清除该线程的“刚结束”标记（全局已读语义）。
     */
    private markThreadSeenForUser;
    private getOrFetchThreadCwd;
    /**
     * 将消息广播给“对该 thread cwd 有权限”的在线用户，避免跨工作区泄露。
     * 说明：同一通知可能对应多条下发消息（chat_ops + todo + usage），因此这里支持批量发送。
     */
    private broadcastMessagesToAuthorizedUsers;
    private sendReady;
    private rememberSubmitId;
    private forgetSubmitId;
    private getCachedOpenThreadResult;
    private cacheOpenThreadResult;
    private trimThreadTurnsForClient;
    /**
     * 从线程 session 文件中读取最新 token_count，并写入 `contextUsagePercent` 字段。
     * 说明：前端会从 thread_opened payload 中读取该值，以解决“刚进来没有上下文使用率”的问题。
     */
    private attachThreadContextUsagePercent;
    private cacheThreadTurns;
    private getCachedThreadTurns;
    private getOrFetchThreadTurns;
    /**
     * 解析本次 interrupt 应该尝试中断的 turnId 列表。
     * 优先使用任务跟踪器提供的 active turnId；若为空，则回退为线程中最新的 turnId（尽力而为）。
     */
    private resolveInterruptTurnIds;
    /**
     * 从线程 turns 中提取“最新一个可用的 turnId”，用于 active turnId 缺失时的保底中断。
     * 注意：这是 best-effort，任何读取/解析异常都应返回 null，避免影响 ack 流程。
     */
    private getLatestThreadTurnId;
    private isThreadNotFoundError;
    private recoverThreadForSubmit;
    private rememberInterruptId;
    private startStatusPump;
    private sendStatus;
    private broadcastStatus;
    private broadcast;
    private safeSend;
    private handleCodexServerRequest;
    private resolvePendingTargetUsername;
    private setThreadOwner;
    private pruneThreadOwnerUsernames;
    private addUserClient;
    private removeUserClient;
    private isUserAuthorizedForPending;
    private flushPendingForWs;
    private dispatchPendingToReadyClients;
    private broadcastUserInputResolved;
    /**
     * 按各用户的审批 cwd 校验模式筛出真正允许处理审批的用户名列表。
     */
    private resolveApprovalEligibleUsernames;
}
export {};
