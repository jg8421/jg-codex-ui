import type { AuthDb } from "../auth/sqlite/authDb";
import type { WorkspaceStatusStore } from "./workspaceStatusStore";
type CreateSqliteWorkspaceStatusStoreOptions = {
    authDb: AuthDb;
};
/**
 * 基于 SQLite 创建工作目录状态仓库。
 */
export declare function createSqliteWorkspaceStatusStore(options: CreateSqliteWorkspaceStatusStoreOptions): WorkspaceStatusStore;
export {};
