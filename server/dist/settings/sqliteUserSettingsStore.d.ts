import type { AuthDb } from "../auth/sqlite/authDb";
import type { UserSettingsStore } from "./userSettingsStore";
/**
 * SQLite 用户配置仓库创建参数。
 */
export type CreateSqliteUserSettingsStoreOptions = {
    authDb: AuthDb;
};
/**
 * 基于 SQLite 创建用户配置仓库。
 */
export declare function createSqliteUserSettingsStore(options: CreateSqliteUserSettingsStoreOptions): UserSettingsStore;
