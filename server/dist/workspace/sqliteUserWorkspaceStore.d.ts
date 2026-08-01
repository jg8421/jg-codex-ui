import type { AuthDb } from "../auth/sqlite/authDb";
import type { UserWorkspaceStore } from "./userWorkspaceStore";
/**
 * SQLite 用户工作目录仓库创建参数。
 */
export type CreateSqliteUserWorkspaceStoreOptions = {
    authDb: AuthDb;
};
/**
 * 基于 SQLite 创建用户工作目录仓库。
 */
export declare function createSqliteUserWorkspaceStore(options: CreateSqliteUserWorkspaceStoreOptions): UserWorkspaceStore;
