import { type AuthDb } from "../auth/sqlite/authDb";
/**
 * 工作目录状态汇总：按用户 + cwd 聚合后返回给左轨使用。
 *
 * 注意：`hasCompletedUnread` 的语义为“尚未被任何用户查看的刚结束”；
 * 任意用户打开该线程后，后端会将该线程的 completed 状态对所有用户清理（全局已读）。
 */
export type WorkspaceStatusSummary = {
    cwd: string;
    hasRunning: boolean;
    hasPending: boolean;
    hasCompletedUnread: boolean;
    updatedAtMs: number;
};
/**
 * 更新线程运行态所需参数。
 */
export type SetThreadRunningForUsersInput = {
    usernames: string[];
    threadId: string;
    cwd: string;
    isRunning: boolean;
    updatedAtMs?: number;
};
/**
 * 更新线程待处理态所需参数。
 */
export type SetThreadPendingForUsersInput = {
    usernames: string[];
    threadId: string;
    cwd: string;
    isPending: boolean;
    updatedAtMs?: number;
};
/**
 * 标记线程“尚未被任何用户查看的刚结束”所需参数：
 * - 用于在工作目录列表上展示“刚结束”提示点；
 * - 任意用户打开该线程后会变为全局已读（清理所有用户的 completed 提示）。
 */
export type MarkThreadCompletedUnreadForUsersInput = {
    usernames: string[];
    threadId: string;
    cwd: string;
    updatedAtMs?: number;
};
/**
 * 用户工作目录状态仓库接口。
 */
export type WorkspaceStatusStore = {
    setThreadRunningForUsers(input: SetThreadRunningForUsersInput): Promise<void>;
    setThreadPendingForUsers(input: SetThreadPendingForUsersInput): Promise<void>;
    markThreadCompletedUnreadForUsers(input: MarkThreadCompletedUnreadForUsersInput): Promise<void>;
    /**
     * 标记某线程已被任意用户查看（全局已读）：
     * - 传入的 `username` 仅用于表意/兼容旧调用点（实现上会清理所有用户记录）；
     * - 清理后若该线程对某用户不再有 running/pending/completed 状态，则会删除该行以保持表紧凑。
     */
    markThreadSeen(username: string, threadId: string, updatedAtMs?: number): Promise<void>;
    renameUsername(username: string, nextUsername: string): Promise<void>;
    deleteUsername(username: string): Promise<void>;
    listWorkspaceStatusByUsername(username: string): Promise<WorkspaceStatusSummary[]>;
};
type CreateWorkspaceStatusStoreOptions = {
    dbPath?: string;
    authDb?: AuthDb;
};
/**
 * 创建工作目录状态仓库（当前默认使用 SQLite）。
 */
export declare function createWorkspaceStatusStore(options: CreateWorkspaceStatusStoreOptions): Promise<WorkspaceStatusStore>;
export {};
