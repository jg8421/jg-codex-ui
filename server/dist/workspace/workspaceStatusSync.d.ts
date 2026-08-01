import type { UserStore } from "../auth/userStore";
import type { ThreadListStore } from "../threadList/threadListTypes";
import type { CodexThreadRunningStateChange } from "../status/codexTaskTracker";
import type { WorkspaceStatusStore } from "./workspaceStatusStore";
/**
 * 线程状态同步所需的 Codex 依赖（只用到 readThread，便于测试注入 stub）。
 */
export type WorkspaceStatusSyncCodex = {
    readThread: (threadId: string, includeTurns: boolean) => Promise<unknown>;
};
/**
 * 线程状态同步所需的 userStore 依赖（只用到 listUsers，便于测试注入 stub）。
 */
export type WorkspaceStatusSyncUserStore = Pick<UserStore, "listUsers">;
/**
 * workspace status 同步的依赖项集合。
 */
export type WorkspaceStatusSyncDeps = {
    codex: WorkspaceStatusSyncCodex;
    userStore: WorkspaceStatusSyncUserStore;
    workspaceStatusStore: WorkspaceStatusStore;
    threadListStore?: Pick<ThreadListStore, "upsertThreadSummary">;
    /**
     * 返回“当前正在查看该 thread 的用户名列表”：
     * - 用于实现“刚结束全局未读”语义：若任意可见用户正在看，则认为该线程已被看到，不再写入 completedUnread。
     * - 若依赖不可用则可不传，退化为“线程完成后一律写入 completedUnread（直到有人打开线程触发清理）”。
     */
    listActiveThreadViewUsernames?: (threadId: string) => string[];
};
/**
 * 将 CodexTaskTracker 产生的“线程运行态边沿”同步到工作目录状态仓库。
 */
export declare function syncWorkspaceStatusForThreadRunningStateChange(change: CodexThreadRunningStateChange, deps: WorkspaceStatusSyncDeps): Promise<void>;
