import type { UserStore } from "../userStore";
import type { AuthDb } from "./authDb";
/**
 * SQLite 用户仓库创建参数。
 */
export type CreateSqliteUserStoreOptions = {
    authDb: AuthDb;
};
/**
 * 基于 SQLite 创建用户仓库。
 */
export declare function createSqliteUserStore(options: CreateSqliteUserStoreOptions): UserStore;
